import { NextRequest, NextResponse } from 'next/server';
import { execFile, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';

const execFileAsync = promisify(execFile);
const activeProcesses = new Set<ChildProcess>();

function runChildProcess(
  exe: string,
  args: string[],
  options: any,
  signal?: AbortSignal
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(new Error('Operation aborted before execution'));
    }

    const child = execFile(exe, args, options, (error, stdout, stderr) => {
      activeProcesses.delete(child);
      const outStr = typeof stdout === 'string' ? stdout : (stdout ? stdout.toString('utf8') : '');
      const errStr = typeof stderr === 'string' ? stderr : (stderr ? stderr.toString('utf8') : '');
      if (error) {
        reject(Object.assign(error, { stdout: outStr, stderr: errStr }));
      } else {
        resolve({ stdout: outStr, stderr: errStr });
      }
    });

    activeProcesses.add(child);

    if (signal) {
      const onAbort = () => {
        try {
          if (process.platform === 'win32' && child.pid) {
            spawn('taskkill', ['/F', '/T', '/PID', String(child.pid)], { stdio: 'ignore' }).unref();
          } else {
            child.kill('SIGKILL');
          }
        } catch {}
      };
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

const VAULT_ROOT = process.env.VAULT_ROOT ? path.resolve(process.env.VAULT_ROOT) : path.resolve(process.cwd(), '..');

function safeSegment(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^[._]+|[._]+$/g, '');
  return cleaned || 'untitled';
}

function resolveNlmExe(): string {
  if (process.env.NLM_EXE && fs.existsSync(process.env.NLM_EXE)) {
    return process.env.NLM_EXE;
  }
  const candidates = [
    path.resolve(VAULT_ROOT, '.venv/Scripts/nlm.exe'),
    path.resolve(process.cwd(), '..', '.venv/Scripts/nlm.exe'),
    path.resolve(process.cwd(), '.venv/Scripts/nlm.exe'),
    'D:\\HUE\\DEVELOPED SOFTWARE\\CourseDeveloperStudio\\.venv\\Scripts\\nlm.exe',
    'D:\\HUE\\DEVELOPED SOFTWARE\\Course Developer\\.venv\\Scripts\\nlm.exe',
    path.resolve(VAULT_ROOT, '.venv/bin/nlm'),
    '/usr/local/bin/nlm',
    '/usr/bin/nlm'
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return process.env.NLM_EXE || 'nlm';
}

function isNlmAvailable(): boolean {
  const exe = resolveNlmExe();
  if (fs.existsSync(exe)) return true;
  if (process.platform === 'win32') return true;
  return false;
}

// ─── Edge InPrivate Authentication ───────────────────────────────────────────
const EDGE_CDP_PORT = 18800;
const EDGE_PROFILE_DIR = path.resolve(VAULT_ROOT, '.nlm-edge-profile');

let edgeAuthPid: number | null = null;

function resolveEdgeExe(): string | null {
  const candidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

async function isEdgeCdpReady(): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${EDGE_CDP_PORT}/json/version`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
// ─────────────────────────────────────────────────────────────────────────────

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      action,
      notebookName,
      notebookId,
      filePath,
      instructions,
      projectSlug,
      orientation,
      detail,
      style,
      format,
      stylePrompt,
      slideFormat,
      audioFormat,
      language
    } = body;

    const nlmExe = resolveNlmExe();
    const available = isNlmAvailable();

    // If running in headless Docker / Linux container where NLM binary is not available
    if (!available && process.platform !== 'win32') {
      return NextResponse.json({
        success: false,
        action,
        isDocker: true,
        needsLogin: true,
        error: 'The server is running inside a Docker container where desktop browser automation is unavailable. To authenticate NotebookLM: (1) Run .\\login_nlm.ps1 in PowerShell on your PC, OR (2) Use the "⚡ Fast Session Import" button above to paste your cookies in 5 seconds.'
      }, { status: 401 });
    }

    let args: string[] = [];
    let timeout = 30_000;
    let notebookIdentifierUsed: string | undefined;

    let resolvedId = notebookId;
    if (notebookName && !['create_notebook', 'list_notebooks', 'live_auth_check', 'doctor', 'launch_login', 'capture_edge_auth', 'kill_edge_auth', 'kill_pipeline', 'kill_all', 'open_download_dir', 'generate_motion_graphic_pptx'].includes(action)) {
      try {
        const { stdout } = await runChildProcess(nlmExe, ['notebook', 'list', '--json'], { cwd: VAULT_ROOT, timeout: 15_000, env: { ...process.env, NO_COLOR: '1' } }, req.signal);
        const nbList = JSON.parse(stdout || '[]');
        
        // If resolvedId was given from localStorage/client, check if it actually exists in the account
        let idExists = false;
        if (resolvedId) {
          idExists = nbList.some((n: any) => n.id === resolvedId);
        }

        // If not found or not provided, match by notebookName or project title
        if (!idExists) {
          const match = nbList.find((n: any) => {
            const title = (n.title || '').trim().toLowerCase();
            const target = (notebookName || '').trim().toLowerCase();
            return title === target || (target && title.includes(target));
          });
          if (match) {
            resolvedId = match.id;
          } else if (action === 'add_source_file') {
            // If the notebook does not exist at all, auto-create it so upload doesn't fail
            const { stdout: createOut } = await runChildProcess(nlmExe, ['notebook', 'create', notebookName], { cwd: VAULT_ROOT, timeout: 20_000, env: { ...process.env, NO_COLOR: '1' } }, req.signal);
            const created = createOut.match(/"notebook_id":\s*"([^"]+)"/)?.[1] || createOut.match(/"id":\s*"([^"]+)"/)?.[1];
            if (created) resolvedId = created;
          }
        }
      } catch (e) {
        console.error('[NLM] Pre-resolve / validation failed:', e);
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
        const tempPath = path.join(os.tmpdir(), `nlm_temp_cookies_${Date.now()}.txt`);
        fs.writeFileSync(tempPath, cookieText.trim(), 'utf8');
        args = ['login', '--manual', '--file', tempPath];
        timeout = 20_000;
        break;
      }

      // ─── Launch Login: Dedicated Edge window with CDP for session capture ───
      case 'launch_login': {
        if (process.platform !== 'win32') {
          return NextResponse.json({
            success: false,
            action: 'launch_login',
            isDocker: true,
            error: 'Cannot launch Edge browser from inside a Docker container. Please run .\\login_nlm.ps1 in PowerShell on your PC, or click "⚡ Fast Session Import" to paste your session cookies in 5 seconds.'
          }, { status: 400 });
        }

        const edgeExe = resolveEdgeExe();
        if (!edgeExe) {
          return NextResponse.json({
            success: false,
            action: 'launch_login',
            error: 'Microsoft Edge not found. Please install Edge or use "⚡ Fast Session Import" instead.'
          }, { status: 400 });
        }

        // Kill any existing Edge auth window
        if (edgeAuthPid) {
          try { process.kill(edgeAuthPid); } catch {}
          edgeAuthPid = null;
        }

        // Kill any Edge processes still using our dedicated profile dir so the
        // new instance can actually bind the CDP port instead of handing off to
        // the already-running main Edge process (which ignores --remote-debugging-port).
        try {
          const { execSync } = require('child_process');
          execSync(
            `taskkill /F /IM msedge.exe /FI "COMMANDLINE eq *${EDGE_PROFILE_DIR.replace(/\\/g, '\\\\')}*"`,
            { stdio: 'ignore', timeout: 5000 }
          );
        } catch {}
        // Brief pause to let the OS release the profile lock files
        await new Promise(r => setTimeout(r, 500));

        // Clean stale lockfiles from both the NLM CLI profile and our Edge profile
        const profileDir = path.join(os.homedir(), '.notebooklm-mcp-cli', 'chrome-profiles', 'default');
        for (const lockFile of ['lockfile', 'SingletonLock']) {
          try { fs.unlinkSync(path.join(profileDir, lockFile)); } catch {}
        }
        try { fs.unlinkSync(path.join(os.homedir(), '.notebooklm-mcp-cli', 'chrome-port-map.json')); } catch {}
        // Also clean lockfiles from our own Edge profile dir
        for (const lockFile of ['lockfile', 'SingletonLock', 'SingletonSocket', 'SingletonCookie']) {
          try { fs.unlinkSync(path.join(EDGE_PROFILE_DIR, lockFile)); } catch {}
        }

        // Launch a DEDICATED Edge process for NLM authentication.
        // IMPORTANT: We do NOT use --inprivate because InPrivate mode blocks
        // cookie extraction via CDP in newer Edge versions, which is exactly
        // why session capture was always failing. The separate --user-data-dir
        // already provides full isolation from your normal Edge browsing data.
        const edgeArgs = [
          '--new-window',
          `--user-data-dir=${EDGE_PROFILE_DIR}`,
          `--remote-debugging-port=${EDGE_CDP_PORT}`,
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-sync',
          '--disable-extensions',
          '--disable-background-networking',
          '--disable-default-apps',
          'https://accounts.google.com/ServiceLogin?continue=https%3A%2F%2Fnotebooklm.google.com',
        ];

        const edgeProc = spawn(edgeExe, edgeArgs, {
          detached: true,
          stdio: 'ignore',
          windowsHide: false,
        });
        edgeProc.unref();
        edgeAuthPid = edgeProc.pid ?? null;

        // Wait briefly, then verify CDP actually came up
        await new Promise(r => setTimeout(r, 2000));
        const cdpUp = await isEdgeCdpReady();

        return NextResponse.json({
          success: true,
          action: 'launch_login',
          edgePid: edgeAuthPid,
          cdpReady: cdpUp,
          output: cdpUp
            ? 'Edge opened for Google sign-in (CDP connected ✓). Complete sign-in, then click "✅ Capture Session".'
            : 'Edge launched but CDP is still starting. Complete sign-in, then click "✅ Capture Session" (it will retry the CDP connection).',
        });
      }

      // ─── Capture Auth: Connect to running Edge via CDP and extract session ───
      case 'capture_edge_auth': {
        // Check if Edge CDP is reachable — retry a few times since Edge
        // may be slow to expose the CDP port after launching
        let cdpReady = false;
        for (let attempt = 0; attempt < 4; attempt++) {
          cdpReady = await isEdgeCdpReady();
          if (cdpReady) break;
          if (attempt < 3) await new Promise(r => setTimeout(r, 1500));
        }
        if (!cdpReady) {
          return NextResponse.json({
            success: false,
            action: 'capture_edge_auth',
            error: 'Cannot connect to Edge CDP on port 18800. This usually means Edge reused an existing process and ignored the debugging port. Please close ALL Edge windows completely, then click "🔑 Sign In with Edge" again.',
          }, { status: 400 });
        }

        // Smart check: Inspect open tabs to verify user reached notebooklm.google.com
        try {
          const listRes = await fetch(`http://127.0.0.1:${EDGE_CDP_PORT}/json/list`, {
            signal: AbortSignal.timeout(3000),
          });
          if (listRes.ok) {
            const pages: any[] = await listRes.json();
            const realPages = pages.filter((p: any) => p.type === 'page');

            const onNotebookLm = realPages.some((p: any) => {
              const u = (p.url || '').toLowerCase();
              return (u.includes('notebooklm.google.com') || u.includes('notebook.google.com')) && !u.startsWith('https://accounts.google.com');
            });

            const stillOnLogin = realPages.some((p: any) => {
              const u = (p.url || '').toLowerCase();
              return u.startsWith('https://accounts.google.com');
            });

            if (stillOnLogin && !onNotebookLm) {
              return NextResponse.json({
                success: false,
                action: 'capture_edge_auth',
                notReady: true,
                error: 'Google sign-in is not finished yet in Edge! Please enter your email and password in the Edge window, wait until the NotebookLM dashboard appears, then click "Capture Session".',
              }, { status: 400 });
            }
          }
        } catch {}

        // Use nlm login with openclaw provider to capture session from Edge CDP
        try {
          const { stdout, stderr } = await runChildProcess(nlmExe, [
            'login',
            '--provider', 'openclaw',
            '--cdp-url', `http://127.0.0.1:${EDGE_CDP_PORT}`,
            '--force',
          ], {
            cwd: VAULT_ROOT,
            timeout: 120_000,
            env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
          }, req.signal);

          // Kill Edge InPrivate window after successful capture
          if (edgeAuthPid) {
            try { process.kill(edgeAuthPid); } catch {}
            edgeAuthPid = null;
          }
          // Also try taskkill to clean up any child processes
          try {
            spawn('taskkill', ['/F', '/IM', 'msedge.exe', '/FI', `PID eq ${edgeAuthPid}`], {
              detached: true, stdio: 'ignore',
            }).unref();
          } catch {}

          return NextResponse.json({
            success: true,
            action: 'capture_edge_auth',
            output: (stdout || '').trim() || 'Session credentials captured from Edge InPrivate window.',
          });
        } catch (captureErr: any) {
          const errMsg = captureErr?.stderr || captureErr?.stdout || captureErr?.message || 'Unknown error';
          return NextResponse.json({
            success: false,
            action: 'capture_edge_auth',
            error: `Failed to capture session from Edge: ${errMsg.replace(/\x1b\[[0-9;]*m/g, '').trim()}. Make sure you have completed Google sign-in in the Edge window.`,
          }, { status: 500 });
        }
      }

      case 'kill_edge_auth': {
        if (edgeAuthPid) {
          try { process.kill(edgeAuthPid); } catch {}
          edgeAuthPid = null;
        }
        return NextResponse.json({
          success: true,
          action: 'kill_edge_auth',
          output: 'Edge InPrivate auth window closed.',
        });
      }

      // ─── Kill Pipeline: forcefully terminate active child processes & nlm.exe ───
      case 'kill_pipeline':
      case 'kill_all': {
        let killedCount = 0;
        for (const child of activeProcesses) {
          try {
            if (process.platform === 'win32' && child.pid) {
              spawn('taskkill', ['/F', '/T', '/PID', String(child.pid)], { stdio: 'ignore' }).unref();
            } else {
              child.kill('SIGKILL');
            }
            killedCount++;
          } catch {}
        }
        activeProcesses.clear();

        if (edgeAuthPid) {
          try { process.kill(edgeAuthPid); } catch {}
          edgeAuthPid = null;
        }

        // On Windows, also invoke taskkill to ensure any detached or tree-spawned nlm.exe is terminated
        if (process.platform === 'win32') {
          try {
            const { execSync } = require('child_process');
            execSync('taskkill /F /IM nlm.exe /T', { stdio: 'ignore', timeout: 5000 });
          } catch {}
        }

        return NextResponse.json({
          success: true,
          action: 'kill_pipeline',
          output: `NotebookLM pipeline forcefully stopped. Terminated ${killedCount} active process(es).`,
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
          const directCandidate = path.join(VAULT_ROOT, filePath);
          if (fs.existsSync(directCandidate)) {
            targetPath = directCandidate;
          }
        }

        if (!fs.existsSync(targetPath)) {
          const fileName = path.basename(filePath);
          const dirName = path.basename(path.dirname(filePath));
          const pSlug = projectSlug || 'instrumental-analysis-pharmaceutical';

          // Candidate vaults to check (handles case, hyphen, and underscore variations)
          const vaultCandidates = [
            pSlug,
            'Inst-Analysis',
            'instrumental-analysis-pharmaceutical',
            'inst',
            'inst_analysis'
          ].filter(Boolean);

          let resolvedFile: string | null = null;

          for (const v of vaultCandidates) {
            const vBase = path.join(VAULT_ROOT, 'vaults', v);
            if (!fs.existsSync(vBase)) continue;

            const candidates = [
              path.join(vBase, filePath),
              path.join(vBase, '01_Projects', v, filePath),
              path.join(vBase, '01_Projects', v, dirName, fileName),
              path.join(vBase, '01_Projects', v, 'Lec 01', fileName),
              path.join(vBase, '01_Projects', v, 'Lec_01', fileName),
              path.join(vBase, '01_Projects', v, 'Lec 02', fileName),
              path.join(vBase, '01_Projects', v, 'Lec_02', fileName),
              path.join(vBase, '01_Projects', v, 'Lec_01_Spectrophotometry', fileName),
              path.join(vBase, '01_Projects', v, 'Dossier', fileName),
              path.join(vBase, '01_Projects', v, 'Dossier', `${fileName}.md`),
              path.join(vBase, '01_Projects', v, fileName),
              path.join(vBase, '01_Projects', v, dirName, 'assets', fileName),
              path.join(vBase, '01_Projects', v, dirName, '_assets', fileName),
              path.join(vBase, '01_Projects', v, 'Dossier', '_assets', fileName),
              path.join(vBase, '01_Projects', v, 'Dossier', 'assets', fileName),
              path.join(vBase, '01_Projects', v, '_assets', fileName),
              path.join(vBase, '01_Projects', v, 'assets', fileName),
              path.join(vBase, '_assets', fileName),
              path.join(vBase, 'assets', fileName),
              path.join(vBase, '03_Resources', 'Course_Dossier_Intake', 'COURSE_SPEC', fileName),
              path.join(vBase, '03_Resources', 'Course_Dossier_Intake', 'EXAM_BLUEPRINT', fileName),
              path.join(vBase, '03_Resources', 'Course_Dossier_Intake', 'REFERENCE_EVIDENCE', fileName),
              path.join(vBase, '03_Resources', 'Course_Dossier_Intake', 'QUESTION_BANK', fileName),
              path.join(vBase, '03_Resources', 'Assessment_Blueprints', fileName),
              path.join(vBase, '02_Areas', 'horus-pharmacy', fileName),
              path.join(vBase, '02_Areas', 'horus-university-egypt', fileName),
            ];

            const match = candidates.find(c => fs.existsSync(c));
            if (match) {
              resolvedFile = match;
              break;
            }
          }

          if (resolvedFile) {
            targetPath = resolvedFile;
          } else {
            return NextResponse.json({
              success: false,
              error: `Source file not found in the vault: ${fileName}. Sync the course to the vault before adding it as a NotebookLM source.`,
            }, { status: 404 });
          }
        }

        // CRITICAL: --wait instructs nlm CLI to wait until Google NotebookLM finishes parsing and indexing the document
        args = ['source', 'add', identifier, '--file', targetPath, '--wait'];
        timeout = 180_000;
        break;
      }

      case 'list_sources': {
        const identifier = resolvedId || notebookName;
        if (!identifier) return NextResponse.json({ success: false, error: 'notebookName/id required' }, { status: 400 });
        args = ['source', 'list', identifier, '--json'];
        timeout = 25_000;
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
        const fmt = (slideFormat === 'detailed' || !slideFormat) ? 'detailed_deck' : slideFormat;
        args.push('--format', fmt);
        if (language) args.push('--language', language);
        if (instructions) args.push('--focus', instructions);
        timeout = 90_000;
        break;
      }

      case 'generate_motion_graphic_pptx': {
        const pSlug = safeSegment(projectSlug || 'inst');
        const sCode = body.sessionCode || 'Lec 01';
        const sTitle = body.sessionTitle || 'Molecular UV/Vis Spectroscopy';
        const cName = body.courseName || 'Instrumental Analysis';
        const cCode = body.courseCode || 'PC 206';
        const inst = body.institution || 'Horus University in Egypt (Faculty of Pharmacy)';

        const pythonCandidates = [
          path.resolve(VAULT_ROOT, '.venv/Scripts/python.exe'),
          path.resolve(process.cwd(), '..', '.venv/Scripts/python.exe'),
          path.resolve(process.cwd(), '.venv/Scripts/python.exe'),
          'D:\\HUE\\DEVELOPED SOFTWARE\\CourseDeveloperStudio\\.venv\\Scripts\\python.exe',
          path.resolve(VAULT_ROOT, '.venv/bin/python'),
          'python3',
          'python',
        ];
        const pythonExe = pythonCandidates.find(p => fs.existsSync(p)) || 'python';

        const scriptCandidates = [
          path.resolve(VAULT_ROOT, 'scripts/generate_motion_graphic_deck.py'),
          path.resolve(process.cwd(), '..', 'scripts/generate_motion_graphic_deck.py'),
          path.resolve(process.cwd(), 'scripts/generate_motion_graphic_deck.py'),
        ];
        const scriptPath = scriptCandidates.find(p => fs.existsSync(p));
        if (!scriptPath) {
          return NextResponse.json({ success: false, error: 'generate_motion_graphic_deck.py script not found' }, { status: 404 });
        }

        const runArgs = [
          scriptPath,
          '--project-slug', pSlug,
          '--session-code', sCode,
          '--session-title', sTitle,
          '--course-name', cName,
          '--course-code', cCode,
          '--institution', inst,
        ];

        console.log(`[NLM] Generating Clean Motion Graphic PPTX with: ${pythonExe}`, runArgs);
        try {
          const { stdout, stderr } = await runChildProcess(pythonExe, runArgs, {
            cwd: VAULT_ROOT,
            timeout: 60_000,
            env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
          }, req.signal);

          const output = (stdout || '').trim();
          return NextResponse.json({
            success: true,
            action: 'generate_motion_graphic_pptx',
            output: output || 'Motion graphic deck generated successfully.',
          });
        } catch (err: any) {
          const errMsg = err?.stderr || err?.stdout || err?.message || 'Failed to generate motion graphic presentation';
          return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
        }
      }

      case 'generate_podcast':
      case 'generate_audio': {
        const identifier = resolvedId || notebookName;
        if (!identifier) return NextResponse.json({ success: false, error: 'notebookName/id required' }, { status: 400 });
        args = ['audio', 'create', identifier, '--confirm'];
        if (audioFormat || format) args.push('--format', audioFormat || format);
        if (language) args.push('--language', language);
        if (instructions) args.push('--focus', instructions);
        timeout = 180_000; // Podcast generation takes longer
        break;
      }

      case 'generate_infographic': {
        const identifier = resolvedId || notebookName;
        if (!identifier) return NextResponse.json({ success: false, error: 'notebookName/id required' }, { status: 400 });
        args = ['infographic', 'create', identifier, '--confirm'];
        if (orientation) args.push('--orientation', orientation);
        if (detail) args.push('--detail', detail);
        if (style) args.push('--style', style);
        if (language) args.push('--language', language);
        if (instructions) args.push('--focus', instructions);
        timeout = 120_000;
        break;
      }

      case 'generate_video': {
        const identifier = resolvedId || notebookName;
        if (!identifier) return NextResponse.json({ success: false, error: 'notebookName/id required' }, { status: 400 });
        args = ['video', 'create', identifier, '--confirm'];
        if (format) args.push('--format', format);
        if (style) args.push('--style', style);
        if (stylePrompt) args.push('--style-prompt', stylePrompt);
        if (language) args.push('--language', language);
        if (instructions) args.push('--focus', instructions);
        timeout = 180_000;
        break;
      }

      case 'studio_query':
      case 'query': {
        const identifier = resolvedId || notebookName;
        if (!identifier || !instructions) return NextResponse.json({ success: false, error: 'notebookName/id and instructions required' }, { status: 400 });
        args = ['query', identifier, instructions];
        timeout = 60_000;
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

      case 'open_download_dir': {
        const pSlug = safeSegment(projectSlug || 'instrumental-analysis-pharmaceutical');
        const identifier = notebookId || notebookName;
        const safeIdentifier = identifier ? safeSegment(String(identifier)) : '';
        const targetType = body.targetFolder || 'auto';

        const candidatesToCheck: string[] = [];

        if (targetType === 'staging') {
          if (safeIdentifier) candidatesToCheck.push(path.join(VAULT_ROOT, '.nlm-downloads', pSlug, safeIdentifier));
          candidatesToCheck.push(path.join(VAULT_ROOT, '.nlm-downloads', pSlug));
          candidatesToCheck.push(path.join(VAULT_ROOT, '.nlm-downloads'));
        } else if (targetType === 'vault') {
          if (safeIdentifier) candidatesToCheck.push(path.join(VAULT_ROOT, 'vaults', pSlug, '03_Resources', 'NotebookLM_Generated', safeIdentifier));
          candidatesToCheck.push(path.join(VAULT_ROOT, 'vaults', pSlug, '03_Resources', 'NotebookLM_Generated'));
        } else {
          // Auto mode: check vault then staging, including candidate vault variations
          const slugVariations = Array.from(new Set([
            pSlug,
            'Inst-Analysis',
            'inst_analysis',
            'inst',
            'instrumental-analysis-pharmaceutical'
          ]));

          // 1. Vault target directories
          for (const s of slugVariations) {
            if (safeIdentifier) {
              candidatesToCheck.push(path.join(VAULT_ROOT, 'vaults', s, '03_Resources', 'NotebookLM_Generated', safeIdentifier));
            }
            candidatesToCheck.push(path.join(VAULT_ROOT, 'vaults', s, '03_Resources', 'NotebookLM_Generated'));
          }

          // 2. Staging download directories
          for (const s of slugVariations) {
            if (safeIdentifier) {
              candidatesToCheck.push(path.join(VAULT_ROOT, '.nlm-downloads', s, safeIdentifier));
            }
            candidatesToCheck.push(path.join(VAULT_ROOT, '.nlm-downloads', s));
          }
          candidatesToCheck.push(path.join(VAULT_ROOT, '.nlm-downloads'));
        }

        let targetDir: string | null = null;
        for (const dir of candidatesToCheck) {
          if (!fs.existsSync(dir)) continue;

          // Check if directory directly or recursively contains files
          const hasFiles = (function checkDir(d: string, depth = 0): boolean {
            if (depth > 3) return false;
            try {
              const entries = fs.readdirSync(d, { withFileTypes: true });
              for (const e of entries) {
                if (e.isFile()) return true;
                if (e.isDirectory() && checkDir(path.join(d, e.name), depth + 1)) return true;
              }
            } catch {}
            return false;
          })(dir);

          if (hasFiles) {
            let current = dir;
            while (true) {
              try {
                const items = fs.readdirSync(current, { withFileTypes: true });
                const files = items.filter(i => i.isFile());
                const subdirs = items.filter(i => i.isDirectory());
                if (files.length > 0) {
                  targetDir = current;
                  break;
                }
                if (subdirs.length === 1) {
                  current = path.join(current, subdirs[0].name);
                  continue;
                }
                let foundWithFiles: string | null = null;
                for (const s of subdirs) {
                  const subPath = path.join(current, s.name);
                  try {
                    const subItems = fs.readdirSync(subPath, { withFileTypes: true });
                    if (subItems.some(i => i.isFile())) {
                      foundWithFiles = subPath;
                      break;
                    }
                    for (const inner of subItems.filter(i => i.isDirectory())) {
                      const innerPath = path.join(subPath, inner.name);
                      if (fs.readdirSync(innerPath).length > 0) {
                        foundWithFiles = innerPath;
                        break;
                      }
                    }
                  } catch {}
                }
                targetDir = foundWithFiles || current;
                break;
              } catch {
                targetDir = current;
                break;
              }
            }
            if (targetDir) break;
          }
        }

        // If no non-empty directory was found, ensure default vault or staging folder exists
        if (!targetDir) {
          if (targetType === 'staging') {
            targetDir = path.join(VAULT_ROOT, '.nlm-downloads', pSlug);
          } else {
            targetDir = path.join(VAULT_ROOT, 'vaults', pSlug, '03_Resources', 'NotebookLM_Generated');
          }
          try { fs.mkdirSync(targetDir, { recursive: true }); } catch {}
        }

        console.log(`[NLM] Opening download directory in file explorer: ${targetDir}`);

        try {
          if (process.platform === 'win32') {
            spawn('explorer.exe', [targetDir], { detached: true, stdio: 'ignore' }).unref();
          } else if (process.platform === 'darwin') {
            spawn('open', [targetDir], { detached: true, stdio: 'ignore' }).unref();
          } else {
            spawn('xdg-open', [targetDir], { detached: true, stdio: 'ignore' }).unref();
          }
        } catch (openErr: any) {
          console.error('[NLM] Failed to spawn file explorer:', openErr);
        }

        return NextResponse.json({
          success: true,
          action: 'open_download_dir',
          path: targetDir,
          output: `Opened download directory: ${targetDir}`,
        });
      }

      default:
        return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
    }

    console.log(`[NLM-EXEC] Action: ${action}, Using: ${nlmExe}, Args:`, args);

    const { stdout, stderr } = await runChildProcess(nlmExe, args, {
      cwd: VAULT_ROOT,
      timeout,
      env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
    }, req.signal);

    const output = (stdout || '').trim();
    const errOutput = (stderr || '').trim();

    // Try to parse JSON output for list commands
    let parsed: any = null;
    if (action === 'list_notebooks' || action === 'list_artifacts' || action === 'live_auth_check' || action === 'list_sources') {
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
      const files = fs.readdirSync(os.tmpdir()).filter(f => f.startsWith('nlm_temp_cookies_'));
      for (const f of files) {
        try { fs.unlinkSync(path.join(os.tmpdir(), f)); } catch {}
      }
    } catch {}
  }
}

