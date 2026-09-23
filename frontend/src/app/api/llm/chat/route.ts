import { NextRequest, NextResponse } from 'next/server';
import { isMobileUserAgent, isLocalModel } from '@/lib/device-detection';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { endpointUrl, model, messages, temperature, max_tokens, apiKey, clientPlatform } = body;

    const ua = req.headers.get('user-agent') || '';
    const isMobileClient = clientPlatform === 'mobile' || isMobileUserAgent(ua);

    // 1. MOBILE GATING: Reject local models on mobile devices
    const isLocal = isLocalModel(model) || (endpointUrl && (endpointUrl.includes('localhost') || endpointUrl.includes('127.0.0.1')));
    if (isMobileClient && isLocal) {
      return NextResponse.json({
        success: false,
        error: 'Local hardware models (LM Studio / Ollama) cannot run on mobile devices. Please select a Cloud model (Groq, Gemini, Claude, OpenAI, DeepSeek).'
      }, { status: 400 });
    }

    let targetModel = model || 'default';
    let base = (endpointUrl || 'http://localhost:1234/v1').replace(/\/$/, '');
    let resolvedApiKey = apiKey;

    // 2. Intelligent Cloud Provider Auto-Routing
    if (typeof targetModel === 'string' && targetModel.startsWith('groq/')) {
      base = 'https://api.groq.com/openai/v1';
      targetModel = targetModel.replace(/^groq\//, '');
      resolvedApiKey = resolvedApiKey || process.env.GROQ_API_KEY || '';
    } else if (typeof targetModel === 'string' && targetModel.startsWith('openai/')) {
      base = 'https://api.openai.com/v1';
      targetModel = targetModel.replace(/^openai\//, '');
      resolvedApiKey = resolvedApiKey || process.env.OPENAI_API_KEY || '';
    } else if (typeof targetModel === 'string' && targetModel.startsWith('deepseek/')) {
      base = 'https://api.deepseek.com/v1';
      targetModel = targetModel.replace(/^deepseek\//, '');
      resolvedApiKey = resolvedApiKey || process.env.DEEPSEEK_API_KEY || '';
    } else if (typeof targetModel === 'string' && targetModel.startsWith('local/lm-studio/')) {
      targetModel = targetModel.replace(/^local\/lm-studio\//, '');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (resolvedApiKey) {
      headers['Authorization'] = `Bearer ${resolvedApiKey}`;
    }

    const endpointsToTry = [base];
    if (base.includes('localhost') || base.includes('127.0.0.1')) {
      endpointsToTry.push(base.replace('localhost', 'host.docker.internal').replace('127.0.0.1', 'host.docker.internal'));
    }

    // Auto-detect loaded model from LM Studio if model is 'default' or generic
    if (!targetModel || targetModel === 'default' || targetModel.includes('active-model')) {
      for (const candidate of endpointsToTry) {
        try {
          const modelsRes = await fetch(`${candidate}/models`, {
            method: 'GET',
            headers,
            signal: AbortSignal.timeout(2000)
          });
          if (modelsRes.ok) {
            const modelsData = await modelsRes.json();
            const firstLoaded = modelsData?.data?.[0]?.id;
            if (firstLoaded) {
              targetModel = firstLoaded;
              break;
            }
          }
        } catch {
          // Continue
        }
      }
    }

    const payload = {
      model: targetModel || 'default',
      messages: messages || [{ role: 'user', content: 'Hello' }],
      temperature: temperature !== undefined ? temperature : 0.3,
      max_tokens: max_tokens || 4096,
      stream: false
    };

    let response: Response | null = null;
    let successfulBase = base;
    let lastError = '';

    for (const candidateBase of endpointsToTry) {
      const targetUrl = `${candidateBase}/chat/completions`;
      const controller = new AbortController();
      // Allow up to 5 minutes (300,000ms) for local models, 60s for cloud
      const timeoutMs = base.startsWith('http://localhost') ? 300000 : 60000;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const res = await fetch(targetUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          response = res;
          successfulBase = candidateBase;
          break;
        } else {
          const errBody = await res.text().catch(() => '');
          lastError = `HTTP ${res.status}: ${errBody.slice(0, 160)}`;
        }
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        lastError = fetchErr?.message || 'Connection failed';
      }
    }

    if (!response) {
      return NextResponse.json({
        success: false,
        error: `Could not connect to LLM at ${base}. Error: ${lastError}`
      }, { status: 502 });
    }

    const data = await response.json();
    const choiceMsg = data?.choices?.[0]?.message;
    let content = choiceMsg?.content || '';

    // Handle reasoning models (Bonsai-27b, DeepSeek-R1, QwQ) where reasoning_content has the text
    if (!content.trim() && choiceMsg?.reasoning_content) {
      content = choiceMsg.reasoning_content;
    }
    if (!content.trim() && typeof data === 'object') {
      content = JSON.stringify(data);
    }

    return NextResponse.json({
      success: true,
      content,
      model: data.model || targetModel,
      usage: data.usage
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err?.message || 'Invalid request body'
    }, { status: 400 });
  }
}
