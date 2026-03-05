"use client";

import { useState, useRef, useEffect } from "react";
import { api, ChatMessage } from "@/lib/api";

interface AiChatProps {
  isOpen: boolean;
  onClose: () => void;
  dashboardContext?: string;
}

export default function AiChat({ isOpen, onClose, dashboardContext }: AiChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsApiKey, setNeedsApiKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      api.getAiApiKeyStatus().then((status) => {
        setNeedsApiKey(!status.is_configured);
      }).catch(() => setNeedsApiKey(true));
    }
  }, [isOpen]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const saveApiKey = async () => {
    if (!apiKeyInput.trim()) return;
    try {
      await api.saveAiApiKey(apiKeyInput.trim());
      setNeedsApiKey(false);
      setApiKeyInput("");
    } catch (e: any) {
      alert(e.message);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg: ChatMessage = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const resp = await api.chatWithAi(newMessages, dashboardContext);
      setMessages([...newMessages, { role: "assistant", content: resp.reply }]);
    } catch (e: any) {
      setMessages([
        ...newMessages,
        { role: "assistant", content: `오류가 발생했습니다: ${e.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-screen w-[420px] bg-white border-l border-gray-200 shadow-2xl z-40 chat-sidebar flex flex-col">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center font-black text-sm backdrop-blur">
            X
          </div>
          <div>
            <h3 className="font-bold text-sm">엑스컴AI</h3>
            <p className="text-[10px] text-blue-100">퍼포먼스 마케팅 전문 AI</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors text-white/80 hover:text-white"
        >
          ✕
        </button>
      </div>

      {/* API 키 설정 */}
      {needsApiKey ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center space-y-4 w-full">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto text-2xl">
              🔑
            </div>
            <div>
              <h4 className="font-bold text-gray-900">Claude API 키 필요</h4>
              <p className="text-sm text-gray-500 mt-1">엑스컴AI를 사용하려면 Anthropic API 키가 필요합니다.</p>
            </div>
            <div className="space-y-2">
              <input
                type="password"
                placeholder="sk-ant-..."
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveApiKey()}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={saveApiKey}
                className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                API 키 저장
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* 메시지 영역 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-12 space-y-3">
                <div className="text-4xl">💡</div>
                <p className="text-sm text-gray-500">
                  광고 성과 분석, 최적화 전략,<br />예산 배분 등 무엇이든 물어보세요!
                </p>
                <div className="space-y-2 mt-4">
                  {[
                    "현재 광고 성과를 분석해줘",
                    "CTR을 높이는 방법은?",
                    "ROAS 개선 전략을 추천해줘",
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => {
                        setInput(q);
                      }}
                      className="block w-full text-left px-4 py-2.5 bg-gray-50 hover:bg-blue-50 rounded-xl text-sm text-gray-600 hover:text-blue-600 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white rounded-br-md"
                      : "bg-gray-100 text-gray-800 rounded-bl-md"
                  }`}
                >
                  {msg.role === "assistant" && (
                    <div className="flex items-center gap-1.5 mb-1.5 text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                      <span className="w-4 h-4 bg-blue-100 rounded flex items-center justify-center text-[8px] font-black">X</span>
                      엑스컴AI
                    </div>
                  )}
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-md">
                  <div className="flex items-center gap-1.5 mb-1.5 text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                    <span className="w-4 h-4 bg-blue-100 rounded flex items-center justify-center text-[8px] font-black">X</span>
                    엑스컴AI
                  </div>
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* 입력 영역 */}
          <div className="p-4 border-t border-gray-100 bg-gray-50">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder="메시지를 입력하세요..."
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                disabled={loading}
              />
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                전송
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
