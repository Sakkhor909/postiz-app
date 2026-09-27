'use client';

import React, { FC, useCallback, useState } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { Button } from '@gitroom/react/form/button';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import clsx from 'clsx';

export type Platform = 'fb' | 'ig' | 'threads';

interface CommentItem {
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
  is_hidden?: boolean;
  can_hide?: boolean;
}

interface CommentsResponse {
  new_count: number;
  items: CommentItem[];
}

const PLATFORMS: { id: Platform; label: string; icon: string }[] = [
  { id: 'fb', label: 'Facebook', icon: 'FB' },
  { id: 'ig', label: 'Instagram', icon: 'IG' },
  { id: 'threads', label: 'Threads', icon: 'TH' },
];

export const CommentsInboxComponent: FC = () => {
  const [platform, setPlatform] = useState<Platform>('fb');
  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});
  const [loadingActionMap, setLoadingActionMap] = useState<Record<string, string>>({});
  const [confirmHideId, setConfirmHideId] = useState<string | null>(null);
  const [confirmSkipId, setConfirmSkipId] = useState<string | null>(null);

  const fetch = useFetch();
  const toaster = useToaster();

  const loadComments = useCallback(
    async (path: string): Promise<CommentsResponse> => {
      const res = await fetch(path);
      if (!res.ok) {
        throw new Error(`Failed to load comments (${res.status})`);
      }
      return await res.json();
    },
    [fetch]
  );

  const {
    data,
    error,
    isLoading,
    isValidating,
    mutate,
  } = useSWR<CommentsResponse>(`/comments?platform=${platform}`, loadComments, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  const handleReplyChange = (id: string, text: string) => {
    setReplyTextMap((prev) => ({ ...prev, [id]: text }));
  };

  const handleReply = async (comment: CommentItem) => {
    const text = replyTextMap[comment.comment_id]?.trim();
    if (!text) {
      toaster.show('Reply text cannot be empty', 'warning');
      return;
    }

    setLoadingActionMap((prev) => ({ ...prev, [comment.comment_id]: 'reply' }));
    try {
      const res = await fetch('/comments/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          id: comment.comment_id,
          text,
        }),
      });

      const body = await res.json();
      if (!res.ok || body?.ok === false) {
        throw new Error(body?.error?.message || body?.error || 'Failed to post reply');
      }

      toaster.show(
        `Reply sent successfully! ${body.reply_id ? `(ID: ${body.reply_id})` : ''}`,
        'success'
      );

      // Clear reply text and revalidate
      setReplyTextMap((prev) => {
        const next = { ...prev };
        delete next[comment.comment_id];
        return next;
      });
      await mutate();
    } catch (err: any) {
      toaster.show(err?.message || 'Error', 'warning');
    } finally {
      setLoadingActionMap((prev) => {
        const next = { ...prev };
        delete next[comment.comment_id];
        return next;
      });
    }
  };

  const handleHide = async (comment: CommentItem) => {
    setLoadingActionMap((prev) => ({ ...prev, [comment.comment_id]: 'hide' }));
    try {
      const res = await fetch('/comments/hide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          id: comment.comment_id,
          reason: 'Hidden via Comments Inbox',
        }),
      });

      const body = await res.json();
      if (!res.ok || body?.ok === false) {
        throw new Error(body?.error?.message || body?.error || 'Failed to hide comment');
      }

      toaster.show('Comment hidden successfully', 'success');
      setConfirmHideId(null);
      await mutate();
    } catch (err: any) {
      toaster.show(err?.message || 'Error hiding comment', 'warning');
    } finally {
      setLoadingActionMap((prev) => {
        const next = { ...prev };
        delete next[comment.comment_id];
        return next;
      });
    }
  };

  const handleSkip = async (comment: CommentItem) => {
    setLoadingActionMap((prev) => ({ ...prev, [comment.comment_id]: 'skip' }));
    try {
      const res = await fetch('/comments/skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          id: comment.comment_id,
          reason: 'Skipped via Comments Inbox',
        }),
      });

      const body = await res.json();
      if (!res.ok || body?.ok === false) {
        throw new Error(body?.error?.message || body?.error || 'Failed to skip comment');
      }

      toaster.show('Comment marked as skipped', 'success');
      setConfirmSkipId(null);
      await mutate();
    } catch (err: any) {
      toaster.show(err?.message || 'Error skipping comment', 'warning');
    } finally {
      setLoadingActionMap((prev) => {
        const next = { ...prev };
        delete next[comment.comment_id];
        return next;
      });
    }
  };

  const items = data?.items || [];

  return (
    <div className="flex-1 flex flex-col p-[20px] gap-[16px] overflow-auto">
      {/* Platform Tabs & Refresh Bar */}
      <div className="flex flex-wrap items-center justify-between gap-[12px] pb-[16px] border-b border-newTableBorder">
        <div className="flex gap-[8px]">
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setPlatform(p.id);
                setConfirmHideId(null);
                setConfirmSkipId(null);
              }}
              className={clsx(
                'px-[16px] py-[8px] rounded-[8px] text-[14px] font-[600] transition-colors cursor-pointer',
                platform === p.id
                  ? 'bg-forth text-white shadow-sm'
                  : 'bg-newBgColorInner text-textItemBlur hover:text-newTextColor hover:bg-tableBorder'
              )}
            >
              {p.label}
              {platform === p.id && data?.new_count !== undefined && (
                <span className="ml-[8px] px-[6px] py-[2px] text-[12px] bg-black/20 rounded-full">
                  {data.new_count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-[12px]">
          <span className="text-[13px] text-textItemBlur">
            {isValidating ? 'Checking for updates...' : `${items.length} pending`}
          </span>
          <Button
            secondary
            onClick={() => mutate()}
            loading={isValidating}
            className="!h-[36px] !px-[16px] text-[13px]"
          >
            Poll & Refresh
          </Button>
        </div>
      </div>

      {/* Content Area */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center p-[40px]">
          <LoadingComponent />
        </div>
      ) : error ? (
        <div className="rounded-[8px] border border-red-500/30 bg-red-500/10 p-[20px] text-center">
          <div className="text-[15px] font-[600] text-red-400 mb-[4px]">
            Failed to load {PLATFORMS.find((p) => p.id === platform)?.label} comments
          </div>
          <div className="text-[13px] text-textItemBlur mb-[12px]">
            {error.message || 'Please check engine configuration and network connectivity.'}
          </div>
          <Button secondary onClick={() => mutate()}>
            Try Again
          </Button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-[60px] text-center rounded-[8px] border border-dashed border-newTableBorder bg-newBgColorInner/40">
          <div className="w-[48px] h-[48px] rounded-full bg-forth/10 text-forth flex items-center justify-center mb-[16px]">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div className="text-[16px] font-[600] text-newTextColor mb-[4px]">
            All caught up!
          </div>
          <div className="text-[13px] text-textItemBlur max-w-[360px] mb-[16px]">
            No pending comments for {PLATFORMS.find((p) => p.id === platform)?.label}.
            Click below to poll Facebook/Instagram/Threads for fresh comments.
          </div>
          <Button secondary onClick={() => mutate()} loading={isValidating}>
            Poll New Comments
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-[12px]">
          {items.map((comment) => {
            const isReplying = loadingActionMap[comment.comment_id] === 'reply';
            const isHiding = loadingActionMap[comment.comment_id] === 'hide';
            const isSkipping = loadingActionMap[comment.comment_id] === 'skip';

            return (
              <div
                key={comment.comment_id}
                className="rounded-[8px] border border-newTableBorder bg-newBgColorInner p-[16px] flex flex-col gap-[12px] transition-all hover:border-newTableBorder/80"
              >
                {/* Comment Header: Author, Timestamps, Post Link */}
                <div className="flex flex-wrap items-center justify-between gap-[8px] text-[13px]">
                  <div className="flex items-center gap-[8px]">
                    <span className="font-[600] text-newTextColor">
                      {comment.author}
                    </span>
                    {comment.comment_created && (
                      <span className="text-textItemBlur text-[12px]">
                        {new Date(comment.comment_created).toLocaleString()}
                      </span>
                    )}
                    {comment.is_hidden && (
                      <span className="px-[6px] py-[1px] rounded text-[11px] bg-yellow-500/20 text-yellow-300">
                        Hidden
                      </span>
                    )}
                  </div>

                  {comment.post_url && (
                    <a
                      href={comment.post_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-forth text-[12px] hover:underline flex items-center gap-[4px]"
                    >
                      <span>View original post</span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                    </a>
                  )}
                </div>

                {/* Post snippet */}
                {comment.post_snippet && (
                  <div className="bg-black/20 rounded-[6px] p-[10px] text-[12px] text-textItemBlur border-l-2 border-forth">
                    <span className="font-[600] text-newTextColor mr-[6px]">
                      Post:
                    </span>
                    {comment.post_snippet}
                  </div>
                )}

                {/* Comment Text */}
                <div className="text-[14px] text-newTextColor whitespace-pre-wrap py-[4px]">
                  {comment.message}
                </div>

                {/* Reply Input Box */}
                <div className="flex flex-col sm:flex-row gap-[8px] pt-[8px] border-t border-newTableBorder/50">
                  <input
                    type="text"
                    placeholder="Write a reply..."
                    value={replyTextMap[comment.comment_id] || ''}
                    onChange={(e) =>
                      handleReplyChange(comment.comment_id, e.target.value)
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleReply(comment);
                      }
                    }}
                    disabled={isReplying}
                    className="flex-1 bg-black/30 border border-newTableBorder rounded-[6px] px-[12px] py-[8px] text-[13px] text-newTextColor placeholder:text-textItemBlur/60 outline-none focus:border-forth"
                  />
                  <div className="flex items-center gap-[6px] self-end sm:self-auto">
                    <Button
                      onClick={() => handleReply(comment)}
                      loading={isReplying}
                      className="!h-[36px] !px-[16px] text-[13px]"
                    >
                      Reply
                    </Button>

                    {/* Hide Button / Confirmation */}
                    {confirmHideId === comment.comment_id ? (
                      <div className="flex items-center gap-[4px] bg-red-500/10 border border-red-500/30 rounded-[6px] p-[2px]">
                        <button
                          type="button"
                          onClick={() => handleHide(comment)}
                          disabled={isHiding}
                          className="px-[8px] py-[4px] text-[12px] font-[600] text-red-400 hover:text-red-300 cursor-pointer"
                        >
                          Confirm Hide
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmHideId(null)}
                          className="px-[6px] py-[4px] text-[12px] text-textItemBlur hover:text-newTextColor cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <Button
                        secondary
                        onClick={() => {
                          setConfirmHideId(comment.comment_id);
                          setConfirmSkipId(null);
                        }}
                        loading={isHiding}
                        className="!h-[36px] !px-[12px] text-[13px]"
                      >
                        Hide
                      </Button>
                    )}

                    {/* Skip Button / Confirmation */}
                    {confirmSkipId === comment.comment_id ? (
                      <div className="flex items-center gap-[4px] bg-black/40 border border-newTableBorder rounded-[6px] p-[2px]">
                        <button
                          type="button"
                          onClick={() => handleSkip(comment)}
                          disabled={isSkipping}
                          className="px-[8px] py-[4px] text-[12px] font-[600] text-yellow-400 hover:text-yellow-300 cursor-pointer"
                        >
                          Confirm Skip
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmSkipId(null)}
                          className="px-[6px] py-[4px] text-[12px] text-textItemBlur hover:text-newTextColor cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <Button
                        secondary
                        onClick={() => {
                          setConfirmSkipId(comment.comment_id);
                          setConfirmHideId(null);
                        }}
                        loading={isSkipping}
                        className="!h-[36px] !px-[12px] text-[13px]"
                      >
                        Skip
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
