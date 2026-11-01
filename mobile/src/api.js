import { supabase } from './supabase';

const BASE = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/$/, '');

export const qs = (obj) =>
  Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');

export async function api(path, { method = 'GET', body, form } = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = {};
  if (session) headers.Authorization = `Bearer ${session.access_token}`;
  let payload;
  if (form) payload = form;
  else if (body) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }

  let res;
  try { res = await fetch(`${BASE}/api${path}`, { method, headers, body: payload }); }
  catch { throw new Error('Cannot reach the server. Check your internet connection.'); }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return json;
}