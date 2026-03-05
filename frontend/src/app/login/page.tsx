"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      router.push("/");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "로그인에 실패했습니다.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* 로고 */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-blue-500 rounded-xl flex items-center justify-center text-white font-black text-2xl mx-auto mb-3 shadow-lg shadow-blue-500/30">
            X
          </div>
          <h1 className="text-xl font-bold text-white">엑스컴 마케팅</h1>
          <p className="text-sm text-slate-400 mt-1">Performance Dashboard</p>
        </div>

        {/* 로그인 폼 */}
        <form
          onSubmit={handleSubmit}
          className="bg-slate-800/80 backdrop-blur rounded-2xl border border-slate-700/50 p-7 space-y-5 shadow-xl"
        >
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              아이디
            </label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              placeholder="아이디 또는 이메일"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              비밀번호
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              placeholder="비밀번호"
              required
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-900/20 rounded-lg p-2.5 border border-red-800/30">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg shadow-blue-600/20"
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>

        <p className="text-center text-[11px] text-slate-600 mt-6">
          관리자에게 계정을 요청하세요
        </p>
      </div>
    </div>
  );
}
