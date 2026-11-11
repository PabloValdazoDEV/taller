import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION, verificarSesion } from "@/lib/session-token";
import { slugDesdeHost } from "@/lib/tenant";

const PUBLICAS = ["/login", "/d"]; // /d/<token>: descarga de documentos con enlace firmado

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLICAS.some((p) => pathname === p || pathname.startsWith(p + "/"))) return NextResponse.next();

  const s = await verificarSesion(req.cookies.get(COOKIE_SESION)?.value);
  if (!s || s.slug !== slugDesdeHost(req.headers.get("host"))) {
    if (pathname.startsWith("/api/")) return new NextResponse("No autorizado", { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon.*\\.png).*)"],
};
