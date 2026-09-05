import { NextRequest, NextResponse } from 'next/server';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execFileAsync = promisify(execFile);

const VAULT_ROOT = process.env.VAULT_ROOT ? path.resolve(process.env.VAULT_ROOT) : path.resolve(process.cwd(), '..');
const defaultNlmPath = path.resolve(VAULT_ROOT, '.venv/Scripts/nlm.exe');

function safeSegment(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^[._]+|[._]+$/g, '');
  return cleaned || 'untitled';
}
const NLM_EXE = process.env.NLM_EXE || (fs.existsSync(defaultNlmPath) ? defaultNlmPath : 'nlm');

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, notebookName, notebookId, filePath, instructions, projectSlug } = body;

    let args: string[] = [];
    let timeout = 30_000;
    let notebookIdentifierUsed: string | undefined;

    let resolvedId = notebookId;
    if (!resolvedId && notebookName && !['create_notebook', 'list_notebooks', 'live_auth_check', 'doctor', 'launch_login'].includes(action)) {
      try {
        const { stdout } = await execFileAsync(NLM_EXE, ['notebook', 'list', '--json'], { cwd: VAULT_ROOT, timeout: 15_000, env: { ...process.env, NO_COLOR: '1' } });
        const nbList = JSON.parse(stdout || '[]');
        const match = nbList.find((n: any) => n.title === notebookName);
        if (match) resolvedId = match.id;
      } catch (e) {
        console.error('[NLM] Pre-resolve failed:', e);
      }
    }

    switch (action) {
      // ─── LIVE Auth Check: actually calls list_notebooks to verify session is alive ───
      case 'live_auth_check':
        args = ['notebook', 'list', '--json'];
        timeout = 15_000;
        break;

      // ─── Doctor: diagnostic only (cookie presence, profile info) ───
      case 'doctor':
        args = ['doctor'];
        break;

      // ─── Fast Direct Cookie / cURL Session Import ───
      case 'import_cookies': {
        const cookieText = body.cookieText || body.payload?.cookieText;
        if (!cookieText || typeof cookieText !== 'string' || !cookieText.trim()) {
          return NextResponse.json({ success: false, error: 'Please paste a valid cURL command or Cookie header string' }, { status: 400 });
        }
        const tempPath = path.resolve(VAULT_ROOT, 'temp_cookies.txt');
        fs.writeFileSync(tempPath, cookieText.trim(), 'utf8');
        args = ['login', '--manual', '--file', tempPath];
        timeout = 20_000;
        break;
      }

      // ─── Launch Login: Playwright Edge authentication window ───
      case 'launch_login': {
        const batPath = path.resolve(VAULT_ROOT, 'run_login.bat');
        const batLines = [
          '@echo off',
          'title NotebookLM Google Authentication Helper',
          'cls',
          'echo ========================================================',
          'echo   NotebookLM Google Sign-In (Dedicated Window)',
          'echo ========================================================',
          'echo.',
          'echo Cleaning stale browser lockfiles...',
          'del /f /q "%USERPROFILE%\\.notebooklm-mcp-cli\\chrome-profiles\\default\\lockfile" >nul 2>&1',
          'del /f /q "%USERPROFILE%\\.notebooklm-mcp-cli\\chrome-profiles\\default\\SingletonLock" >nul 2>&1',
          'del /f /q "%USERPROFILE%\\.notebooklm-mcp-cli\\chrome-port-map.json" >nul 2>&1',
          'echo.',
          'echo Launching Microsoft Edge for Google Sign-In...',
          'echo Please complete your sign-in in the opened browser window.',
          'echo.',
          `"${NLM_EXE}" login`,
          'echo.',
          'echo ========================================================',
          'echo   Sign-in complete! Return to Course Developer Studio',
          'echo   and click "Verify Auth".',
          'echo ========================================================',
          'pause',
        ];
        fs.writeFileSync(batPath, batLines.join('\r\n'), 'utf8');

        // Use cmd.exe start to open a visible, interactive command prompt
        const ps = spawn('cmd.exe', ['/c', 'start', 'NotebookLM Sign-In', batPath], {
          detached: true,
          stdio: 'ignore',
          windowsHide: false
        });
        ps.unref();
        ps.on('error', () => {});

        return NextResponse.json({
          success: true,
          action: 'launch_login',
          output: 'Authentication helper started in a visible CMD window. Follow prompts in the window, then click Verify Auth.'
        });
      }

      case 'list_notebooks':
        args = ['notebook', 'list', '--json'];
        break;

      case 'create_notebook':
        if (!notebookName) return NextResponse.json({ success: false, error: 'notebookName required' }, { status: 400 });
        args = ['notebook', 'create', notebookName];
        timeout = 20_000;
        break;

      case 'add_source_file': {
        let identifier = resolvedId || notebookName;
        if (!identifier || !filePath) return NextResponse.json({ success: false, error: 'notebookName/id and filePath required' }, { status: 400 });

        let targetPath = filePath;

        // If file not directly found at filePath, search inside the project's dedicated Obsidian Vault
        if (!fs.existsSync(targetPath)) {
          const fileName = path.basename(filePath);
          const dirName = path.basename(path.dirname(filePath));
          const pSlug = projectSlug || 'instrumental-analysis-pharmaceutical';

          const candidates = [
            path.join(VAULT_ROOT, 'vaults', pSlug, '01_Projects', pSlug, dirName, fileName),
            path.join(VAULT_ROOT, 'vaults', pSlug, '01_Projects', pSlug, 'Dossier', fileName),
            path.join(VAULT_ROOT, 'vaults', pSlug, '01_Projects', pSlug, 'Dossier', `${fileName}.md`),
            path.join(VAULT_ROOT, 'vaults', pSlug, '03_Resources', 'Course_Dossier_Intake', 'COURSE_SPEC', fileName),
            path.join(VAULT_ROOT, 'vaults', pSlug, '03_Resources', 'Course_Dossier_Intake', 'EXAM_BLUEPRINT', fileName),
            path.join(VAULT_ROOT, 'vaults', pSlug, '03_Resources', 'Course_Dossier_Intake', 'REFERENCE_EVIDENCE', fileName),
            path.join(VAULT_ROOT, 'vaults', pSlug, '03_Resources', 'Course_Dossier_Intake', 'QUESTION_BANK', fileName),
            path.join(VAULT_ROOT, 'vaults', pSlug, '02_Areas', 'horus-pharmacy', fileName),
          ];

          const found = candidates.find(c => fs.existsSync(c));
          if (found) {
            targetPath = found;
          } else {
            // STEP 10: this used to write a fabricated placeholder note into the vault so
            // the NotebookLM upload would "succeed" — a second vault writer, and exactly
            // the invented filler content that step forbids. Fail loudly instead: the
            // caller needs to know the real source file doesn't exist yet, not upload a
            // fake one to NotebookLM.
            return NextResponse.json({
              success: false,
              error: `Source file not found in the vault: ${fileName}. Sync the course to the vault before adding it as a NotebookLM source.`,
            }, { status: 404 });
          }
        }

        args = ['source', 'add', identifier, '--file', targetPath];
        timeout = 60_000;
        break;
      }

      case 'add_source_text': {
        const identifier = resolvedId || notebookName;
        if (!identifier || !instructions) return NextResponse.json({ success: false, error: 'notebookName/id and instructions required' }, { status: 400 });
        args = ['source', 'add', identifier, '--text', instructions];
        timeout = 30_000;
        break;
      }

      case 'generate_slides': {
        const identifier = resolvedId || notebookName;
        if (!identifier) return NextResponse.json({ success: false, error: 'notebookName/id required' }, { status: 400 });
        args = ['slides', 'create', identifier, '--confirm'];
        if (instructions) args.push('--focus', instructions);
        timeout = 90_000;
        break;
      }

      case 'generate_podcast':
      case 'generate_audio': {
        const identifier = resolvedId || notebookName;
        if (!identifier) return NextResponse.json({ success: false, error: 'notebookName/id required' }, { status: 400 });
        args = ['audio', 'create', identifier, '--confirm'];
        if (instructions) args.push('--focus', instructions);
        timeout = 180_000; // Podcast generation takes longer
        break;
      }

      case 'generate_quiz': {
        const identifier = resolvedId || notebookName;
        if (!identifier) return NextResponse.json({ success: false, error: 'notebookName/id required' }, { status: 400 });
        args = ['quiz', 'create', identifier, '--confirm'];
        timeout = 60_000;
        break;
      }

      case 'generate_flashcards': {
        const identifier = resolvedId || notebookName;
        if (!identifier) return NextResponse.json({ success: false, error: 'notebookName/id required' }, { status: 400 });
        args = ['flashcards', 'create', identifier, '--confirm'];
        timeout = 60_000;
        break;
      }

      case 'generate_mindmap': {
        const identifier = resolvedId || notebookName;
        if (!identifier) return NextResponse.json({ success: false, error: 'notebookName/id required' }, { status: 400 });
        args = ['mindmap', 'create', identifier, '--confirm'];
        timeout = 60_000;
        break;
      }

      case 'list_artifacts': {
        const identifier = resolvedId || notebookName;
        if (!identifier) return NextResponse.json({ success: false, error: 'notebookName/id required' }, { status: 400 });
        args = ['studio', 'list', identifier, '--json'];
        break;
      }

      case 'download_all': {
        const identifier = resolvedId || notebookId || notebookName;
        if (!identifier) return NextResponse.json({ success: false, error: 'notebookName or notebookId required' }, { status: 400 });
        // STEP 10: this used to write straight into vaults/<project>/80-generation/exports
        // via an entirely caller-controlled `outputDir` with no containment check at all —
        // a second, uncontained vault writer. Downloads now land in a non-vault staging
        // directory; /api/obsidian/import-nlm-downloads moves them into the vault through
        // the backend's canonical writer afterward (safeSegment() below must match the one
        // ObsidianVaultService.SyncNlmDownloadsAsync applies server-side, so both sides
        // resolve the same staging path).
        const safeIdentifier = safeSegment(String(identifier));
        notebookIdentifierUsed = safeIdentifier;
        const dlDir = path.join(VAULT_ROOT, '.nlm-downloads', safeSegment(projectSlug || 'default'), safeIdentifier);
        fs.mkdirSync(dlDir, { recursive: true });
        args = ['download', 'all', identifier, '-d', dlDir, '--slide-format', 'pptx', '--no-progress'];
        timeout = 120_000;
        break;
      }

      default:
        return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
    }

    console.log(`[NLM-EXEC] Action: ${action}, Args:`, args);

    const { stdout, stderr } = await execFileAsync(NLM_EXE, args, {
      cwd: VAULT_ROOT,
      timeout,
      env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
    });

    const output = (stdout || '').trim();
    const errOutput = (stderr || '').trim();

    // Try to parse JSON output for list commands
    let parsed: any = null;
    if (action === 'list_notebooks' || action === 'list_artifacts' || action === 'live_auth_check') {
      try {
        parsed = JSON.parse(output);
      } catch { /* not JSON, that's fine */ }
    }

    return NextResponse.json({
      success: true,
      action,
      output,
      error: errOutput || undefined,
      data: parsed,
      notebookIdentifier: notebookIdentifierUsed,
    });
  } catch (err: any) {
    const message = err?.stderr || err?.stdout || err?.message || 'Unknown error';
    const isAuthError = message.includes('nlm login') || message.includes('expired') || message.includes('Authentication');
    return NextResponse.json({
      success: false,
      error: message.replace(/\x1b\[[0-9;]*m/g, '').trim(),
      needsLogin: isAuthError,
    }, { status: isAuthError ? 401 : 500 });
  } finally {
    try {
      const tempPath = path.resolve(VAULT_ROOT, 'temp_cookies.txt');
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch {}
  }
}

