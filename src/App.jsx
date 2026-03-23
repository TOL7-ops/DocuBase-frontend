import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

const BASE        = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const SESSIONS_KEY = 'docubase_sessions';
const ACTIVE_KEY   = 'docubase_active_session';
const FALLBACK     = 'The answer is not found in the uploaded documents.';

/* ─── API ─────────────────────────────────────────────────────────────────── */
async function apiFetch(path, opts = {}) {
  const res  = await fetch(`${BASE}${path}`, {
    ...opts, headers: { 'Content-Type': 'application/json', ...opts.headers },
  });
  const data = await res.json();
  if (!res.ok) { const e = new Error(data.message || `${res.status}`); e.code = data.error; throw e; }
  return data;
}
const api = {
  health: () => fetch(`${BASE}/health`).then(r => r.json()).catch(() => ({ status: 'error' })),
  docs:   () => apiFetch('/documents', { method: 'GET' }),
  upload: (t, c) => apiFetch('/documents', { method: 'POST', body: JSON.stringify({ title: t, content: c }) }),
  ask:    (q, sid) => apiFetch('/ask', { method: 'POST', body: JSON.stringify({ question: q, ...(sid ? { session_id: sid } : {}) }) }),
};

/* ─── Local session store ─────────────────────────────────────────────────── */
const store = {
  getSessions: () => { try { return JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]'); } catch { return []; } },
  saveSessions: s => { try { localStorage.setItem(SESSIONS_KEY, JSON.stringify(s)); } catch {} },
  getActive: () => { try { return localStorage.getItem(ACTIVE_KEY) || null; } catch { return null; } },
  setActive: id => { try { if (id) localStorage.setItem(ACTIVE_KEY, id); else localStorage.removeItem(ACTIVE_KEY); } catch {} },
};

/* ─── File reading ────────────────────────────────────────────────────────── */

function isPdf(file) {
  return (
    file.type === 'application/pdf' ||
    (file.type === 'application/octet-stream' && file.name.toLowerCase().endsWith('.pdf')) ||
    file.name.toLowerCase().endsWith('.pdf')
  );
}

// For PDFs: read as base64 and let the backend extract text via pdf-parse.
// This avoids ALL browser-side PDF parsing — no pdfjs, no worker, no iOS issues.
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = e => resolve(e.target.result); // returns "data:application/pdf;base64,..."
    r.onerror = () => reject(new Error('Failed to read file'));
    r.readAsDataURL(file);
  });
}

// For text files: read as plain text
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = e => resolve(e.target.result || '');
    r.onerror = () => reject(new Error('Failed to read file'));
    r.readAsText(file);
  });
}

async function readFile(file) {
  if (isPdf(file)) {
    // Send base64 to backend — backend uses pdf-parse to extract text
    return readFileAsBase64(file);
  }
  return readFileAsText(file);
}

