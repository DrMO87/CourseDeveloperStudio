'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Copy,
  Check,
  Download,
  FileText,
  Eye,
  Code
} from 'lucide-react';
import { CourseProject, CourseSession, Organization } from '@/lib/types';

interface Props {
  fileName: string | null;
  isOpen: boolean;
  onClose: () => void;
  org?: Organization | null;
  project?: CourseProject | null;
  session?: CourseSession | null;
}

export function ObsidianFileViewerModal({
  fileName,
  isOpen,
  onClose,
  project
}: Props) {
  const [activeTab, setActiveTab] = useState<'RENDERED' | 'RAW'>('RENDERED');
  const [copied, setCopied] = useState(false);
  const [fileContent, setFileContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fileName || !isOpen) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    // STEP 10: this used to synthesize plausible-looking content by matching the
    // filename — the viewer never actually read the file this vault sync wrote. It now
    // reads the real, synced note, which is the whole point of a "one canonical writer".
    const params = new URLSearchParams({ path: fileName });
    if (project?.slug) params.set('projectSlug', project.slug);

    fetch(`/api/obsidian/read?${params.toString()}`)
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;
        if (data.success) {
          setFileContent(data.content ?? '');
        } else {
          setError(data.error || 'Could not read this file.');
          setFileContent('');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Could not read this file.');
          setFileContent('');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [fileName, isOpen, project?.slug]);

  if (!isOpen || !fileName) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(fileContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([fileContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.split('/').pop() || 'document.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white dark:bg-[#001530] border border-slate-200 dark:border-white/10 rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-slate-50/50 dark:bg-black/20 rounded-t-3xl">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/10 dark:bg-gold-400/10 border border-amber-400/30 flex items-center justify-center text-amber-600 dark:text-gold-400 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="truncate">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-display font-bold text-slate-900 dark:text-white truncate">
                  {fileName.split('/').pop()}
                </h3>
                <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-white/70">
                  {fileName.split('.').pop()?.toUpperCase()}
                </span>
              </div>
              <p className="text-xs font-mono text-slate-400 dark:text-white/40 truncate mt-0.5">
                📁 {fileName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center p-1 bg-slate-200/60 dark:bg-black/40 rounded-xl border border-slate-300/40 dark:border-white/5 text-xs">
              <button
                onClick={() => setActiveTab('RENDERED')}
                className={`px-3 py-1 rounded-lg font-display font-bold transition flex items-center gap-1.5 ${
                  activeTab === 'RENDERED'
                    ? 'bg-white dark:bg-white/20 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-white/60 hover:text-slate-900'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Rendered</span>
              </button>
              <button
                onClick={() => setActiveTab('RAW')}
                className={`px-3 py-1 rounded-lg font-display font-bold transition flex items-center gap-1.5 ${
                  activeTab === 'RAW'
                    ? 'bg-white dark:bg-white/20 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-white/60 hover:text-slate-900'
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                <span>Raw Source</span>
              </button>
            </div>

            {/* Copy Button */}
            <button
              onClick={handleCopy}
              className="p-2 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-700 dark:text-white transition"
              title="Copy file content"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>

            {/* Download Button */}
            <button
              onClick={handleDownload}
              className="p-2 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-700 dark:text-white transition"
              title="Download file"
            >
              <Download className="w-4 h-4" />
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-white transition ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Viewer Body */}
        <div className="p-6 overflow-y-auto flex-1 font-sans text-sm leading-relaxed">
          {loading ? (
            <div className="py-16 text-center text-slate-400 animate-pulse">Loading note content...</div>
          ) : error ? (
            <div className="py-16 text-center text-red-500">{error}</div>
          ) : activeTab === 'RAW' ? (
            <pre className="p-4 bg-slate-950 text-slate-200 font-mono text-xs rounded-2xl overflow-x-auto leading-relaxed border border-slate-800">
              <code>{fileContent}</code>
            </pre>
          ) : (
            <div className="prose dark:prose-invert max-w-none space-y-4">
              {renderFormattedContent(fileContent)}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-white/10 flex items-center justify-between text-xs text-slate-500 dark:text-white/50 bg-slate-50/50 dark:bg-black/20 rounded-b-3xl">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Obsidian PARA Vault · Bidirectional Synchronized</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-800 dark:text-white font-display font-bold rounded-xl transition"
          >
            Close Viewer
          </button>
        </div>

      </div>
    </div>
  );
}

// ── Markdown Content Renderer ──

function renderFormattedContent(markdownText: string) {
  const lines = markdownText.split('\n');
  const elements: React.ReactNode[] = [];

  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let inTable = false;
  let tableRows: string[][] = [];

  const flushTable = () => {
    if (tableRows.length > 0) {
      const header = tableRows[0];
      const rows = tableRows.slice(1).filter(r => !r.every(c => c.includes('---')));
      elements.push(
        <div key={`table-${elements.length}`} className="my-4 overflow-x-auto">
          <table className="w-full border-collapse border border-slate-300 dark:border-white/10 text-xs rounded-xl overflow-hidden">
            <thead className="bg-slate-100 dark:bg-white/5 text-slate-900 dark:text-white font-bold">
              <tr>
                {header.map((col, idx) => (
                  <th key={idx} className="border border-slate-300 dark:border-white/10 p-2.5 text-left">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rIdx) => (
                <tr key={rIdx} className="border-b border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="border border-slate-300 dark:border-white/10 p-2 text-slate-700 dark:text-white/80">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
      inTable = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre key={`code-${i}`} className="p-3 bg-slate-950 text-amber-300 font-mono text-xs rounded-xl overflow-x-auto my-3 border border-slate-800">
            <code>{codeBlockContent.join('\n')}</code>
          </pre>
        );
        codeBlockContent = [];
        inCodeBlock = false;
      } else {
        flushTable();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      inTable = true;
      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      tableRows.push(cells);
      continue;
    } else if (inTable) {
      flushTable();
    }

    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={i} className="text-xl font-display font-extrabold text-slate-900 dark:text-white border-b border-slate-200 dark:border-white/10 pb-2 mt-4">
          {line.replace('# ', '')}
        </h1>
      );
    } else if (line.startsWith('## ')) {
      elements.push(
        <h2 key={i} className="text-base font-display font-bold text-amber-600 dark:text-gold-400 mt-4">
          {line.replace('## ', '')}
        </h2>
      );
    } else if (line.startsWith('### ')) {
      elements.push(
        <h3 key={i} className="text-sm font-display font-bold text-slate-800 dark:text-white/90 mt-3">
          {line.replace('### ', '')}
        </h3>
      );
    } else if (line.startsWith('- [ ] ') || line.startsWith('- [x] ')) {
      const isDone = line.startsWith('- [x] ');
      elements.push(
        <div key={i} className="flex items-center gap-2 text-xs text-slate-700 dark:text-white/80 my-1 ml-2">
          <input type="checkbox" checked={isDone} readOnly className="rounded border-slate-300 dark:border-white/20 text-amber-500 focus:ring-0" />
          <span className={isDone ? 'line-through text-slate-400' : ''}>{line.replace(/- \[[ x]\] /, '')}</span>
        </div>
      );
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <li key={i} className="text-xs text-slate-700 dark:text-white/80 ml-4 list-disc my-0.5">
          {line.replace(/^[-*]\s+/, '')}
        </li>
      );
    } else if (line.trim() === '---') {
      elements.push(<hr key={i} className="my-4 border-slate-200 dark:border-white/10" />);
    } else if (line.trim()) {
      elements.push(
        <p key={i} className="text-xs text-slate-700 dark:text-white/80 leading-relaxed my-1.5">
          {line}
        </p>
      );
    }
  }

  flushTable();
  return elements;
}
