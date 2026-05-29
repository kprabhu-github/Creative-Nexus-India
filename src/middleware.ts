import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Public surfaces that must remain reachable without a session cookie.
// Everything else under /api is gated to authenticated users so the WAF-mask
// `/xapi/*` rewrite cannot be used by anonymous callers to spend Claude tokens,
// rotate SMTP credentials, or write team rows.
const PUBLIC_API_PREFIXES = [
  "/api/auth/", // login/signup/setup callbacks
  "/api/health",
  "/api/cron/", // hostinger cron uses x-cron-secret instead of cookies
  "/api/webhooks/", // 3rd-party webhooks authenticate via their own signatures
];

function isPublicApi(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p));
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request: { headers: request.headers } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthPage =
    path.startsWith("/login") || path.startsWith("/signup");
  const isApi = path.startsWith("/api/");

  // Gate sensitive APIs — was previously bypassed, allowing any visitor to
  // hit /xapi/ai-lab/chat, /xapi/email/accounts, /xapi/team POST, etc.
  if (!user && isApi && !isPublicApi(path)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Redirect unauthenticated users away from dashboard routes
  if (!user && !isAuthPage && !isApi) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth pages
  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Cache-Control: only documents (HTML) need no-store to avoid stale chunk
  // refs after a deploy. JSON API responses should be cacheable via their own
  // explicit Cache-Control headers if desired.
  if (!isApi) {
    response.headers.set("Cache-Control", "no-store, must-revalidate");
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
