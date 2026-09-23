import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';

const execFileAsync = promisify(execFile);

export interface DetectedLmModel {
  id: string;
  name: string;
  isLoaded: boolean;
  state: 'loaded' | 'not-loaded' | string;
  type?: string;
  arch?: string;
  quantization?: string;
  maxContextLength?: number;
  loadedContextLength?: number;
  paramsString?: string;
  sizeBytes?: number;
  vision?: boolean;
}

function resolveLmsExe(): string | null {
  const candidates = [
    path.join(os.homedir(), '.lmstudio', 'bin', 'lms.exe'),
    path.join(os.homedir(), '.lmstudio', 'bin', 'lms'),
    path.join(process.env.USERPROFILE || 'C:\\Users\\DrMO87', '.lmstudio', 'bin', 'lms.exe'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action = 'list', endpointUrl, apiKey, modelId } = body;
    const base = (endpointUrl || 'http://localhost:1234/v1').replace(/\/$/, '');
    const serverHost = base.replace(/\/v1$/, '');

    // ─── ACTION: MOUNT (Load model into LM Studio memory) ───
    if (action === 'mount' || action === 'load') {
      if (!modelId) {
        return NextResponse.json({ success: false, error: 'modelId is required to mount' }, { status: 400 });
      }

      const lmsExe = resolveLmsExe();
      if (!lmsExe) {
        return NextResponse.json({
          success: false,
          error: 'lms CLI not found on host machine (~/.lmstudio/bin/lms.exe). Please install or verify LM Studio CLI.'
        }, { status: 404 });
      }

      // Strip local/lm-studio/ prefix if passed
      const cleanKey = modelId.replace(/^local\/lm-studio\//, '');

      // Check if this model is ALREADY loaded
      try {
        const { stdout: psOut } = await execFileAsync(lmsExe, ['ps', '--json'], { timeout: 4000 });
        const psData = JSON.parse(psOut || '[]');
        const isAlreadyLoaded = Array.isArray(psData) && psData.some((x: any) => (x.modelKey === cleanKey || x.identifier === cleanKey));
        if (isAlreadyLoaded) {
          return NextResponse.json({
            success: true,
            action: 'mount',
            modelId: cleanKey,
            alreadyLoaded: true,
            message: `Model "${cleanKey}" is already active and loaded in LM Studio memory!`
          });
        }

        // If another model is loaded, unload it first to prevent KV cache / VRAM exhaustion
        if (Array.isArray(psData) && psData.length > 0) {
          try {
            await execFileAsync(lmsExe, ['unload', '-a'], { timeout: 15_000 });
          } catch {}
        }
      } catch {}

      try {
        const { stdout, stderr } = await execFileAsync(lmsExe, ['load', cleanKey, '-y'], {
          timeout: 180_000,
          env: { ...process.env, NO_COLOR: '1' }
        });

        const output = (stdout || stderr || '').trim();

        return NextResponse.json({
          success: true,
          action: 'mount',
          modelId: cleanKey,
          output,
          message: `Model ${cleanKey} mounted successfully into LM Studio!`
        });
      } catch (err: any) {
        return NextResponse.json({
          success: false,
          action: 'mount',
          error: `Failed to mount model in LM Studio: ${err.message || 'Timeout or resource limit'}`
        }, { status: 500 });
      }
    }

    // ─── ACTION: UNLOAD (Unload model from LM Studio memory) ───
    if (action === 'unload') {
      const lmsExe = resolveLmsExe();
      if (!lmsExe) {
        return NextResponse.json({ success: false, error: 'lms CLI not found' }, { status: 404 });
      }

      const args = modelId ? ['unload', modelId.replace(/^local\/lm-studio\//, '')] : ['unload', '-a'];
      try {
        const { stdout } = await execFileAsync(lmsExe, args, { timeout: 30_000 });
        return NextResponse.json({ success: true, output: (stdout || '').trim(), message: 'Model unloaded from memory' });
      } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
      }
    }

    // ─── ACTION: LIST (Default: detect all available models in LM Studio) ───
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const hostEndpoints = [serverHost];
    if (serverHost.includes('localhost') || serverHost.includes('127.0.0.1')) {
      hostEndpoints.push(serverHost.replace('localhost', 'host.docker.internal').replace('127.0.0.1', 'host.docker.internal'));
    }

    let detectedModels: DetectedLmModel[] = [];
    let activeModel: string = '';
    let connected = false;
    let connectedEndpoint = base;

    // 1. Try querying LM Studio v0 API (/api/v0/models) which gives detailed state (loaded vs not-loaded)
    for (const host of hostEndpoints) {
      try {
        const res = await fetch(`${host}/api/v0/models`, {
          headers,
          signal: AbortSignal.timeout(3000)
        });
        if (res.ok) {
          const v0Data = await res.json();
          if (Array.isArray(v0Data?.data)) {
            connected = true;
            connectedEndpoint = `${host}/v1`;

            detectedModels = v0Data.data.map((m: any) => {
              const isLoaded = m.state === 'loaded';
              if (isLoaded && !activeModel) {
                activeModel = m.id;
              }
              return {
                id: m.id,
                name: m.id.split('/').pop() || m.id,
                isLoaded,
                state: m.state || 'not-loaded',
                type: m.type,
                arch: m.arch,
                quantization: m.quantization,
                maxContextLength: m.max_context_length,
                loadedContextLength: m.loaded_context_length,
                paramsString: m.params_string,
              };
            });
            break;
          }
        }
      } catch {}
    }

    // 2. Fallback to standard OpenAI /v1/models if v0 was not available
    if (!connected || detectedModels.length === 0) {
      const endpointsToTry = [base];
      if (base.includes('localhost') || base.includes('127.0.0.1')) {
        endpointsToTry.push(base.replace('localhost', 'host.docker.internal').replace('127.0.0.1', 'host.docker.internal'));
      }

      for (const candidateBase of endpointsToTry) {
        try {
          const res = await fetch(`${candidateBase}/models`, {
            headers,
            signal: AbortSignal.timeout(3000)
          });
          if (res.ok) {
            const data = await res.json();
            connected = true;
            connectedEndpoint = candidateBase;
            const modelList = data?.data || [];
            detectedModels = modelList.map((m: any, idx: number) => ({
              id: m.id,
              name: m.id.split('/').pop() || m.id,
              isLoaded: idx === 0,
              state: idx === 0 ? 'loaded' : 'not-loaded'
            }));
            if (detectedModels.length > 0 && !activeModel) {
              activeModel = detectedModels[0].id;
            }
            break;
          }
        } catch {}
      }
    }

    // 3. Enrich with lms CLI metadata if available (gives exact disk size, architecture, etc.)
    const lmsExe = resolveLmsExe();
    if (lmsExe && detectedModels.length > 0) {
      try {
        const { stdout: psOut } = await execFileAsync(lmsExe, ['ps', '--json'], { timeout: 4000 });
        const loadedJson = JSON.parse(psOut || '[]');
        if (Array.isArray(loadedJson) && loadedJson.length > 0) {
          const loadedKeys = new Set(loadedJson.map((x: any) => x.modelKey || x.identifier));
          if (loadedJson[0]?.modelKey) {
            activeModel = loadedJson[0].modelKey;
          }
          detectedModels.forEach(m => {
            if (loadedKeys.has(m.id)) {
              m.isLoaded = true;
              m.state = 'loaded';
            }
          });
        }
      } catch {}
    }

    if (!connected) {
      return NextResponse.json({
        connected: false,
        error: `Cannot reach LM Studio at ${base}. Ensure LM Studio Server is started on port 1234.`
      });
    }

    return NextResponse.json({
      connected: true,
      endpoint: connectedEndpoint,
      activeModel: activeModel || detectedModels[0]?.id || 'Active Model',
      loadedModels: detectedModels.filter(m => m.isLoaded).map(m => m.id),
      models: detectedModels.map(m => m.id),
      detailedModels: detectedModels
    });
  } catch (err: any) {
    return NextResponse.json({ connected: false, error: err.message }, { status: 400 });
  }
}
