import { CommentsInboxComponent } from '@gitroom/frontend/components/comments/comments.component';
export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
import { isGeneralServerSide } from '@gitroom/helpers/utils/is.general.server.side';

export const metadata: Metadata = {
  title: `${isGeneralServerSide() ? 'Postiz' : 'Gitroom'} Comments Inbox`,
  description: 'Manage and reply to Facebook, Instagram, and Threads comments',
};

export default async function CommentsPage() {
  return (
    <div className="bg-newBgColorInner flex-1 flex-col flex overflow-hidden">
      <CommentsInboxComponent />
    </div>
  );
}
