/**
 * KnowledgeBase.jsx — Simple Q&A Page
 *
 * Drop in your React app: src/pages/KnowledgeBase.jsx
 * Or use directly as App.jsx content.
 *
 * Features:
 *  - Upload documents (paste text or type content)
 *  - Ask questions, get grounded answers
 *  - Session persists across page refreshes
 *  - Source citations shown per answer
 *  - New session button to reset context
 */

import { useState, useEffect, useRef } from 'react';
import {
  askQuestion,
  uploadDocument,
  listDocuments,
  checkHealth,
  getSavedSessionId,
  saveSessionId,
  clearSessionId,
} from '../Api/ragApi';

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=IBM+Plex+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:        #f5f2eb;
    --surface:   #ffffff;
    --border:    #ddd8cc;
    --text:      #1a1814;
    --muted:     #7a7468;
    --accent:    #c84b2f;
    --accent-bg: #fdf1ee;
    --green:     #2d6a4f;
    --green-bg:  #edf7f2;
    --mono:      'IBM Plex Mono', monospace;
    --serif:     'Instrument Serif', serif;
  }

  body { background: var(--bg); color: var(--text); font-family: var(--mono); }

  .kb-wrap {
    max-width: 780px;
    margin: 0 auto;
    padding: 48px 24px 80px;
    min-height: 100vh;
  }

  /* Header */
  .kb-header {
    margin-bottom: 48px;
    border-bottom: 1px solid var(--border);
    padding-bottom: 24px;
  }
  .kb-header h1 {
    font-family: var(--serif);
    font-size: 2.6rem;
    font-weight: 400;
    line-height: 1.1;
    letter-spacing: -0.02em;
    color: var(--text);
    margin-bottom: 8px;
  }
  .kb-header p {
    font-size: 12px;
    color: var(--muted);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .kb-status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
    margin-top: 12px;
  }
  .kb-status .dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    background: #ccc;
  }
  .kb-status.ok .dot   { background: #4caf7d; }
  .kb-status.bad .dot  { background: var(--accent); }

  /* Section titles */
  .kb-section-title {
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 12px;
    font-weight: 500;
  }

  /* Upload panel */
  .kb-upload {
    background: var(--surface);
    border: 1px solid var(--border);
    padding: 24px;
    margin-bottom: 32px;
  }
  .kb-upload-row {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: 12px;
    margin-bottom: 12px;
  }
  .kb-upload-row input,
  .kb-upload textarea {
    font-family: var(--mono);
    font-size: 13px;
    padding: 10px 14px;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--text);
    outline: none;
    resize: vertical;
    transition: border-color 0.15s;
    width: 100%;
  }
  .kb-upload-row input:focus,
  .kb-upload textarea:focus { border-color: var(--text); }
  .kb-upload textarea { min-height: 80px; }

  .kb-btn {
    font-family: var(--mono);
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 10px 20px;
    border: 1px solid var(--text);
    background: var(--text);
    color: var(--bg);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  .kb-btn:hover:not(:disabled) { background: var(--bg); color: var(--text); }
  .kb-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .kb-btn.secondary {
    background: transparent;
    color: var(--muted);
    border-color: var(--border);
    font-size: 11px;
  }
  .kb-btn.secondary:hover:not(:disabled) { border-color: var(--text); color: var(--text); }

  .kb-upload-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 12px;
  }
  .kb-doc-count {
    font-size: 11px;
    color: var(--muted);
    letter-spacing: 0.04em;
  }

  /* Q&A area */
  .kb-qa { margin-bottom: 32px; }

  .kb-ask-row {
    display: flex;
    gap: 10px;
    margin-bottom: 28px;
  }
  .kb-ask-row input {
    flex: 1;
    font-family: var(--mono);
    font-size: 14px;
    padding: 12px 16px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    outline: none;
    transition: border-color 0.15s;
  }
  .kb-ask-row input:focus { border-color: var(--text); }
  .kb-ask-row input::placeholder { color: var(--muted); }

  /* Answer card */
  .kb-answer-card {
    background: var(--surface);
    border: 1px solid var(--border);
    padding: 24px;
    animation: fadeIn 0.25s ease;
  }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

  .kb-answer-text {
    font-family: var(--serif);
    font-size: 1.15rem;
    line-height: 1.65;
    color: var(--text);
    margin-bottom: 16px;
    white-space: pre-wrap;
  }
  .kb-answer-text.fallback { color: var(--muted); font-style: italic; }

  .kb-answer-meta {
    display: flex;
    align-items: center;
    gap: 16px;
    padding-top: 14px;
    border-top: 1px solid var(--border);
    flex-wrap: wrap;
  }
  .kb-tag {
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 3px 8px;
    border: 1px solid var(--border);
    color: var(--muted);
  }
  .kb-tag.tool { border-color: var(--green); color: var(--green); background: var(--green-bg); }
  .kb-tag.source { border-color: var(--border); }

  .kb-sources {
    margin-top: 12px;
  }
  .kb-sources-title {
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 6px;
  }
  .kb-source-item {
    font-size: 11px;
    color: var(--muted);
    padding: 4px 0;
    border-bottom: 1px dashed var(--border);
    display: flex;
    justify-content: space-between;
  }
  .kb-source-item:last-child { border-bottom: none; }
  .kb-score {
    font-size: 10px;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }

  /* Loading */
  .kb-loading {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 20px 0;
    color: var(--muted);
    font-size: 12px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .kb-spinner {
    width: 16px; height: 16px;
    border: 2px solid var(--border);
    border-top-color: var(--text);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Error */
  .kb-error {
    background: var(--accent-bg);
    border: 1px solid var(--accent);
    padding: 12px 16px;
    font-size: 12px;
    color: var(--accent);
    margin-bottom: 16px;
  }

  /* Session bar */
  .kb-session-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    background: var(--surface);
    border: 1px solid var(--border);
    margin-bottom: 20px;
    font-size: 11px;
    color: var(--muted);
    letter-spacing: 0.04em;
  }
  .kb-session-id {
    font-family: var(--mono);
    font-size: 10px;
    opacity: 0.6;
  }

  /* Toast */
  .kb-toast {
    position: fixed;
    bottom: 24px; right: 24px;
    background: var(--text);
    color: var(--bg);
    padding: 10px 18px;
    font-size: 12px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    animation: slideUp 0.2s ease;
    z-index: 999;
  }
  @keyframes slideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
`;

// ── Component ─────────────────────────────────────────────────────────────────

export default function KnowledgeBase() {
  const [health, setHealth]       = useState(null);
  const [docCount, setDocCount]   = useState(0);
  const [sessionId, setSessionId] = useState(getSavedSessionId);

  const [uploadTitle,   setUploadTitle]   = useState('');
  const [uploadContent, setUploadContent] = useState('');
  const [uploading,     setUploading]     = useState(false);
  const [uploadError,   setUploadError]   = useState('');

  const [question,    setQuestion]    = useState('');
  const [asking,      setAsking]      = useState(false);
  const [askError,    setAskError]    = useState('');
  const [lastAnswer,  setLastAnswer]  = useState(null); // { answer, sources, tool_used, retrieval_count }

  const [toast, setToast] = useState('');
  const questionRef = useRef(null);

  // ── On mount: check health + doc count ──────────────────────────────────────
  useEffect(() => {
    checkHealth()
      .then(h => setHealth(h.status))
      .catch(() => setHealth('bad'));

    listDocuments()
      .then(docs => setDocCount(docs.length))
      .catch(() => {});
  }, []);

  // ── Toast helper ─────────────────────────────────────────────────────────────
  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

  // ── Upload ────────────────────────────────────────────────────────────────────
  async function handleUpload() {
    if (!uploadTitle.trim() || !uploadContent.trim()) {
      setUploadError('Both title and content are required.');
      return;
    }
    setUploading(true);
    setUploadError('');
    try {
      const result = await uploadDocument(uploadTitle, uploadContent);
      setDocCount(c => c + 1);
      setUploadTitle('');
      setUploadContent('');
      showToast(`Indexed ${result.chunks_indexed} chunk${result.chunks_indexed !== 1 ? 's' : ''}`);
    } catch (err) {
      setUploadError(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  // ── Ask ───────────────────────────────────────────────────────────────────────
  async function handleAsk(e) {
    e.preventDefault();
    if (!question.trim()) return;
    setAsking(true);
    setAskError('');
    setLastAnswer(null);
    try {
      const result = await askQuestion(question.trim(), sessionId);
      setLastAnswer(result);
      if (result.session_id && result.session_id !== sessionId) {
        setSessionId(result.session_id);
        saveSessionId(result.session_id);
      }
      setQuestion('');
    } catch (err) {
      setAskError(err.message || 'Something went wrong.');
    } finally {
      setAsking(false);
      questionRef.current?.focus();
    }
  }

  // ── New session ───────────────────────────────────────────────────────────────
  function handleNewSession() {
    clearSessionId();
    setSessionId(null);
    setLastAnswer(null);
    setAskError('');
    showToast('New session started');
  }

  const isFallback = lastAnswer?.answer === 'The answer is not found in the uploaded documents.';

  return (
    <>
      <style>{styles}</style>

      <div className="kb-wrap">
        {/* Header */}
        <header className="kb-header">
          <h1>Knowledge Base</h1>
          <p>Personal document Q&amp;A — powered by local AI</p>
          <div className={`kb-status ${health === 'ok' ? 'ok' : health === 'bad' ? 'bad' : ''}`}>
            <span className="dot" />
            {health === 'ok' ? 'Backend connected' : health === 'bad' ? 'Backend unreachable' : 'Checking...'}
          </div>
        </header>

        {/* Upload */}
        <section className="kb-upload">
          <p className="kb-section-title">Upload Document</p>
          <div className="kb-upload-row">
            <input
              type="text"
              placeholder="Document title"
              value={uploadTitle}
              onChange={e => setUploadTitle(e.target.value)}
              disabled={uploading}
            />
            <textarea
              placeholder="Paste document content here..."
              value={uploadContent}
              onChange={e => setUploadContent(e.target.value)}
              disabled={uploading}
            />
          </div>
          {uploadError && <div className="kb-error">{uploadError}</div>}
          <div className="kb-upload-footer">
            <span className="kb-doc-count">
              {docCount} document{docCount !== 1 ? 's' : ''} indexed
            </span>
            <button className="kb-btn" onClick={handleUpload} disabled={uploading || !uploadTitle.trim() || !uploadContent.trim()}>
              {uploading ? 'Indexing...' : 'Upload & Index'}
            </button>
          </div>
        </section>

        {/* Q&A */}
        <section className="kb-qa">
          <p className="kb-section-title">Ask a Question</p>

          {/* Session bar */}
          {sessionId && (
            <div className="kb-session-bar">
              <span className="kb-session-id">session: {sessionId.slice(0, 18)}…</span>
              <button className="kb-btn secondary" onClick={handleNewSession}>New session</button>
            </div>
          )}

          <form className="kb-ask-row" onSubmit={handleAsk}>
            <input
              ref={questionRef}
              type="text"
              placeholder="Ask anything about your documents…"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              disabled={asking}
              autoFocus
            />
            <button className="kb-btn" type="submit" disabled={asking || !question.trim()}>
              {asking ? 'Thinking…' : 'Ask'}
            </button>
          </form>

          {askError && <div className="kb-error">{askError}</div>}

          {asking && (
            <div className="kb-loading">
              <div className="kb-spinner" />
              Querying documents…
            </div>
          )}

          {lastAnswer && !asking && (
            <div className="kb-answer-card">
              <p className={`kb-answer-text ${isFallback ? 'fallback' : ''}`}>
                {lastAnswer.answer}
              </p>

              <div className="kb-answer-meta">
                {lastAnswer.tool_used && (
                  <span className="kb-tag tool">tool: {lastAnswer.tool_used}</span>
                )}
                {!isFallback && (
                  <span className="kb-tag">
                    {lastAnswer.retrieval_count} chunk{lastAnswer.retrieval_count !== 1 ? 's' : ''} retrieved
                  </span>
                )}
              </div>

              {lastAnswer.sources?.length > 0 && !isFallback && (
                <div className="kb-sources">
                  <p className="kb-sources-title">Sources</p>
                  {lastAnswer.sources.map(s => (
                    <div key={s.chunk_id} className="kb-source-item">
                      <span>{s.document_title}</span>
                      <span className="kb-score">{(s.relevance_score * 100).toFixed(0)}% match</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {toast && <div className="kb-toast">{toast}</div>}
    </>
  );
}