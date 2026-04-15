import { NextResponse, type NextRequest } from "next/server";

// TODO: Re-enable Supabase auth once connected. Temporarily bypassed for UI preview.
export async function middleware(request: NextRequest) {
  return NextResponse.next({ request: { headers: request.headers } });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
