// Resolve the real public origin behind Hostinger's reverse proxy.
// `new URL(request.url).origin` returns the internal proxy bind host (often
// `http://0.0.0.0:3000`), which breaks OAuth redirects + any user-visible URL.
// Prefer NEXT_PUBLIC_SITE_URL > x-forwarded-host > request URL origin.

import { headers } from "next/headers";

export function resolvePublicOrigin(request: Request): string {
  const envSite = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (envSite) return envSite.replace(/\/$/, "");

  const h = headers();
  const forwardedHost = h.get("x-forwarded-host");
  const forwardedProto = h.get("x-forwarded-proto") ?? "https";
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`;

  return new URL(request.url).origin;
}
