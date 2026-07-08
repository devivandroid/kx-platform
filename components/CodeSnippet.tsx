"use client";

import { useState } from "react";

type CodeSnippetProps = {
  code: string;
  language?: string;
};

export function CodeSnippet({ code, language = "TypeScript" }: CodeSnippetProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-black shadow-glow">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <svg
            aria-hidden="true"
            className="h-4 w-4 text-slate-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m10 16-4-4 4-4" />
            <path strokeLinecap="round" strokeLinejoin="round" d="m14 8 4 4-4 4" />
          </svg>
          <span>{language}</span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-md border border-transparent p-1.5 text-slate-300 transition hover:border-white/10 hover:bg-white/10 hover:text-white"
          aria-label={copied ? "Code copied" : "Copy code"}
          title={copied ? "Copied" : "Copy code"}
        >
          {copied ? (
            <svg
              aria-hidden="true"
              className="h-4 w-4 text-brand-cyan"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
            </svg>
          ) : (
            <svg
              aria-hidden="true"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect width="13" height="13" x="8" y="3" rx="2" />
              <path d="M5 8H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1" />
            </svg>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto px-5 py-4 text-[13px] leading-7 text-white">
        <code>
          <span className="text-[#ffb86c]">const</span>{" "}
          <span className="text-[#f8f8f2]">trust</span>{" "}
          <span className="text-[#ff79c6]">=</span>{" "}
          <span className="text-[#ffb86c]">await</span>{" "}
          <span className="text-[#8be9fd]">client</span>
          <span className="text-[#f8f8f2]">.</span>
          <span className="text-[#50fa7b]">trust</span>
          <span className="text-[#f8f8f2]">(</span>
          <span className="text-[#bd93f9]">wallet</span>
          <span className="text-[#f8f8f2]">);</span>
          <br />
          <br />
          <span className="text-[#ff79c6]">if</span>{" "}
          <span className="text-[#f8f8f2]">(</span>
          <span className="text-[#f8f8f2]">trust</span>
          <span className="text-[#f8f8f2]">.</span>
          <span className="text-[#50fa7b]">allow</span>
          <span className="text-[#f8f8f2]">) {"{"}</span>
          <br />
          <span className="pl-6 text-[#8be9fd]">continueTransaction</span>
          <span className="text-[#f8f8f2]">();</span>
          <br />
          <span className="text-[#f8f8f2]">{"}"}</span>
        </code>
      </pre>
    </div>
  );
}
