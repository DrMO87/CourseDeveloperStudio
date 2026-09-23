import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// STEP 10 / Engine Alignment: The .NET backend (ObsidianVaultService behind ObsidianSyncController)
// is the single canonical vault writer. This route forwards client-authenticated sync requests
// to the backend, ensuring zero fabricated or dummy content is written to disk.
const API_BASE_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ success: false, message: 'You need to sign in to sync to the vault.' }, { status: 401 });
    }

    const body = await req.json();
    const { project, sessions = [], activeSession, dossierFiles = [] } = body;

    if (!project?.id) {
      return NextResponse.json({ success: false, message: 'No course project selected to sync.' }, { status: 400 });
    }

    const sessionsToSync = sessions.length > 0 ? sessions : (activeSession ? [activeSession] : []);
    const syncedFiles: string[] = [];
    const errors: string[] = [];

    // 1. Sync Sessions via Canonical Backend Writer
    for (const session of sessionsToSync) {
      const result = await forwardToBackend('sync-session', { ...session, project_id: session.project_id || project.id }, authHeader);
      if (result.ok) {
        syncedFiles.push(`vault-relative-path:${result.data?.vault_relative_path ?? session.session_code}`);
      } else {
        errors.push(`session ${session.session_code || session.id}: ${result.error}`);
      }
    }

    // 2. Sync Ingested Dossier Files via Canonical Backend Writer
    for (const file of dossierFiles) {
      const result = await forwardToBackend('sync-dossier-file', { ...file, project_id: file.project_id || project.id }, authHeader);
      if (result.ok) {
        syncedFiles.push(`vault-relative-path:${result.data?.vault_relative_path ?? file.file_name}`);
      } else {
        errors.push(`dossier file ${file.file_name || file.id}: ${result.error}`);
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      message: errors.length === 0
        ? `Successfully synchronized ${syncedFiles.length} file(s) to the Obsidian vault.`
        : `Synced ${syncedFiles.length} file(s), ${errors.length} failed.`,
      syncedCount: syncedFiles.length,
      syncedFiles,
      error: errors.length > 0 ? errors.join('; ') : undefined,
    });
  } catch (err: any) {
    console.error('Obsidian Sync Error:', err);
    return NextResponse.json({
      success: false,
      error: err.message || 'Failed to sync files to the Obsidian vault'
    }, { status: 500 });
  }
}

async function forwardToBackend(
  endpoint: string,
  payload: unknown,
  authHeader: string
): Promise<{ ok: true; data: any } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/ObsidianSync/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, error: `${res.status} ${text || res.statusText}` };
    }
    return { ok: true, data: await res.json() };
  } catch (err: any) {
    return { ok: false, error: err.message || 'network error' };
  }
}
