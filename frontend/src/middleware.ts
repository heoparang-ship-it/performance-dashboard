import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(_request: NextRequest) {
  // localStorage 기반 토큰이므로 서버 미들웨어에서는 확인 불가.
  // 클라이언트 AuthProvider + AppShell에서 인증 리다이렉트 처리.
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
