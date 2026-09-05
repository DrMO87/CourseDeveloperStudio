import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// STEP 10: this route used to be its own independent vault writer — it wrote directly to
// disk with fabricated fallback curriculum content whenever real session markdown wasn't
// present, competing with the .NET backend's ObsidianVaultService. The backend is now the
// one canonical writer; this route only forwards the caller's already-fetched data to it,
// carrying the caller's own auth token through (every backend endpoint requires one).
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ success: false, message: 'You need to sign in to sync to the vault.' }, { status: 401 });
    }

    const body = await req.json();
    const { project, sessions = [], activeSession, dossierFiles = [] } = body;

    if (!project?.id) {
      return NextResponse.json({ success: false, message: 'No course project selected to sync.' });
    }

    const sessionsToSync = sessions.length > 0 ? sessions : (activeSession ? [activeSession] : []);
    const syncedFiles: string[] = [];
    const errors: string[] = [];

    for (const session of sessionsToSync) {
      const result = await forwardToBackend('sync-session', { ...session, project_id: session.project_id || project.id }, authHeader);
      if (result.ok) syncedFiles.push(`vault-relative-path:${result.data?.vault_relative_path ?? session.session_code}`);
      else errors.push(`session ${session.session_code || session.id}: ${result.error}`);
    }

    for (const file of dossierFiles) {
      const result = await forwardToBackend('sync-dossier-file', { ...file, project_id: file.project_id || project.id }, authHeader);
      if (result.ok) syncedFiles.push(`vault-relative-path:${result.data?.vault_relative_path ?? file.file_name}`);
      else errors.push(`dossier file ${file.file_name || file.id}: ${result.error}`);
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
