import { supabase } from './supabaseClient';

// STEP 7: single fetch wrapper for every call into Studio's own .NET API — attaches the
// signed-in user's Supabase JWT (the backend requires one on every endpoint, per STEP 1's
// auth) and throws a plain-language Error on any failure instead of returning a value the
// caller could mistake for real data. No caller may catch this and substitute fake data;
// callers show the message and stop, per the ticket's "no silent fallback" rule.
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || '/backend-api').replace(/\/+$/, '');

async function authHeaders(): Promise<HeadersInit> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${API_BASE_URL}${normalizedPath}`;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(await authHeaders()),
        ...init?.headers,
      },
    });
  } catch {
    throw new Error(
      `Could not reach the Studio server at ${url}. Check that it's running and try again.`
    );
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('You need to sign in to do that.');
    }
    const body = await response.text().catch(() => '');
    const cleanBody = body.includes('<!DOCTYPE html>') || body.includes('<html') 
      ? response.statusText || 'Server Endpoint Not Found' 
      : body || response.statusText;
    throw new Error(`Studio server error (${response.status}): ${cleanBody}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string) => request<T>(path, { method: 'PATCH' }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
