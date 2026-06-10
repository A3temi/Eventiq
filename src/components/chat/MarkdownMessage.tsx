'use client';

import { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';

interface MarkdownMessageProps {
  content: string;
  isUser?: boolean;
}

/** Extract all URLs from markdown content */
function extractUrls(content: string): string[] {
  const urls: string[] = [];
  // Match markdown links [text](url)
  const mdLinkRegex = /\[(?:[^\]]*)\]\((https?:\/\/[^\s)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = mdLinkRegex.exec(content)) !== null) {
    urls.push(match[1]);
  }
  // Match bare URLs not already inside markdown link syntax
  const bareUrlRegex = /(?<!\]\()https?:\/\/[^\s)>\]]+/g;
  while ((match = bareUrlRegex.exec(content)) !== null) {
    if (!urls.includes(match[0])) {
      urls.push(match[0]);
    }
  }
  return [...new Set(urls)];
}

/** Get domain from URL */
function getDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function MarkdownMessage({ content, isUser }: MarkdownMessageProps) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const urls = useMemo(() => extractUrls(content), [content]);

  return (
    <div className={`text-sm prose prose-sm max-w-none ${isUser ? 'prose-invert' : ''}`}>
      <ReactMarkdown
        components={{
          h1: ({ children }) => <h3 className="text-base font-bold mt-3 mb-1.5 first:mt-0">{children}</h3>,
          h2: ({ children }) => <h4 className="text-sm font-bold mt-3 mb-1.5 first:mt-0">{children}</h4>,
          h3: ({ children }) => <h5 className="text-sm font-semibold mt-2 mb-1 first:mt-0">{children}</h5>,
          p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="text-sm leading-relaxed">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          a: ({ href, children }) => (
            // Render link text only (no visible URL), sources shown below
            <span className="font-medium">{children}</span>
          ),
          code: ({ children }) => (
            <code className="px-1 py-0.5 rounded bg-muted text-xs font-mono">{children}</code>
          ),
          hr: () => <hr className="my-3 border-border/50" />,
        }}
      >
        {content}
      </ReactMarkdown>

      {/* Sources section */}
      {!isUser && urls.length > 0 && (
        <div className="mt-3 pt-2 border-t border-border/40">
          <button
            onClick={() => setSourcesOpen(!sourcesOpen)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <span className="text-[10px]">{sourcesOpen ? '▼' : '▶'}</span>
            Sources ({urls.length})
          </button>
          {sourcesOpen && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {urls.map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-xs hover:bg-accent border border-border/50 text-foreground underline underline-offset-2 transition-colors"
                >
                  🔗 {getDomain(url)}
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
