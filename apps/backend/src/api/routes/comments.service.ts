import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { execFile } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const ALLOWED_PLATFORMS = ['fb', 'ig', 'threads'] as const;
export type Platform = (typeof ALLOWED_PLATFORMS)[number];

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

  runEngine(platform: Platform, command: string, args: string[] = []): Promise<any> {
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
    } catch (err: any) {
      // If poll fails, log and proceed to check pending file
      console.error(`[CommentsService] Error polling platform ${platform}:`, err?.message || err);
    }

    // Read platform pending JSON file verbatim
    const pendingFile = this.getPendingFilePath(platform);
    if (!fs.existsSync(pendingFile)) {
      return { new_count: 0, items: [] };
    }

    try {
      const content = await fs.promises.readFile(pendingFile, 'utf-8');
      return JSON.parse(content);
    } catch (err: any) {
      throw new InternalServerErrorException(
        `Failed to read pending comments file: ${err.message}`
      );
    }
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
