import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

const VAULT_ROOT = process.env.VAULT_ROOT ? path.resolve(process.env.VAULT_ROOT) : path.resolve(process.cwd(), '..');

function safeSegment(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^[._]+|[._]+$/g, '');
  return cleaned || 'untitled';
}

// Resolves `candidate` and verifies it did not escape VAULT_ROOT
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

async function resolveTargetPath(filePath: string, projectSlug?: string | null): Promise<string | null> {
  // 1. Try project's dedicated vault if specified
  if (projectSlug) {
    const candidate = await containedPath(path.join(VAULT_ROOT, 'vaults', safeSegment(projectSlug), filePath));
    if (candidate) {
      try {
        await fs.access(candidate);
        return candidate;
      } catch {}
    }
  }

  // 2. Try scanning across all vaults in vaults/
  const vaultsDir = path.join(VAULT_ROOT, 'vaults');
  try {
    const entries = await fs.readdir(vaultsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const candidate = await containedPath(path.join(vaultsDir, entry.name, filePath));
        if (!candidate) continue;
        try {
          await fs.access(candidate);
          return candidate;
        } catch {}
      }
    }
  } catch {}

  // 3. Try direct path under workspace root
  const rootCandidate = await containedPath(path.join(VAULT_ROOT, filePath));
  if (rootCandidate) {
    try {
      await fs.access(rootCandidate);
      return rootCandidate;
    } catch {}
  }

  return null;
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

    const targetPath = await resolveTargetPath(filePath, projectSlug);

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { path: filePath, projectSlug, content } = body;

    if (!filePath) {
      return NextResponse.json({ success: false, error: 'path parameter required' }, { status: 400 });
    }
    if (path.isAbsolute(filePath)) {
      return NextResponse.json({ success: false, error: 'Absolute paths are not allowed' }, { status: 400 });
    }
    if (typeof content !== 'string') {
      return NextResponse.json({ success: false, error: 'content must be a string' }, { status: 400 });
    }

    let targetPath = await resolveTargetPath(filePath, projectSlug);

    // If file doesn't exist yet but projectSlug is specified, allow creating within contained bounds
    if (!targetPath && projectSlug) {
      const candidate = path.join(VAULT_ROOT, 'vaults', safeSegment(projectSlug), filePath);
      const contained = path.resolve(candidate).startsWith(VAULT_ROOT);
      if (contained) {
        targetPath = candidate;
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
      }
    }

    if (!targetPath) {
      return NextResponse.json({ success: false, error: `Invalid or unresolvable path: ${filePath}` }, { status: 400 });
    }

    await fs.writeFile(targetPath, content, 'utf8');

    return NextResponse.json({
      success: true,
      path: filePath,
      bytesWritten: content.length,
      message: 'File saved successfully to Obsidian vault on disk'
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message
    }, { status: 500 });
  }
}
