import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const projectSlug = formData.get('projectSlug') as string;

    if (!file) return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });

    const ext = file.name.split('.').pop()?.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());
    let extractedText = '';
    let assetPaths: string[] = [];

    const VAULT_ROOT = process.env.VAULT_ROOT ? path.resolve(process.env.VAULT_ROOT) : path.resolve(process.cwd(), '..');

    if (projectSlug) {
      const candidateDirs = [
        path.join(VAULT_ROOT, 'vaults', projectSlug, '01_Projects', projectSlug, 'Dossier', '_assets'),
        path.join('/app/vaults', projectSlug, '01_Projects', projectSlug, 'Dossier', '_assets'),
        path.join(process.cwd(), 'vaults', projectSlug, '01_Projects', projectSlug, 'Dossier', '_assets')
      ];

      for (const assetDir of candidateDirs) {
        try {
          fs.mkdirSync(assetDir, { recursive: true });
          const rawDest = path.join(assetDir, path.basename(file.name));
          fs.writeFileSync(rawDest, buffer);
          assetPaths.push(rawDest);

          if (ext === 'pptx' || ext === 'docx') {
            try {
              const AdmZip = require('adm-zip');
              const zip = new AdmZip(buffer);
              let savedMedia = 0;
              zip.getEntries().forEach((zipEntry: any) => {
                if (savedMedia < 20 && (zipEntry.entryName.startsWith('ppt/media/') || zipEntry.entryName.startsWith('word/media/'))) {
                  try {
                    const dest = path.join(assetDir, path.basename(zipEntry.entryName));
                    fs.writeFileSync(dest, zipEntry.getData());
                    assetPaths.push(dest);
                    savedMedia++;
                  } catch {}
                }
              });
            } catch (zipErr) {
              console.warn('[Extract] Zip media extraction warning:', zipErr);
            }
          }
          break;
        } catch (err) {
          console.warn('[Extract] Asset save warning for', assetDir, err);
        }
      }
    }

    if (ext === 'pptx') {
      try {
        const AdmZip = require('adm-zip');
        const zip = new AdmZip(buffer);
        const entries = zip.getEntries();
        const slideEntries = entries
          .filter((e: any) => /^ppt\/slides\/slide\d+\.xml$/.test(e.entryName))
          .sort((a: any, b: any) => {
            const numA = parseInt(a.entryName.match(/\d+/)?.[0] || '0', 10);
            const numB = parseInt(b.entryName.match(/\d+/)?.[0] || '0', 10);
            return numA - numB;
          });

        const slideTexts: string[] = [];
        for (const entry of slideEntries) {
          const xml = entry.getData().toString('utf8');
          const textMatches = xml.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g) || [];
          const words = textMatches
            .map((m: string) => m.replace(/<[^>]+>/g, '').trim())
            .filter(Boolean);
          if (words.length > 0) {
            const slideNum = entry.entryName.match(/\d+/)?.[0] || '';
            slideTexts.push(`[Slide ${slideNum}]: ${words.join(' ')}`);
          }
        }

        if (slideTexts.length > 0) {
          extractedText = slideTexts.join('\n\n');
        }
      } catch (pptxErr) {
        console.warn('[Extract] PPTX fast XML extraction warning:', pptxErr);
      }
    } else if (ext === 'docx') {
      try {
        const AdmZip = require('adm-zip');
        const zip = new AdmZip(buffer);
        const docEntry = zip.getEntry('word/document.xml');
        if (docEntry) {
          const xml = docEntry.getData().toString('utf8');
          const textMatches = xml.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [];
          const words = textMatches
            .map((m: string) => m.replace(/<[^>]+>/g, '').trim())
            .filter(Boolean);
          if (words.length > 0) {
            extractedText = words.join(' ');
          }
        }
      } catch (docxErr) {
        console.warn('[Extract] DOCX fast XML extraction warning:', docxErr);
      }
    }

    if (!extractedText && ext === 'pdf') {
      try {
        const officeParser = require('officeparser');
        const parseRes = await officeParser.parseOffice(buffer, { fileType: 'pdf' });
        extractedText = typeof parseRes?.toText === 'function' ? parseRes.toText() : (parseRes?.content || String(parseRes || ''));
      } catch (pdfOfficeErr) {
        try {
          const pdfParsePkg = require('pdf-parse');
          const PDFClass = pdfParsePkg.PDFParse || pdfParsePkg.default || pdfParsePkg;
          if (typeof PDFClass === 'function') {
            const parser = new PDFClass();
            const data = await parser.parse(buffer);
            extractedText = data?.text || '';
          }
        } catch (pdfErr) {
          console.warn('[Extract] PDF parse fallback:', pdfErr);
          extractedText = buffer.toString('latin1').replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s+/g, ' ');
        }
      }
    } else if (!extractedText && ['pptx', 'docx', 'xlsx', 'odt', 'odp', 'ods'].includes(ext || '')) {
      try {
        const officeParser = require('officeparser');
        const parseRes = await officeParser.parseOffice(buffer, { fileType: ext });
        extractedText = typeof parseRes?.toText === 'function' ? parseRes.toText() : (parseRes?.content || String(parseRes || ''));
      } catch (officeErr) {
        console.warn('[Extract] Office parse fallback:', officeErr);
        extractedText = `Attached File: ${file.name} (${Math.round(file.size / 1024)} KB)`;
      }
    } else if (!extractedText && ['txt', 'md', 'markdown', 'json', 'csv', 'tsv', 'yaml', 'yml', 'html', 'xml', 'tex', 'py', 'c', 'cpp', 'h'].includes(ext || '')) {
      extractedText = buffer.toString('utf8');
    } else if (!extractedText) {
      extractedText = `Attached File: ${file.name} (${Math.round(file.size / 1024)} KB)`;
    }

    if (assetPaths.length > 0) {
      extractedText += `\n\n[SYSTEM NOTE: ${assetPaths.length} media assets (diagrams/chemical structures) were extracted from this presentation and saved to Dossier/_assets/. Ensure to reference them in the slide generation!]`;
    }

    return NextResponse.json({ success: true, text: extractedText, assets: assetPaths.length });
  } catch (err: any) {
    console.error('[Extract] Upload extraction error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
