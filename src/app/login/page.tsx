import type { Metadata } from 'next';
import { FileIcon, InfoIcon } from '@/components/icons';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Sign in · Template Importer' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="flex-grow flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[416px] flex flex-col gap-6">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-ink">
            <FileIcon className="size-4" />
          </span>
          <span className="text-base font-semibold tracking-tight">
            Template Importer
          </span>
        </div>

        <div className="rounded-[10px] border border-line bg-surface p-7 flex flex-col gap-4.5">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
            <p className="text-[13px] leading-relaxed text-muted">
              Templates and import runs are private to your account.
            </p>
          </div>

          <LoginForm next={next} />

          <div className="flex gap-2.5 rounded-md border border-line bg-surface-2 p-3">
            <InfoIcon className="size-[15px] shrink-0 mt-0.5 text-muted" />
            <p className="text-xs leading-relaxed text-muted">
              Two reviewer accounts are seeded, each with the sample template
              already imported. The credentials are in the submission email.
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-muted">
          Supabase email auth. Public sign-ups are disabled.
        </p>
      </div>
    </main>
  );
}
