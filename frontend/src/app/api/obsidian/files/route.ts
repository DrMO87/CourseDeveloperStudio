import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

const VAULT_ROOT = process.env.VAULT_ROOT ? path.resolve(process.env.VAULT_ROOT) : path.resolve(process.cwd(), '..');

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') || '01_Projects';
    const projectSlug = searchParams.get('projectSlug');

    let targetDirs: string[] = [];
    
    // 1. If projectSlug is given, check that specific project vault first
    if (projectSlug) {
      const specificDir = path.join(VAULT_ROOT, 'vaults', projectSlug, category);
      try {
        await fs.access(specificDir);
        targetDirs.push(specificDir);
      } catch {}
    }

    // 2. If no targetDirs found yet, check all vaults under vaults/
    if (targetDirs.length === 0) {
      const vaultsDir = path.join(VAULT_ROOT, 'vaults');
      try {
        const entries = await fs.readdir(vaultsDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const candidate = path.join(vaultsDir, entry.name, category);
            try {
              await fs.access(candidate);
              targetDirs.push(candidate);
            } catch {}
          }
        }
      } catch {}
    }

    // 3. Fallback to root category if exists
    if (targetDirs.length === 0) {
      const rootCatDir = path.join(VAULT_ROOT, category);
      try {
        await fs.access(rootCatDir);
        targetDirs.push(rootCatDir);
      } catch {}
    }

    if (targetDirs.length === 0) {
      return NextResponse.json({ success: true, category, files: [] });
    }

    async function getFilesRecursively(dir: string, baseDir: string): Promise<string[]> {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const files: string[] = [];
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          const subFiles = await getFilesRecursively(fullPath, baseDir);
          files.push(...subFiles);
        } else {
          const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
          files.push(relPath);
        }
      }
      return files;
    }

    const allFilesSet = new Set<string>();
    for (const d of targetDirs) {
      const files = await getFilesRecursively(d, d);
      files.forEach(f => allFilesSet.add(f));
    }

    return NextResponse.json({
      success: true,
      category,
      files: Array.from(allFilesSet)
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message,
      files: []
    }, { status: 500 });
  }
}
