"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

function CodeBlock({ children, className }: { children: React.ReactNode; className?: string }) {
  const [copied, setCopied] = React.useState(false);
  const ref = React.useRef<HTMLPreElement>(null);
  const lang = /language-(\w+)/.exec(className ?? "")?.[1];

  const copy = async () => {
    const text = ref.current?.innerText ?? "";
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="group/code relative">
      {lang && (
        <span className="absolute left-3 top-2 font-mono text-[10.5px] uppercase tracking-wide text-[--fg-subtle]">
          {lang}
        </span>
      )}
      <button
        onClick={copy}
        aria-label="Copy code"
        className={cn(
          "absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-[--r-sm]",
          "border border-[--border] bg-[--surface] text-[--fg-muted] opacity-0",
          "transition-opacity duration-[--d-micro] hover:text-[--fg] group-hover/code:opacity-100",
          "focus-visible:opacity-100",
        )}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-[--success]" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
      <pre ref={ref} className={cn(lang && "pt-7")}>
        {children}
      </pre>
    </div>
  );
}

/** Renders @ai and @name mentions as accent chips inside plain text. */
function withMentions(node: React.ReactNode): React.ReactNode {
  if (typeof node !== "string") return node;
  const parts = node.split(/(@[A-Za-z0-9_-]+)/g);
  if (parts.length === 1) return node;
  return parts.map((p, i) =>
    p.startsWith("@") ? (
      <span
        key={i}
        className={cn(
          "rounded px-1 py-px font-medium",
          p.toLowerCase() === "@ai"
            ? "bg-[--accent-subtle] text-[--accent-text]"
            : "bg-[--bg-active] text-[--fg]",
        )}
      >
        {p}
      </span>
    ) : (
      <React.Fragment key={i}>{p}</React.Fragment>
    ),
  );
}

export const Markdown = React.memo(function Markdown({ content }: { content: string }) {
  return (
    <div className="prose-chat">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: ({ children }) => <>{children}</>,
          code: ({ className, children, ...props }) => {
            const isBlock = /language-/.test(className ?? "");
            if (!isBlock) {
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            }
            return (
              <CodeBlock className={className}>
                <code className={className} {...props}>
                  {children}
                </code>
              </CodeBlock>
            );
          },
          p: ({ children }) => (
            <p>{React.Children.map(children, withMentions)}</p>
          ),
          li: ({ children }) => <li>{React.Children.map(children, withMentions)}</li>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
