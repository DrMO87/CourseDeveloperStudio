import os

files_route = r'frontend\src\app\api\obsidian\files\route.ts'
with open(files_route, 'w', encoding='utf-8') as f:
    f.write("""import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const VAULT_ROOT = path.resolve('D:/HUE/DEVELOPED SOFTWARE/CourseDeveloperStudio');

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
          const relPath = path.relative(baseDir, fullPath).replace(/\\\\/g, '/');
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
""")

read_route = r'frontend\src\app\api\obsidian\read\route.ts'
with open(read_route, 'w', encoding='utf-8') as f:
    f.write("""import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const COURSE_DEVELOPER_PATH = path.resolve('D:/HUE/DEVELOPED SOFTWARE/CourseDeveloperStudio');

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filePath = searchParams.get('path');
    const projectSlug = searchParams.get('projectSlug');
    if (!filePath) {
      return NextResponse.json({ success: false, error: 'path parameter required' }, { status: 400 });
    }

    let targetPath: string | null = null;

    if (path.isAbsolute(filePath)) {
      try {
        await fs.access(filePath);
        targetPath = filePath;
      } catch {}
    }

    // 1. Try project's dedicated vault if specified
    if (!targetPath && projectSlug) {
      const p = path.join(COURSE_DEVELOPER_PATH, 'vaults', projectSlug, filePath);
      try {
        await fs.access(p);
        targetPath = p;
      } catch {}
    }

    // 2. Try scanning across all vaults in vaults/
    if (!targetPath) {
      const vaultsDir = path.join(COURSE_DEVELOPER_PATH, 'vaults');
      try {
        const entries = await fs.readdir(vaultsDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const candidate = path.join(vaultsDir, entry.name, filePath);
            try {
              await fs.access(candidate);
              targetPath = candidate;
              break;
            } catch {}
          }
        }
      } catch {}
    }

    // 3. Try direct path under workspace root
    if (!targetPath) {
      const candidate = path.join(COURSE_DEVELOPER_PATH, filePath);
      try {
        await fs.access(candidate);
        targetPath = candidate;
      } catch {}
    }

    if (!targetPath) {
      return NextResponse.json({ success: false, error: `File not found on disk: ${filePath}` }, { status: 404 });
    }

    const content = await fs.readFile(targetPath, 'utf8');

    return NextResponse.json({
      success: true,
      path: filePath,
      content
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message
    }, { status: 500 });
  }
}
""")
