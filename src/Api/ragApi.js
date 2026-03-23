/**
 * ragApi.js — API client for the RAG backend
 * Place at: src/api/ragApi.js
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const data = await res.json();
  if (!res.ok) {
    const err    = new Error(data.message || `Request failed ${res.status}`);
    err.code     = data.error || 'UNKNOWN_ERROR';
    err.status   = res.status;
    err.details  = data;
    throw err;
  }
  return data;
}

export async function checkHealth() {
  return apiFetch('/health', { method: 'GET' });
}

export async function uploadDocument(title, content) {
  if (!title?.trim())   throw new Error('title is required');
  if (!content?.trim()) throw new Error('content is required');
  return apiFetch('/documents', {
    method: 'POST',
    body: JSON.stringify({ title: title.trim(), content }),
  });
}

export async function listDocuments() {
  return apiFetch('/documents', { method: 'GET' });
}

export async function askQuestion(question, sessionId = null) {
  if (!question?.trim()) throw new Error('question is required');
  const body = { question: question.trim() };
  if (sessionId) body.session_id = sessionId;
  return apiFetch('/ask', { method: 'POST', body: JSON.stringify(body) });
}

export async function getSession(sessionId) {
  if (!sessionId) throw new Error('sessionId is required');
  return apiFetch(`/sessions/${sessionId}`, { method: 'GET' });
}

const SESSION_KEY = 'rag_session_id';
export const getSavedSessionId = () => {
  try { return localStorage.getItem(SESSION_KEY) || null; } catch { return null; }
};
export const saveSessionId = id => {
  try { localStorage.setItem(SESSION_KEY, id); } catch {}
};
export const clearSessionId = () => {
  try { localStorage.removeItem(SESSION_KEY); } catch {}
};