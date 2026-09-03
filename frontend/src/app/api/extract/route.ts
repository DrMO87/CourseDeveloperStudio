import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const AdmZip = require('adm-zip');
    const officeParser = require('officeparser');
    
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const projectSlug = formData.get('projectSlug') as string;

    if (!file) return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });

    const ext = file.name.split('.').pop()?.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());
    let extractedText = '';
    let assetPaths: string[] = [];

    if (projectSlug && (ext === 'pptx' || ext === 'docx')) {
      const assetDir = path.join(process.cwd(), '..', 'vaults', projectSlug, '01_Projects', projectSlug, 'Dossier', '_assets');
      try {
        const zip = new AdmZip(buffer);
        fs.mkdirSync(assetDir, { recursive: true });
        zip.getEntries().forEach((zipEntry: any) => {
          if (zipEntry.entryName.startsWith('ppt/media/') || zipEntry.entryName.startsWith('word/media/')) {
            const dest = path.join(assetDir, path.basename(zipEntry.entryName));
            fs.writeFileSync(dest, zipEntry.getData());
            assetPaths.push(dest);
          }
        });
      } catch (err) {
        console.error('Image extraction error', err);
      }
    }

    if (ext === 'pdf') {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      extractedText = data.text;
    } else if (['pptx', 'docx', 'xlsx', 'odt', 'odp', 'ods'].includes(ext || '')) {
      extractedText = await officeParser.parseOffice(buffer);
    } else {
      return NextResponse.json({ success: false, error: 'Unsupported file type' }, { status: 400 });
    }

    if (assetPaths.length > 0) {
      extractedText += `\n\n[SYSTEM NOTE: ${assetPaths.length} media assets (diagrams/chemical structures) were extracted from this presentation and saved to Dossier/_assets/. Ensure to reference them in the slide generation!]`;
    }

    return NextResponse.json({ success: true, text: extractedText, assets: assetPaths.length });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
