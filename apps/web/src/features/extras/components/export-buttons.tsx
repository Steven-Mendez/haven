'use client';

import { Check, Copy, Download } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { exportRulesConfig } from '../actions';

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Downloads the full config of a rules version (to load it on a phone by hand). */
export function ExportJsonButton({
  versionId,
  filename,
  labels,
  iconOnly,
}: {
  versionId: string;
  filename: string;
  labels: { idle: string; busy: string; failed: string };
  /** Icon button (label kept as accessible name and tooltip). */
  iconOnly?: boolean;
}) {
  const [state, setState] = useState<'idle' | 'busy' | 'failed'>('idle');
  return (
    <Button
      variant="ghost"
      size={iconOnly ? 'icon-sm' : 'sm'}
      aria-label={iconOnly ? labels[state] : undefined}
      title={iconOnly ? labels[state] : undefined}
      disabled={state === 'busy'}
      onClick={async () => {
        setState('busy');
        try {
          const json = await exportRulesConfig(versionId);
          if (!json) throw new Error('missing');
          download(filename, json, 'application/json');
          setState('idle');
        } catch {
          setState('failed');
        }
      }}
    >
      <Download data-icon={iconOnly ? undefined : 'inline-start'} />
      {iconOnly ? null : labels[state]}
    </Button>
  );
}

/** Downloads rows as CSV (header first). */
export function ExportCsvButton({
  filename,
  header,
  rows,
  label,
}: {
  filename: string;
  header: string[];
  rows: (string | number)[][];
  label: string;
}) {
  const csv = [header, ...rows]
    .map((r) => r.map((c) => (/[",\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : c)))
    .map((r) => r.join(','))
    .join('\n');
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={rows.length === 0}
      onClick={() => download(filename, `${csv}\n`, 'text/csv')}
    >
      <Download data-icon="inline-start" />
      {label}
    </Button>
  );
}

export function CopyButton({
  value,
  labels,
}: {
  value: string;
  labels: { copy: string; copied: string };
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
      {copied ? labels.copied : labels.copy}
    </Button>
  );
}
