import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { execFile } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const ALLOWED_PLATFORMS = ['fb', 'ig', 'threads'] as const;
export type Platform = (typeof ALLOWED_PLATFORMS)[number];

export interface CommentHistoryRow {
  comment_id: string;
  post_id?: string;
  media_id?: string;
  post_snippet?: string;
  post_time?: string;
  post_url?: string;
  comment_created?: string;
  author: string;
  author_id?: string;
  message: string;
  reply_count?: number;
  platform?: string;
}

@Injectable()
export class CommentsService {
  private get engineDir(): string {
    return process.env.COMMENTS_ENGINE_DIR || '/home/sakkhor/.hermes/profiles/fixanyphoto/scripts';
  }

  private get stateDir(): string {
    return process.env.COMMENTS_STATE_DIR || '/home/sakkhor/.hermes/profiles/fixanyphoto/state';
  }

  validatePlatform(platform: string): asserts platform is Platform {
    if (!ALLOWED_PLATFORMS.includes(platform as Platform)) {
      throw new BadRequestException(
        `Invalid platform: "${platform}". Allowed platforms: ${ALLOWED_PLATFORMS.join(', ')}`
      );
    }
  }

  getEngineScriptPath(platform: Platform): string {
    return path.join(this.engineDir, `${platform}-comments-engine.py`);
  }

  getPendingFilePath(platform: Platform): string {
    return path.join(this.stateDir, `${platform}-comments-pending.json`);
  }

  getHistoryFilePath(platform: Platform): string {
    return path.join(this.stateDir, `${platform}-comments-history.json`);
  }

  runEngine(platform: Platform, command: string, args: string[] = []): Promise<Record<string, unknown>> {
    const scriptPath = this.getEngineScriptPath(platform);
    return new Promise((resolve, reject) => {
      execFile(
        'python3',
        [scriptPath, command, ...args],
        { timeout: 20000, maxBuffer: 10 * 1024 * 1024 },
        (error, stdout, stderr) => {
          const out = (stdout || '').trim();
          if (out) {
            try {
              const parsed = JSON.parse(out);
              return resolve(parsed);
            } catch {
              // Non-JSON output
            }
          }

          if (error) {
            return reject(
              new InternalServerErrorException({
                ok: false,
                error: stderr?.trim() || error.message || 'Engine command failed',
              })
            );
          }

          return resolve({ ok: true, output: out });
        }
      );
    });
  }

  async getComments(platformParam: string = 'fb') {
    this.validatePlatform(platformParam);
    const platform = platformParam as Platform;

    // Run poll command first for fresh data
    try {
      await this.runEngine(platform, 'poll');
    } catch (err: unknown) {
      const error = err as Error;
      // If poll fails, log and proceed to check pending file
      console.error(`[CommentsService] Error polling platform ${platform}:`, error?.message || err);
    }

    // Read platform pending JSON file verbatim
    const pendingFile = this.getPendingFilePath(platform);
    if (!fs.existsSync(pendingFile)) {
      return { new_count: 0, items: [] };
    }

    try {
      const content = await fs.promises.readFile(pendingFile, 'utf-8');
      return JSON.parse(content);
    } catch (err: unknown) {
      const error = err as Error;
      throw new InternalServerErrorException(
        `Failed to read pending comments file: ${error?.message || err}`
      );
    }
  }

  async getHistory(
    platformParam: string = 'fb',
    pageParam?: string,
    pageSizeParam?: string
  ) {
    this.validatePlatform(platformParam);
    const platform = platformParam as Platform;

    const historyFile = this.getHistoryFilePath(platform);
    let rawContent: string;
    try {
      rawContent = await fs.promises.readFile(historyFile, 'utf-8');
    } catch (err: unknown) {
      const error = err as NodeJS.ErrnoException;
      if (error?.code === 'ENOENT') {
        return {
          generated_at: null,
          generatedAt: null,
          count: 0,
          total: 0,
          page: 1,
          pageSize: 50,
          comments: [],
        };
      }
      throw new InternalServerErrorException(
        `Failed to read comments history file: ${error?.message || err}`
      );
    }

    let parsed: { generated_at?: string; comments?: CommentHistoryRow[] } | null = null;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      return {
        generated_at: null,
        generatedAt: null,
        count: 0,
        total: 0,
        page: 1,
        pageSize: 50,
        comments: [],
      };
    }

    const allComments: CommentHistoryRow[] = (Array.isArray(parsed?.comments) ? parsed.comments : []).slice();
    allComments.sort((a, b) => {
      const timeA = a?.comment_created ? new Date(a.comment_created).getTime() : 0;
      const timeB = b?.comment_created ? new Date(b.comment_created).getTime() : 0;
      return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
    });

    const hasPaging = pageParam !== undefined || pageSizeParam !== undefined;
    const page = Math.max(1, parseInt(pageParam || '1', 10) || 1);
    const pageSize = hasPaging
      ? Math.max(1, parseInt(pageSizeParam || '50', 10) || 50)
      : allComments.length;
    const total = allComments.length;
    const startIndex = (page - 1) * pageSize;
    const paginatedComments = hasPaging
      ? allComments.slice(startIndex, startIndex + pageSize)
      : allComments;

    const generatedAt = parsed?.generated_at ?? null;

    return {
      generated_at: generatedAt,
      generatedAt,
      count: total,
      total,
      page: hasPaging ? page : 1,
      pageSize: hasPaging ? pageSize : 50,
      comments: paginatedComments,
    };
  }

  async reply(platformParam: string, id: string, text: string) {
    this.validatePlatform(platformParam);
    if (!id || !text) {
      throw new BadRequestException('Comment "id" and "text" are required for reply');
    }
    return this.runEngine(platformParam as Platform, 'reply', [id, text]);
  }

  async hide(platformParam: string, id: string, reason?: string) {
    this.validatePlatform(platformParam);
    if (!id) {
      throw new BadRequestException('Comment "id" is required for hide');
    }
    return this.runEngine(platformParam as Platform, 'hide', [id, reason || '']);
  }

  async skip(platformParam: string, id: string, reason?: string) {
    this.validatePlatform(platformParam);
    if (!id) {
      throw new BadRequestException('Comment "id" is required for skip');
    }
    return this.runEngine(platformParam as Platform, 'skip', [id, reason || '']);
  }
}
