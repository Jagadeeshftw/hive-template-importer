import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/app/login/actions';
import { FileIcon, ListIcon, UploadIcon } from '@/components/icons';
import { NavLink } from '@/components/nav-link';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already gates this, but a layout that renders user data should
  // not assume it.
  if (!user) redirect('/login');

  return (
    <div className="flex-grow flex flex-col">
      <header className="shrink-0 flex h-14 items-center gap-3 border-b border-line bg-surface px-4 sm:px-5">
        <Link href="/templates" className="flex items-center gap-2.5 min-w-0">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-[5px] bg-primary text-primary-ink">
            <FileIcon className="size-3.5" />
          </span>
          <span className="text-sm font-semibold truncate">
            Template Importer
          </span>
        </Link>

        <div className="flex-grow" />

        <span className="hidden sm:inline text-[13px] text-muted truncate max-w-[220px]">
          {user.email}
        </span>
        <form action={signOut}>
          <button
            type="submit"
            className="h-[30px] rounded-md border border-control bg-surface px-3 text-[13px]"
          >
            Sign out
          </button>
        </form>
      </header>

      <div className="flex-grow flex flex-col sm:flex-row min-h-0">
        <nav
          aria-label="Sections"
          className="shrink-0 flex flex-row gap-1 border-b border-line bg-surface p-2 sm:w-[216px] sm:flex-col sm:gap-0.5 sm:border-r sm:border-b-0 sm:p-3"
        >
          <NavLink href="/templates" icon={<ListIcon className="size-[15px]" />}>
            Templates
          </NavLink>
          <NavLink href="/import" icon={<UploadIcon className="size-[15px]" />}>
            Import
          </NavLink>
        </nav>

        <main className="flex-grow min-w-0 px-4 py-5 sm:px-7 sm:py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
