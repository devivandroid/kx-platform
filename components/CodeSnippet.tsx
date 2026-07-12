"use client";

import { useState } from "react";

type CodeSnippetProps = {
  code: string;
  language?: string;
};

function getTokenClass(token: string) {
  if (["const", "await", "if", "return"].includes(token)) return "text-[#ffb86c]";
  if (["client", "continueTransaction", "buyer", "seller", "wallet"].includes(token)) {
    return "text-[#8be9fd]";
  }
  if (["trust", "evaluateInteraction", "allow"].includes(token)) return "text-[#50fa7b]";
  if (/^"[^"]*"$/.test(token)) return "text-[#f1fa8c]";
  if (/^[{}()[\],.:;=]$/.test(token)) return "text-[#ff79c6]";
  return "text-[#f8f8f2]";
}

function renderHighlightedLine(line: string, index: number) {
  const leadingWhitespace = line.match(/^\s*/)?.[0] ?? "";
  const content = line.slice(leadingWhitespace.length);
  const tokens = content.match(/"[^"]*"|[A-Za-z_$][\w$]*|[{}()[\],.:;=]/g) ?? [];
  let cursor = 0;

  return (
    <span key={`${line}-${index}`}>
      {leadingWhitespace}
      {tokens.map((token, tokenIndex) => {
        const start = content.indexOf(token, cursor);
        const gap = content.slice(cursor, start);
        cursor = start + token.length;

        return (
          <span key={`${token}-${tokenIndex}`}>
            {gap}
            <span className={getTokenClass(token)}>{token}</span>
          </span>
        );
      })}
      {content.slice(cursor)}
    </span>
  );
}

export function CodeSnippet({ code, language = "TypeScript" }: CodeSnippetProps) {
  const [copied, setCopied] = useState(false);
  const lines = code.split("\n");

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
          {lines.map((line, index) => (
            <span key={`${line}-${index}`}>
              {renderHighlightedLine(line, index)}
              {index < lines.length - 1 ? <br /> : null}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}
