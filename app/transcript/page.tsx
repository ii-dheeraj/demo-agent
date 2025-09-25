"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useTranscript } from "../contexts/TranscriptContext";

export default function TranscriptPage() {
  const { transcriptItems } = useTranscript();

  const messages = useMemo(() => {
    return (transcriptItems || [])
      .filter((it) => it.type === "MESSAGE" && !it.isHidden)
      .map((it) => ({
        id: it.itemId,
        role: it.role === "user" ? "candidate" : "agent",
        text: it.title || "",
        ts: it.timestamp || "",
      }));
  }, [transcriptItems]);

  const fullText = useMemo(() => {
    return messages.map((m) => `${m.role.toUpperCase()}: ${m.text}`).join("\n\n");
  }, [messages]);

  const onCopy = async () => {
    try { await navigator.clipboard.writeText(fullText); } catch {}
  };

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-gray-100">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="font-semibold">Meeting Transcript</div>
          <div className="flex items-center gap-2">
            <button onClick={onCopy} className="rounded-md bg-gray-800 text-white text-sm px-3 py-1.5 hover:bg-black">Copy</button>
            <Link href="/" className="rounded-md bg-indigo-600 text-white text-sm px-3 py-1.5 hover:bg-indigo-700">Back to Home</Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 sm:px-6 py-4 sm:py-6">
        <div className="rounded-xl bg-white ring-1 ring-gray-200 p-4 sm:p-6 min-h-[60vh]">
          <div className="text-sm text-gray-700 font-medium mb-3">Transcript</div>
          <div className="space-y-6">
            {messages.length === 0 && (
              <div className="text-gray-500 text-sm">No transcript captured for this meeting.</div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "candidate" ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[80%]">
                  <div className="text-[11px] text-gray-500 mb-1">{m.ts}</div>
                  <div className={`${m.role === "candidate" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-900"} rounded-2xl px-3 py-2 whitespace-pre-wrap`}>{m.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
