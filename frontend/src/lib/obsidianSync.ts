import { Organization, CourseProject, CourseSession, ProjectDossierFile } from './types';
import { fetchDossierFiles, fetchSessions } from './supabase';

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

    const res = await fetch('/api/obsidian/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organization,
        project,
        sessions: sess,
        activeSession: activeSession || sess[0] || null,
        dossierFiles: dossiers
      })
    });

    const data = await res.json();
    return data;
  } catch (err: any) {
    console.error('Failed to sync to Obsidian vault:', err);
    return { success: false, message: err.message || 'Sync failed.' };
  }
}
