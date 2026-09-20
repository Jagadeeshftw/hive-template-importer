import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTemplate } from '@/lib/db/queries';
import { EditorHeader, TemplateEditor } from './editor';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const template = await getTemplate(id);
  return { title: template ? `${template.name} · Template Importer` : 'Template Importer' };
}

export default async function TemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const template = await getTemplate(id);
  if (!template) notFound();

  return (
    <div className="-mx-4 -my-5 flex min-h-0 flex-grow flex-col sm:-mx-7 sm:-my-6">
      <EditorHeader template={template} />
      <TemplateEditor template={template} />
    </div>
  );
}
