import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

const VAULT_ROOT = process.env.VAULT_ROOT ? path.resolve(process.env.VAULT_ROOT) : path.resolve(process.cwd(), '..');

const PARA_CATEGORIES = ['01_Projects', '02_Areas', '03_Resources', '04_Archive'];

function safeSegment(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^[._]+|[._]+$/g, '');
  return cleaned || 'untitled';
}

function classifyFileType(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('blueprint.md')) return 'Session Blueprint';
  if (lower.endsWith('slides-source.md')) return 'Slide Deck Source';
  if (lower.endsWith('home-summary.md')) return 'Student Summary';
  if (lower.endsWith('decisions.md')) return 'Swarm Decision Receipt';
  if (lower.endsWith('sources.md')) return 'Primary Citations';
  if (lower.endsWith('asset-mapping.md')) return 'Asset Manifest';
  if (lower.includes('brand') || lower.includes('contract')) return 'Brand Identity Contract';
  if (lower.includes('mascot')) return 'Mascot Guide';
  if (lower.includes('bloom') || lower.includes('miller') || lower.includes('pedagogy')) return 'Pedagogical Framework';
  if (lower.includes('mcq') || lower.includes('assessment') || lower.includes('rubric')) return 'Assessment Rubric';
  if (lower.includes('course_spec') || lower.includes('specification') || lower.includes('overview')) return 'Course Specification';
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'Markdown Note';
  if (lower.endsWith('.docx') || lower.endsWith('.doc')) return 'Word Document';
  if (lower.endsWith('.pptx') || lower.endsWith('.ppt')) return 'Presentation Deck';
  if (['png', 'jpg', 'jpeg', 'svg', 'webp', 'gif'].some(e => lower.endsWith('.' + e))) return 'Session Visual Asset';
  return 'Vault Asset';
}

function extractSessionCode(filePath: string): string | undefined {
  const match = filePath.match(/(Lec\s*\d+|Session\s*\d+|L\d+)/i);
  return match ? match[1] : undefined;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const categoryParam = searchParams.get('category') || '01_Projects';
    const projectSlug = searchParams.get('projectSlug');
    const onlyNotes = searchParams.get('onlyNotes') === 'true';
    const includeImages = searchParams.get('includeImages') === 'true';
    const excludeAssets = searchParams.get('excludeAssets') !== 'false' && !includeImages;

    const isAll = categoryParam === 'ALL';
    const categoriesToScan = isAll ? PARA_CATEGORIES : [categoryParam];

    if (!isAll && !PARA_CATEGORIES.includes(categoryParam)) {
      return NextResponse.json({ success: false, error: 'Unknown category', files: [] }, { status: 400 });
    }

    const safeSlug = projectSlug ? safeSegment(projectSlug) : null;
    const allDetailedFiles: Array<{
      name: string;
      path: string;
      category: string;
      ext: string;
      type: string;
      sessionCode?: string;
      size?: number;
    }> = [];

    // Helper to recursively walk a directory
    async function scanDir(dir: string, baseDir: string, category: string) {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (entry.name === '.git' || entry.name === '.obsidian' || entry.name === 'node_modules') continue;
            if (excludeAssets && entry.name === '_assets') continue;
            await scanDir(fullPath, baseDir, category);
          } else {
            const relFromBase = path.relative(baseDir, fullPath).replace(/\\/g, '/');
            const ext = path.extname(entry.name).toLowerCase().replace(/^\./, '');
            const isMd = ext === 'md' || ext === 'markdown';
            const isImage = ['png', 'jpg', 'jpeg', 'svg', 'webp', 'gif'].includes(ext);

            if (onlyNotes && !isMd && !(includeImages && isImage)) continue;

            // Compute vault-relative path: e.g. 01_Projects/inst/Lec 01/blueprint.md
            const fullVaultRel = `${category}/${relFromBase}`;

            allDetailedFiles.push({
              name: entry.name,
              path: isAll ? fullVaultRel : relFromBase,
              category,
              ext,
              type: classifyFileType(entry.name),
              sessionCode: extractSessionCode(relFromBase)
            });
          }
        }
      } catch {}
    }

    for (const cat of categoriesToScan) {
      let targetDirs: string[] = [];

      // 1. Project vault directory
      if (safeSlug) {
        const specificDir = path.join(VAULT_ROOT, 'vaults', safeSlug, cat);
        try {
          await fs.access(specificDir);
          targetDirs.push(specificDir);
        } catch {}
      }

      // 2. Scan all project vaults if none found
      if (targetDirs.length === 0) {
        const vaultsDir = path.join(VAULT_ROOT, 'vaults');
        try {
          const entries = await fs.readdir(vaultsDir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory()) {
              const candidate = path.join(vaultsDir, entry.name, cat);
              try {
                await fs.access(candidate);
                targetDirs.push(candidate);
              } catch {}
            }
          }
        } catch {}
      }

      // 3. Fallback to root directory
      if (targetDirs.length === 0) {
        const rootCatDir = path.join(VAULT_ROOT, cat);
        try {
          await fs.access(rootCatDir);
          targetDirs.push(rootCatDir);
        } catch {}
      }

      for (const d of targetDirs) {
        await scanDir(d, d, cat);
      }
    }

    // Also check root Dashboard.md if category is ALL
    if (isAll && safeSlug) {
      const dashboardPath = path.join(VAULT_ROOT, 'vaults', safeSlug, 'Dashboard.md');
      try {
        await fs.access(dashboardPath);
        allDetailedFiles.unshift({
          name: 'Dashboard.md',
          path: 'Dashboard.md',
          category: 'Root',
          ext: 'md',
          type: 'Course Dashboard'
        });
      } catch {}
    }

    // Deduplicate by path
    const seen = new Set<string>();
    const uniqueFiles: string[] = [];
    const uniqueDetailed: typeof allDetailedFiles = [];

    for (const f of allDetailedFiles) {
      if (!seen.has(f.path)) {
        seen.add(f.path);
        uniqueFiles.push(f.path);
        uniqueDetailed.push(f);
      }
    }

    return NextResponse.json({
      success: true,
      category: categoryParam,
      files: uniqueFiles,
      detailedFiles: uniqueDetailed,
      totalCount: uniqueDetailed.length
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message,
      files: [],
      detailedFiles: []
    }, { status: 500 });
  }
}
