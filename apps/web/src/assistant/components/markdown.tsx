'use client';

import Link from 'next/link';
import { memo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

const components: Components = {
  h1: ({ children }) => <h2 className="mt-5 mb-2 text-lg font-semibold first:mt-0">{children}</h2>,
  h2: ({ children }) => (
    <h3 className="mt-5 mb-2 text-base font-semibold first:mt-0">{children}</h3>
  ),
  h3: ({ children }) => (
    <h4 className="mt-4 mb-1.5 text-sm font-semibold first:mt-0">{children}</h4>
  ),
  h4: ({ children }) => <h5 className="mt-3 mb-1 text-sm font-medium first:mt-0">{children}</h5>,
  p: ({ children }) => <p className="my-2.5 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => (
    <ul className="marker:text-tertiary my-2.5 list-disc space-y-1 pl-5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="marker:text-tertiary my-2.5 list-decimal space-y-1 pl-5">{children}</ol>
  ),
  li: ({ children }) => <li className="pl-0.5 [&>p]:my-1">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  hr: () => <hr className="my-5" />,
  blockquote: ({ children }) => (
    <blockquote className="text-muted-foreground my-3 border-l-2 pl-3">{children}</blockquote>
  ),
  a: ({ href = '', children }) =>
    href.startsWith('/') && !href.startsWith('//') ? (
      <Link href={href} className="text-link underline underline-offset-4">
        {children}
      </Link>
    ) : (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-link underline underline-offset-4"
      >
        {children}
      </a>
    ),
  code: ({ className, children }) =>
    className?.startsWith('language-') ? (
      <code className={className}>{children}</code>
    ) : (
      <code className="bg-muted rounded-sm px-1 py-0.5 font-mono text-[0.85em]">{children}</code>
    ),
  pre: ({ children }) => (
    <pre className="bg-surface my-3 overflow-x-auto rounded-lg border p-3 font-mono text-xs leading-relaxed">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="bg-card my-3 w-fit max-w-full min-w-[min(100%,34rem)] overflow-x-auto rounded-lg border">
      <table className="w-full border-collapse text-left text-xs tabular-nums">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-surface/60">{children}</thead>,
  th: ({ children }) => (
    <th className="text-muted-foreground h-8 border-b px-3 font-medium whitespace-nowrap">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-border-subtle border-b px-3 py-1.5 align-top [tr:last-child>&]:border-b-0">
      {children}
    </td>
  ),
};

/** The model's Markdown as page typography. Raw HTML in it is never rendered. */
export const Markdown = memo(function Markdown({ text }: { text: string }) {
  return (
    <div className="text-sm leading-relaxed break-words [&>:not(div,pre)]:max-w-[80ch]">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
});
