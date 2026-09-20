'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function NavLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={
        active
          ? 'flex h-[34px] items-center gap-2.5 rounded-md bg-primary-soft px-2.5 text-[13px] font-medium text-ink'
          : 'flex h-[34px] items-center gap-2.5 rounded-md px-2.5 text-[13px] text-muted'
      }
    >
      {icon}
      {children}
    </Link>
  );
}
