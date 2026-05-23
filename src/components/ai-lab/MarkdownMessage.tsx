"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";

interface Props {
  content: string;
  variant: "user" | "assistant";
}

export function MarkdownMessage({ content, variant }: Props) {
  // User messages stay as-is (no markdown rendering) so a user pasting raw
  // markdown sees what they typed; only assistant output is rendered.
  if (variant === "user") {
    return (
      <div className="whitespace-pre-wrap break-words font-sans text-[13px] leading-relaxed">
        {content}
      </div>
    );
  }

  return (
    <div className="markdown-body text-[13px] leading-relaxed break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline hover:opacity-80"
            >
              {children}
            </a>
          ),
          code: ({ className, children, ...rest }) => {
            const isInline = !className?.includes("language-");
            if (isInline) {
              return (
                <code
                  className="px-1.5 py-0.5 rounded bg-foreground/10 text-[12.5px] font-mono"
                  {...rest}
                >
                  {children}
                </code>
              );
            }
            return (
              <code className={className} {...rest}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="my-2 p-3 rounded-lg overflow-x-auto bg-[#0d1117] text-[12.5px] font-mono">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto">
              <table className="w-full border-collapse text-[12.5px]">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-divider px-2 py-1 text-left font-semibold bg-foreground/5">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-divider px-2 py-1">{children}</td>
          ),
          ul: ({ children }) => (
            <ul className="my-1.5 pl-5 list-disc space-y-0.5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-1.5 pl-5 list-decimal space-y-0.5">{children}</ol>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-2 pl-3 border-l-2 border-divider text-foreground-secondary italic">
              {children}
            </blockquote>
          ),
          h1: ({ children }) => (
            <h1 className="text-[16px] font-bold mt-3 mb-1.5">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-[15px] font-bold mt-3 mb-1.5">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-[14px] font-semibold mt-2.5 mb-1">{children}</h3>
          ),
          p: ({ children }) => <p className="my-1.5">{children}</p>,
          hr: () => <hr className="my-3 border-divider" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
