import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { supabasePublishableKey, supabaseUrl } from '@/lib/env';

/** Routes a signed-out visitor may see. Everything else redirects to /login. */
const PUBLIC_PATHS = ['/login'];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Refreshes the Supabase session cookie on every request and gates routes.
 *
 * The response object has to be the one Supabase wrote its cookies onto, so
 * redirects copy those cookies across rather than constructing a bare response.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() revalidates against the auth server; getSession() would trust the
  // cookie as-is, which is not good enough for a gate.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    // Preserve where they were heading so login can send them back.
    if (pathname !== '/') url.searchParams.set('next', pathname);
    return copyCookies(response, NextResponse.redirect(url));
  }

  if (user && pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/templates';
    url.search = '';
    return copyCookies(response, NextResponse.redirect(url));
  }

  return response;
}

/** Moves the refreshed auth cookies onto a redirect, so the session survives it. */
function copyCookies(from: NextResponse, to: NextResponse): NextResponse {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie);
  }
  return to;
}
