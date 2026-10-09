import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const host = (req.headers.get("host") || "").split(":")[0].toLowerCase();

  // Always send the legacy Railway hostname to the school domain without
  // carrying Railway's internal port (for example :8080) into the redirect.
  if (host === "gea-web-live-production.up.railway.app") {
    const url = req.nextUrl.clone();
    url.protocol = "https:";
    url.hostname = "school.globalenglishacademyonline.co.za";
    url.port = "";
    return NextResponse.redirect(url, 307);
  }

  const hasSession = Boolean(req.cookies.get("gea_session")?.value);
  const path = req.nextUrl.pathname;

  if (path === "/login" && hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  if (
    path === "/dashboard" ||
    path.startsWith("/dashboard/") ||
    path === "/change-password" ||
    path.startsWith("/classroom/")
  ) {
    if (!hasSession) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("from", path);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/dashboard/:path*", "/change-password", "/classroom/:path*"],
};
