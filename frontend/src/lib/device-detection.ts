export interface DeviceMode {
  isMobile: boolean;
  isDesktop: boolean;
  isPwa: boolean;
  platform: 'mobile' | 'desktop';
}

/**
 * Server-side / synchronous check for mobile User-Agent.
 */
export function isMobileUserAgent(ua?: string | null): boolean {
  if (!ua) return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua);
}

/**
 * Check whether a given model is hosted locally (requires PC/Desktop host)
 */
export function isLocalModel(modelId?: string, provider?: string): boolean {
  if (!modelId) return false;
  const id = modelId.toLowerCase();
  const prov = (provider || '').toLowerCase();

  return (
    id.startsWith('local/') ||
    id.includes('lm-studio') ||
    id.includes('ollama') ||
    prov.includes('local') ||
    prov.includes('lm studio')
  );
}

/**
 * Check whether a model runs on Cloud infrastructure (accessible from mobile)
 */
export function isCloudModel(modelId?: string, provider?: string): boolean {
  return !isLocalModel(modelId, provider);
}
