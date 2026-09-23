import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const VAULT_ROOT = process.env.VAULT_ROOT
  ? path.resolve(process.env.VAULT_ROOT)
  : path.resolve(process.cwd(), '..');

function isProtectedFolder(name: string): boolean {
  const lower = name.toLowerCase().trim();
  return (
    lower === 'dossier' ||
    lower === '_assets' ||
    lower === 'assets' ||
    lower.startsWith('dossier') ||
    lower === 'course_dossier_intake'
  );
}

function countFilesInDir(dir: string): number {
  let count = 0;
  try {
    if (!fs.existsSync(dir)) return 0;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        count += countFilesInDir(full);
      } else {
        count++;
      }
    }
  } catch {}
  return count;
}

function deleteFolderRecursive(dir: string): number {
  let deletedFiles = 0;
  try {
    if (!fs.existsSync(dir)) return 0;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        deletedFiles += deleteFolderRecursive(full);
      } else {
        fs.unlinkSync(full);
        deletedFiles++;
      }
    }
    fs.rmdirSync(dir);
  } catch (err) {
    console.warn(`[ResetPipeline] Warning deleting ${dir}:`, err);
  }
  return deletedFiles;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectSlug, sessionCode, resetAll = false } = body;

    const slugsToTry = [
      projectSlug,
      projectSlug?.toLowerCase(),
      projectSlug?.replace(/_/g, '-'),
      projectSlug?.replace(/-/g, '_'),
      'inst',
      'Inst-Analysis',
      'inst_analysis',
      'instrumental-analysis-pharmaceutical'
    ].filter(Boolean) as string[];

    const uniqueSlugs = Array.from(new Set(slugsToTry));

    // Gather all candidate project base paths:
    // e.g. vaults/<slug>/01_Projects/<slug> or obsidian-vault-template/01_Projects
    const projectDirs: string[] = [];

    const searchRoots = [
      path.join(VAULT_ROOT, 'vaults'),
      path.join(VAULT_ROOT, 'obsidian-vault-template'),
      path.join(process.cwd(), 'vaults'),
      path.join('/app/vaults')
    ];

    for (const root of searchRoots) {
      try {
        if (!fs.existsSync(root)) continue;

        // Check if root itself has 01_Projects
        const directProjects = path.join(root, '01_Projects');
        if (fs.existsSync(directProjects)) {
          for (const s of uniqueSlugs) {
            const specific = path.join(directProjects, s);
            if (fs.existsSync(specific) && !projectDirs.includes(specific)) {
              projectDirs.push(specific);
            }
          }
          if (!projectDirs.includes(directProjects)) {
            projectDirs.push(directProjects);
          }
        }

        // Check subdirectories (e.g. vaults/Inst-Analysis/01_Projects/...)
        const entries = fs.readdirSync(root, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const subProjects = path.join(root, entry.name, '01_Projects');
            if (fs.existsSync(subProjects)) {
              for (const s of uniqueSlugs) {
                const subSpecific = path.join(subProjects, s);
                if (fs.existsSync(subSpecific) && !projectDirs.includes(subSpecific)) {
                  projectDirs.push(subSpecific);
                }
              }
              if (!projectDirs.includes(subProjects)) {
                projectDirs.push(subProjects);
              }
            }
          }
        }
      } catch {}
    }

    let clearedFilesCount = 0;
    const clearedFolders: string[] = [];
    let preservedDossierFilesCount = 0;

    for (const pDir of projectDirs) {
      try {
        if (!fs.existsSync(pDir)) continue;
        const entries = fs.readdirSync(pDir, { withFileTypes: true });

        for (const entry of entries) {
          const entryPath = path.join(pDir, entry.name);

          // 1. Strictly Protect Dossier and Assets
          if (isProtectedFolder(entry.name)) {
            preservedDossierFilesCount += countFilesInDir(entryPath);
            continue;
          }

          // 2. Decide if this entry is a generated session target
          if (entry.isDirectory()) {
            const isMatch = resetAll || (
              sessionCode && entry.name.toLowerCase().replace(/\s+/g, '') === sessionCode.toLowerCase().replace(/\s+/g, '')
            );

            if (isMatch) {
              const count = deleteFolderRecursive(entryPath);
              clearedFilesCount += count;
              clearedFolders.push(`${path.basename(pDir)}/${entry.name}`);
            }
          } else if (entry.isFile() && resetAll) {
            // Delete root generated course overview / bundle notes if resetting all, but NOT in Dossier
            if (
              entry.name.endsWith('.md') &&
              !entry.name.toLowerCase().includes('dossier') &&
              !entry.name.toLowerCase().includes('blueprint')
            ) {
              try {
                fs.unlinkSync(entryPath);
                clearedFilesCount++;
              } catch {}
            }
          }
        }
      } catch (dirErr) {
        console.warn(`[ResetPipeline] Error scanning ${pDir}:`, dirErr);
      }
    }

    // Also check and count files in 03_Resources/Course_Dossier_Intake to ensure they are preserved
    for (const root of searchRoots) {
      try {
        const intakeDirs = [
          path.join(root, '03_Resources', 'Course_Dossier_Intake'),
          path.join(root, 'Inst-Analysis', '03_Resources', 'Course_Dossier_Intake')
        ];
        for (const id of intakeDirs) {
          if (fs.existsSync(id)) {
            preservedDossierFilesCount += countFilesInDir(id);
          }
        }
      } catch {}
    }

    return NextResponse.json({
      success: true,
      clearedFolders,
      clearedFilesCount,
      preservedDossier: true,
      preservedDossierFilesCount,
      message: `Reset complete: Cleared ${clearedFilesCount} generated session files across ${clearedFolders.length} folder(s). All ${preservedDossierFilesCount} Dossier contents and ingestion files remain safely preserved.`
    });
  } catch (err: any) {
    console.error('[ResetPipeline] Error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to reset pipeline vault files' },
      { status: 500 }
    );
  }
}
