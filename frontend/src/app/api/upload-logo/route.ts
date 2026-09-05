import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const LOGO_TYPES = new Set(['university', 'faculty', 'department', 'primary']);
const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
};
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';

function isSafePathSegment(value: unknown): value is string {
  return typeof value === 'string'
    && /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(value)
    && value !== '.'
    && value !== '..';
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const orgSlug = formData.get('orgSlug');
    const logoType = formData.get('logoType') || 'primary';

    if (!(file instanceof File) || !isSafePathSegment(orgSlug)) {
      return NextResponse.json({ success: false, error: 'Missing file or orgSlug' }, { status: 400 });
    }
    if (typeof logoType !== 'string' || !LOGO_TYPES.has(logoType)) {
      return NextResponse.json({ success: false, error: 'Invalid logoType' }, { status: 400 });
    }

    const ext = IMAGE_EXTENSIONS[file.type];
    if (!ext) {
      return NextResponse.json({ success: false, error: 'Unsupported image type' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const safeFileName = `${orgSlug}-${logoType}-logo.${ext}`;

    // Save to Next.js public directory for instant web preview. This is app asset
    // storage, not a vault write, so it isn't subject to STEP 10's "one canonical vault
    // writer" rule — it's the only filesystem write this route makes directly.
    const publicDir = path.join(process.cwd(), 'public', 'logos', orgSlug);
    fs.mkdirSync(publicDir, { recursive: true });
    const publicFilePath = path.join(publicDir, safeFileName);
    fs.writeFileSync(publicFilePath, buffer);
    const webUrl = `/logos/${orgSlug}/${safeFileName}`;

    // Vault copy goes through the backend's ObsidianVaultService — the one component
    // allowed to write into vaults/ (STEP 10). This route used to copy the logo into the
    // vault directly, bypassing the backend entirely; that write is gone, replaced by this
    // forwarded call, the same auth-forwarding-proxy pattern as /api/obsidian/sync. A sync
    // failure doesn't fail the upload (the web preview above already succeeded) but is
    // reported truthfully, never silently swallowed.
    const authHeader = req.headers.get('authorization');
    let vaultSynced = false;
    let vaultError: string | undefined;
    if (!authHeader) {
      vaultError = 'Not signed in — logo saved for web preview only, not synced to the vault.';
    } else {
      try {
        const backendForm = new FormData();
        backendForm.append('organizationSlug', orgSlug);
        backendForm.append('file', new Blob([buffer], { type: file.type }), safeFileName);
        const backendRes = await fetch(`${API_BASE_URL}/api/ObsidianSync/sync-org-logo`, {
          method: 'POST',
          headers: { Authorization: authHeader },
          body: backendForm,
        });
        if (backendRes.ok) {
          vaultSynced = true;
        } else {
          vaultError = `Vault sync failed: ${backendRes.status} ${(await backendRes.text().catch(() => '')).slice(0, 200)}`;
        }
      } catch (err: any) {
        vaultError = `Vault sync failed: ${err.message || 'network error'}`;
      }
    }

    return NextResponse.json({
      success: true,
      url: webUrl,
      fileName: safeFileName,
      path: publicFilePath,
      vaultSynced,
      vaultError,
    });
  } catch (err: any) {
    console.error('Logo upload error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
  
