"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import StoreProvider from "./StoreProvider";
import Sidebar from "./Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();

  // 로그인 페이지는 사이드바 없이 렌더
  if (pathname === "/login") {
    return <>{children}</>;
  }

  // 로딩 중
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-400">로딩 중...</p>
        </div>
      </div>
    );
  }

  // 미인증 → 로그인 페이지로 리다이렉트
  if (!user) {
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    return null;
  }

  // 인증된 상태 → 전체 레이아웃
  return (
    <StoreProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 ml-60 overflow-auto">{children}</main>
      </div>
    </StoreProvider>
  );
}
