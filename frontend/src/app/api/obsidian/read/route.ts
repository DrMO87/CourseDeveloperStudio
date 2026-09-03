import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

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
