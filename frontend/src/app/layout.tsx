import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import StoreProvider from "@/components/StoreProvider";

export const metadata: Metadata = {
  title: "엑스컴 마케팅 대시보드",
  description: "퍼포먼스 마케팅 광고 성과 분석 - 엑스컴AI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="bg-slate-50 text-gray-900">
        <StoreProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 ml-60 overflow-auto">{children}</main>
          </div>
        </StoreProvider>
      </body>
    </html>
  );
}
