import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

const VAULT_ROOT = process.env.VAULT_ROOT ? path.resolve(process.env.VAULT_ROOT) : path.resolve(process.cwd(), '..');

function safeSegment(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^[._]+|[._]+$/g, '');
  return cleaned || 'untitled';
}

// Resolves `candidate` and verifies it did not escape VAULT_ROOT — a bare relative
// filePath query param must never be able to read anything outside the vault (this used
// to also accept an absolute path unconditionally, which was an arbitrary-file-read).
async function containedPath(candidate: string): Promise<string | null> {
  const resolved = path.resolve(candidate);
  const rootWithSep = VAULT_ROOT.endsWith(path.sep) ? VAULT_ROOT : VAULT_ROOT + path.sep;
  if (resolved !== VAULT_ROOT && !resolved.startsWith(rootWithSep)) return null;

  try {
    const [realRoot, realCandidate] = await Promise.all([fs.realpath(VAULT_ROOT), fs.realpath(resolved)]);
    const relative = path.relative(realRoot, realCandidate);
    return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
      ? realCandidate
      : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filePath = searchParams.get('path');
    const projectSlug = searchParams.get('projectSlug');
    if (!filePath) {
      return NextResponse.json({ success: false, error: 'path parameter required' }, { status: 400 });
    }
    if (path.isAbsolute(filePath)) {
      return NextResponse.json({ success: false, error: 'Absolute paths are not allowed' }, { status: 400 });
    }

    let targetPath: string | null = null;

    // 1. Try project's dedicated vault if specified
    if (!targetPath && projectSlug) {
      const candidate = await containedPath(path.join(VAULT_ROOT, 'vaults', safeSegment(projectSlug), filePath));
      if (candidate) {
        try {
          await fs.access(candidate);
          targetPath = candidate;
        } catch {}
      }
    }

    // 2. Try scanning across all vaults in vaults/
    if (!targetPath) {
      const vaultsDir = path.join(VAULT_ROOT, 'vaults');
      try {
        const entries = await fs.readdir(vaultsDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const candidate = await containedPath(path.join(vaultsDir, entry.name, filePath));
            if (!candidate) continue;
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
      const candidate = await containedPath(path.join(VAULT_ROOT, filePath));
      if (candidate) {
        try {
          await fs.access(candidate);
          targetPath = candidate;
        } catch {}
      }
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
