import { createClient } from './supabase/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function request(endpoint: string, options: RequestInit = {}) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || response.statusText);
  }

  return response.json();
}

async function uploadFile(endpoint: string, file: File, fieldName: string = 'file') {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const formData = new FormData();
  formData.append(fieldName, file);

  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  // Do NOT set Content-Type — browser sets it with the multipart boundary automatically

  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || response.statusText);
  }

  return response.json();
}

export const api = {
  get: (endpoint: string) => request(endpoint, { method: 'GET' }),
  post: (endpoint: string, body: any) => request(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  put: (endpoint: string, body: any) => request(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (endpoint: string) => request(endpoint, { method: 'DELETE' }),
  uploadFile,
};