function fmtSize(b) { return b < 1024 ? `${b}B` : b < 1048576 ? `${(b/1024).toFixed(1)}KB` : `${(b/1048576).toFixed(1)}MB`; }
function fmtTime(ts) { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
function fmtDate(ts) {
  const d = new Date(ts), now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/* ─── Icons ───────────────────────────────────────────────────────────────── */
const I = {
  Send:    () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  Plus:    () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Clip:    () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.41 17.41a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>,
  Trash:   () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>,
  Chat:    () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  Doc:     () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  File:    () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  X:       () => <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Dot:     () => <svg width="7" height="7" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="currentColor"/></svg>,
  Sparkle: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/></svg>,
};

const STARTERS = [
  { icon: '📄', text: 'Summarize this document',         prompt: 'Summarize this document for me' },
  { icon: '🔑', text: 'Key points',                      prompt: 'What are the key points in this document?' },
  { icon: '❓', text: 'Generate questions',               prompt: 'Ask me 5 questions about this document' },
  { icon: '🧠', text: 'Main topic',                       prompt: 'What is the main topic of this document?' },
];

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function App() {
  // Sessions: [{ id, title, messages, createdAt, updatedAt }]
  const [sessions,   setSessions]   = useState(() => store.getSessions());
  const [activeId,   setActiveId]   = useState(() => store.getActive());
  const [docs,       setDocs]       = useState([]);
  const [health,     setHealth]     = useState('checking');
  const [input,      setInput]      = useState('');
  const [busy,       setBusy]       = useState(false);
  const [pending,    setPending]    = useState([]); // attached files
  const [sideTab,    setSideTab]    = useState('chats'); // 'chats' | 'docs'
  const [sideOpen,   setSideOpen]   = useState(false);  // mobile sidebar toggle

  const taRef     = useRef(null);
  const fileRef   = useRef(null);
  const bottomRef = useRef(null);

  const activeSession = sessions.find(s => s.id === activeId) || null;
  const messages      = activeSession?.messages || [];

  useEffect(() => {
    api.health().then(d => setHealth(d.status));
    api.docs().then(setDocs).catch(() => {});
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Persist sessions
  useEffect(() => { store.saveSessions(sessions); }, [sessions]);
  useEffect(() => { store.setActive(activeId); }, [activeId]);

  /* ── Session management ── */
  function newSession() {
    const id  = crypto.randomUUID();
    const now = Date.now();
    const s   = { id, title: 'New chat', messages: [], createdAt: now, updatedAt: now, serverId: null };
    setSessions(prev => [s, ...prev]);
    setActiveId(id);
    setInput('');
    setPending([]);
    setSideOpen(false);
    setTimeout(() => taRef.current?.focus(), 100);
  }

  function deleteSession(id, e) {
    e.stopPropagation();
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeId === id) {
      const remaining = sessions.filter(s => s.id !== id);
      setActiveId(remaining[0]?.id || null);
    }
  }

  function clearAllSessions() {
    setSessions([]);
    setActiveId(null);
  }

  function updateSession(id, patch) {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, ...patch, updatedAt: Date.now() } : s));
  }

  /* ── File attach ── */
  function attachFiles(list) {
    const items = Array.from(list).map(f => ({ id: crypto.randomUUID(), file: f, name: f.name, size: f.size, status: 'reading', content: null }));
    setPending(p => [...p, ...items]);
    items.forEach(async item => {
      try {
        const fileContent = await readFile(item.file);
        if (!fileContent || fileContent.trim().length < 5) {
          throw new Error('File appears empty or unreadable');
        }
        setPending(p => p.map(u => u.id === item.id ? { ...u, status: 'ready', content: fileContent } : u));
      } catch (err) {
        console.error('File read error:', err);
        setPending(p => p.map(u => u.id === item.id ? { ...u, status: 'error', error: err.message } : u));
      }
    });
  }

  /* ── Send message ── */
  const send = useCallback(async (text) => {
    const q        = (text !== undefined ? text : input).trim();
    const toUpload = pending.filter(f => f.status === 'ready');
    if (!q && toUpload.length === 0) return;
    if (busy) return;

    // Ensure we have an active session
    let currentId = activeId;
    if (!currentId) {
      const id  = crypto.randomUUID();
      const now = Date.now();
      const s   = { id, title: q.slice(0, 40) || 'New chat', messages: [], createdAt: now, updatedAt: now, serverId: null };
      setSessions(prev => [s, ...prev]);
      setActiveId(id);
      currentId = id;
    }

    setInput(''); setPending([]);
    if (taRef.current) taRef.current.style.height = 'auto';

    const uid = crypto.randomUUID(), lid = crypto.randomUUID();
    const userMsg = { id: uid, role: 'user', text: q, files: toUpload.map(f => ({ name: f.name, size: f.size })), ts: Date.now() };
    const loadMsg = { id: lid, role: 'bot', loading: true, ts: Date.now() };

    updateSession(currentId, {
      messages: [...(sessions.find(s => s.id === currentId)?.messages || []), userMsg, loadMsg],
      title: sessions.find(s => s.id === currentId)?.title === 'New chat' ? q.slice(0, 40) : undefined,
    });
    setBusy(true);

    try {
      // Upload files
      for (const f of toUpload) {
        try {
          const res = await api.upload(f.name.replace(/\.[^.]+$/, ''), f.content);
          setDocs(d => [{ document_id: res.document_id, title: res.title, chunk_count: res.chunks_indexed }, ...d]);
        } catch (e) { console.warn('upload failed', f.name, e.message); }
      }

      const session  = sessions.find(s => s.id === currentId);
      const serverId = session?.serverId;
      const question = toUpload.length > 0
        ? `[Document: ${toUpload.map(f => f.name.replace(/\.[^.]+$/, '')).join(', ')}] ${q || 'Summarize this document'}`
        : q;

      const data = await api.ask(question, serverId);

      // Save server session ID
      if (data.session_id && data.session_id !== serverId) {
        updateSession(currentId, { serverId: data.session_id });
      }

      const botMsg = { id: lid, role: 'bot', text: data.answer, sources: data.sources, tool: data.tool_used, ts: Date.now(), loading: false };

      setSessions(prev => prev.map(s => {
        if (s.id !== currentId) return s;
        return { ...s, messages: s.messages.map(m => m.id === lid ? botMsg : m), updatedAt: Date.now() };
      }));
    } catch (err) {
      const errMsg = { id: lid, role: 'bot', text: `Error: ${err.message}`, ts: Date.now(), loading: false, isErr: true };
      setSessions(prev => prev.map(s => s.id !== currentId ? s : {
        ...s, messages: s.messages.map(m => m.id === lid ? errMsg : m),
      }));
    } finally { setBusy(false); taRef.current?.focus(); }
  }, [busy, activeId, input, pending, sessions]);

  const canSend  = (input.trim() || pending.some(f => f.status === 'ready')) && !busy;
  const isEmpty  = messages.length === 0;

  // Group sessions by date
  const grouped = sessions.reduce((acc, s) => {
    const label = fmtDate(s.updatedAt);
    if (!acc[label]) acc[label] = [];
    acc[label].push(s);
    return acc;
  }, {});

  return (
    <div className="shell">

      {/* ── Sidebar ── */}
      {/* Mobile overlay */}
      {sideOpen && <div className="sb-overlay" onClick={() => setSideOpen(false)} />}

      <aside className={`sb ${sideOpen ? 'sb-open' : ''}`}>
        {/* Brand */}
        <div className="sb-brand">
          <div className="brand-mark"><I.Sparkle /></div>
          <span className="brand-name">DocuBase</span>
          <span className="brand-badge">AI</span>
        </div>

        {/* New chat button */}
        <button className="new-chat-btn" onClick={newSession}>
          <I.Plus /> New chat
        </button>

        {/* Tab switcher */}
        <div className="sb-tabs">
          <button className={`sb-tab ${sideTab === 'chats' ? 'active' : ''}`} onClick={() => setSideTab('chats')}>
            <I.Chat /> Chats
          </button>
          <button className={`sb-tab ${sideTab === 'docs' ? 'active' : ''}`} onClick={() => setSideTab('docs')}>
            <I.Doc /> Documents
          </button>
        </div>

        {/* Chats panel */}
        {sideTab === 'chats' && (
          <div className="sb-panel">
            {sessions.length === 0 ? (
              <div className="sb-empty">
                <I.Chat />
                <span>No chats yet</span>
                <span className="sb-empty-sub">Start a new chat above</span>
              </div>
            ) : (
              <>
                {Object.entries(grouped).map(([label, group]) => (
                  <div key={label}>
                    <div className="sb-group-label">{label}</div>
                    {group.map(s => (
                      <div
                        key={s.id}
                        className={`sb-item ${activeId === s.id ? 'active' : ''}`}
                        onClick={() => { setActiveId(s.id); setSideOpen(false); }}
                      >
                        <div className="sb-item-title">{s.title || 'New chat'}</div>
                        <div className="sb-item-meta">{s.messages.filter(m => m.role === 'user').length} messages</div>
                        <button className="sb-delete" onClick={e => deleteSession(s.id, e)} title="Delete chat">
                          <I.Trash />
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
                {sessions.length > 1 && (
                  <button className="clear-all-btn" onClick={clearAllSessions}>
                    Clear all chats
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Documents panel */}
        {sideTab === 'docs' && (
          <div className="sb-panel">
            <div className="sb-upload-tip">
              <I.Clip />
              <span>Attach files in the chat input to upload</span>
            </div>
            {docs.length === 0 ? (
              <div className="sb-empty">
                <I.Doc />
                <span>No documents yet</span>
              </div>
            ) : (
              docs.map(d => (
                <div key={d.document_id} className="sb-doc-item">
                  <div className="sb-doc-icon"><I.Doc /></div>
                  <div className="sb-doc-info">
                    <div className="sb-doc-name">{d.title}</div>
                    <div className="sb-doc-meta">
                      {d.chunk_count} chunk{d.chunk_count !== 1 ? 's' : ''}
                      <span className="sb-doc-id" title={d.document_id}>
                        #{d.document_id.slice(0, 6)}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Footer */}
        <div className="sb-foot">
          <div className={`health-indicator health-${health}`}>
            <I.Dot />
            <span>{health === 'ok' ? 'Connected' : health === 'checking' ? 'Connecting…' : 'Offline'}</span>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="main">

        {/* Header */}
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-btn hamburger-btn" onClick={() => setSideOpen(o => !o)} aria-label="Toggle sidebar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <span className="topbar-title">
              {activeSession ? (activeSession.title || 'New chat') : 'AI Chat'}
            </span>
          </div>
          <div className="topbar-right">
            {activeSession && (
              <button className="icon-btn danger-btn" onClick={e => deleteSession(activeId, e)} title="Delete this chat">
                <I.Trash />
              </button>
            )}
          </div>
        </header>

        {/* Feed */}
        <div className="feed">
          {isEmpty ? (
            <div className="landing">
              <div className="landing-icon"><I.Sparkle /></div>
              <h1 className="landing-h">Welcome to DocuBase</h1>
              <p className="landing-p">Upload a document and ask anything about it. Your answers are grounded in your files — no guessing.</p>
              <div className="starter-grid">
                {STARTERS.map(s => (
                  <button key={s.prompt} className="starter-card" onClick={() => send(s.prompt)}>
                    <span className="starter-emoji">{s.icon}</span>
                    <span className="starter-text">{s.text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="messages">
              {messages.map(m => <Bubble key={m.id} m={m} />)}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="input-area">
          <div className="input-card">
            {/* File pills */}
            {pending.length > 0 && (
              <div className="file-pills">
                {pending.map(f => (
                  <div key={f.id} className={`fpill fpill-${f.status}`}>
                    <span className="fpill-ic"><I.File /></span>
                    <div className="fpill-body">
                      <span className="fpill-name">{f.name.length > 22 ? f.name.slice(0,20)+'…' : f.name}</span>
                      <span className="fpill-size">{fmtSize(f.size)}</span>
                    </div>
                    {f.status === 'reading'  && <span className="spin-xs" />}
                    {f.status === 'ready'    && <span className="fpill-ok">✓</span>}
                    {f.status === 'error'    && <span className="fpill-err" title={f.error || 'Read failed'}>✕</span>}
                    {f.status !== 'reading'  && (
                      <button className="fpill-rm" onClick={() => setPending(p => p.filter(u => u.id !== f.id))}><I.X /></button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="input-row">
              <button className="attach-btn" onClick={() => fileRef.current?.click()} title="Attach file">
                <I.Clip />
              </button>
              <input ref={fileRef} type="file" multiple accept=".pdf,.txt,.md,.csv"
                style={{ display: 'none' }}
                onChange={e => { attachFiles(e.target.files); e.target.value = ''; }} />
              <textarea
                ref={taRef}
                className="ta"
                placeholder={pending.length > 0 ? 'Ask about the file or press Enter to summarize…' : 'Ask anything about your documents…'}
                value={input} rows={1} disabled={busy}
                onChange={e => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
                }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              />
              <button className={`send-btn ${canSend ? 'ready' : ''}`} onClick={() => send()} disabled={!canSend}>
                {busy ? <span className="spin-sm" /> : <I.Send />}
              </button>
            </div>
          </div>
          <p className="input-hint">DocuBase answers from your documents only · Shift+Enter for new line</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Message bubble ──────────────────────────────────────────────────────── */
function Bubble({ m }) {
  const isUser = m.role === 'user';
  const isFb   = m.text === FALLBACK;

  return (
    <div className={`msg ${isUser ? 'msg-u' : 'msg-b'}`}>
      {!isUser && (
        <div className="av av-bot">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/></svg>
        </div>
      )}

      <div className={`bubble ${isUser ? 'bubble-u' : 'bubble-b'} ${isFb ? 'bubble-fb' : ''} ${m.isErr ? 'bubble-err' : ''}`}>
        {m.loading ? (
          <div className="typing"><span /><span /><span /></div>
        ) : (
          <>
            {/* File attachments in message */}
            {m.files?.length > 0 && (
              <div className="msg-files">
                {m.files.map(f => (
                  <div key={f.name} className="msg-file">
                    <div className="msg-file-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
                    <div>
                      <div className="msg-file-name">{f.name}</div>
                      <div className="msg-file-size">{fmtSize(f.size)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {m.text && <div className="bubble-text">{m.text}</div>}

            {m.tool && (
              <div className="tool-badge">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                Used {m.tool} tool
              </div>
            )}

            {m.sources?.length > 0 && !isFb && (
              <div className="sources">
                <div className="sources-label">Sources</div>
                {m.sources.map(s => (
                  <div key={s.chunk_id} className="source-row">
                    <span className="source-title">{s.document_title}</span>
                    <span className="source-score">{Math.round(s.relevance_score * 100)}% match</span>
                  </div>
                ))}
              </div>
            )}

            <div className="bubble-time">{fmtTime(m.ts)}</div>
          </>
        )}
      </div>

      {isUser && <div className="av av-user">U</div>}
    </div>
  );
}