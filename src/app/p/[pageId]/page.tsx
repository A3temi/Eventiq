import { notFound } from 'next/navigation';
import { getPage } from '@/lib/db/pages';
import { PageRenderer } from './PageRenderer';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ pageId: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { pageId } = await params;
  const page = await getPage(pageId);
  if (!page) return { title: 'Page Not Found' };

  return {
    title: `${page.title} — Eventiq`,
    description: page.settings.description || `${page.type} page for your event`,
  };
}

export default async function PublicPage({ params }: Props) {
  const { pageId } = await params;
  const page = await getPage(pageId);

  if (!page) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <PageRenderer page={page} />
    </div>
  );
}
