import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const VAULT_ROOT = process.env.VAULT_ROOT ? path.resolve(process.env.VAULT_ROOT) : path.resolve(process.cwd(), '..');

function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'gif': return 'image/gif';
    case 'svg': return 'image/svg+xml';
    case 'webp': return 'image/webp';
    case 'ico': return 'image/x-icon';
    case 'bmp': return 'image/bmp';
    default: return 'application/octet-stream';
  }
}

function findAssetDirs(projectSlug?: string | null): string[] {
  const dirs: string[] = [];
  const slugsToTry = [
    projectSlug,
    projectSlug?.toLowerCase(),
    projectSlug?.replace(/-/g, '_'),
    projectSlug?.replace(/_/g, '-'),
    'inst_analysis',
    'Inst-Analysis'
  ].filter(Boolean) as string[];

  const uniqueSlugs = Array.from(new Set(slugsToTry));

  for (const slug of uniqueSlugs) {
    const candidates = [
      path.join(VAULT_ROOT, 'vaults', slug, '01_Projects', slug, 'Dossier', '_assets'),
      path.join('/app/vaults', slug, '01_Projects', slug, 'Dossier', '_assets'),
      path.join(process.cwd(), 'vaults', slug, '01_Projects', slug, 'Dossier', '_assets'),
      path.join(VAULT_ROOT, 'vaults', slug, 'Dossier', '_assets'),
      path.join('/app/vaults', slug, 'Dossier', '_assets'),
      path.join(process.cwd(), 'vaults', slug, 'Dossier', '_assets'),
    ];

    for (const c of candidates) {
      try {
        if (fs.existsSync(c) && fs.statSync(c).isDirectory()) {
          if (!dirs.includes(c)) dirs.push(c);
        }
      } catch {}
    }
  }

  // Also scan all vaults for any folder named _assets
  try {
    const vaultsBase = [
      path.join(VAULT_ROOT, 'vaults'),
      path.join('/app/vaults'),
      path.join(process.cwd(), 'vaults')
    ];
    for (const vb of vaultsBase) {
      if (fs.existsSync(vb)) {
        const entries = fs.readdirSync(vb, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const possible = path.join(vb, entry.name, '01_Projects', entry.name, 'Dossier', '_assets');
            if (fs.existsSync(possible) && !dirs.includes(possible)) dirs.push(possible);
          }
        }
      }
    }
  } catch {}

  return dirs;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectSlug = searchParams.get('projectSlug') || 'inst_analysis';
    const assetName = searchParams.get('name');

    const assetDirs = findAssetDirs(projectSlug);

    // 1. Serving a specific image binary
    if (assetName) {
      const sanitizedName = path.basename(assetName);
      for (const dir of assetDirs) {
        const fullPath = path.join(dir, sanitizedName);
        if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
          const fileBuffer = fs.readFileSync(fullPath);
          const mime = getMimeType(sanitizedName);
          return new NextResponse(fileBuffer, {
            headers: {
              'Content-Type': mime,
              'Cache-Control': 'public, max-age=86400, stale-while-revalidate=43200'
            }
          });
        }
      }

      return NextResponse.json({ success: false, error: `Asset not found: ${sanitizedName}` }, { status: 404 });
    }

    // 2. Listing all assets
    const seenNames = new Set<string>();
    const assetsList: Array<{
      name: string;
      size: number;
      ext: string;
      url: string;
      modified: string;
    }> = [];

    for (const dir of assetDirs) {
      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (seenNames.has(file)) continue;
          const fullPath = path.join(dir, file);
          try {
            const stat = fs.statSync(fullPath);
            if (stat.isFile()) {
              seenNames.add(file);
              const ext = file.split('.').pop()?.toLowerCase() || '';
              assetsList.push({
                name: file,
                size: stat.size,
                ext,
                url: `/api/dossier/assets?projectSlug=${encodeURIComponent(projectSlug)}&name=${encodeURIComponent(file)}`,
                modified: stat.mtime.toISOString()
              });
            }
          } catch {}
        }
      } catch {}
    }

    // Sort numerically / alphabetically
    assetsList.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

    return NextResponse.json({
      success: true,
      projectSlug,
      count: assetsList.length,
      assets: assetsList
    });
  } catch (err: any) {
    console.error('[Assets API Error]', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
