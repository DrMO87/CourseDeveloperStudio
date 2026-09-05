import { Organization, CourseProject, CourseSession, ProjectDossierFile } from './types';
import { fetchDossierFiles, fetchSessions, supabase } from './supabase';

export async function syncCourseToObsidian(
  organization: Organization | null,
  project: CourseProject | null,
  sessions?: CourseSession[],
  activeSession?: CourseSession | null,
  dossierFiles?: ProjectDossierFile[]
): Promise<{ success: boolean; message: string; syncedCount?: number; error?: string }> {
  if (!project) {
    return { success: false, message: 'No course project selected to sync.' };
  }

  try {
    const sess = (sessions && sessions.length > 0) ? sessions : await fetchSessions(project.id);
    const dossiers = (dossierFiles && dossierFiles.length > 0) ? dossierFiles : await fetchDossierFiles(project.id);

    // The route this calls forwards to Studio's authenticated backend API, so it needs
    // the same bearer token every other backend call uses (see apiClient.ts).
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      return { success: false, message: 'You need to sign in to sync to the vault.' };
    }

    const res = await fetch('/api/obsidian/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        organization,
        project,
        sessions: sess,
        activeSession: activeSession || sess[0] || null,
        dossierFiles: dossiers
      })
    });

    const responseData = await res.json();
    return responseData;
  } catch (err: any) {
    console.error('Failed to sync to Obsidian vault:', err);
    return { success: false, message: err.message || 'Sync failed.' };
  }
}

// Moves NotebookLM's downloaded artifacts (already staged on disk by /api/nlm's
// download_all) into the vault through the backend's canonical writer.
export async function importNlmDownloadsToVault(
  projectId: string,
  notebookIdentifier: string
): Promise<{ success: boolean; message: string }> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      return { success: false, message: 'You need to sign in to import downloads into the vault.' };
    }

    const res = await fetch('/api/obsidian/import-nlm-downloads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ projectId, notebookIdentifier }),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, message: err.message || 'Import failed.' };
  }
}
