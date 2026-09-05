import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Thin auth-forwarding proxy, same pattern as /api/obsidian/sync — the backend's
// ObsidianVaultService is the only component allowed to write into vaults/, so this route
// just forwards the caller's identifiers and bearer token to its sync-nlm-downloads
// endpoint, which copies the files /api/nlm's download_all already staged on disk.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ success: false, message: 'You need to sign in to sync to the vault.' }, { status: 401 });
    }

    const { projectId, notebookIdentifier } = await req.json();
    if (!projectId || !notebookIdentifier) {
      return NextResponse.json({ success: false, message: 'projectId and notebookIdentifier are required.' }, { status: 400 });
    }

    const backendRes = await fetch(`${API_BASE_URL}/api/ObsidianSync/sync-nlm-downloads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify({ projectId, notebookIdentifier }),
    });

    const data = await backendRes.json().catch(() => ({}));
    if (!backendRes.ok) {
      return NextResponse.json({ success: false, message: data?.error || `Backend returned ${backendRes.status}` }, { status: backendRes.status });
    }

    return NextResponse.json({ success: true, record: data });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message || 'Failed to import NotebookLM downloads into the vault.' }, { status: 500 });
  }
}
