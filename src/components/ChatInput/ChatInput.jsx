import { useState, useRef, useCallback } from 'react';
import { uploadDocument } from '../../Api/ragApi';
import './ChatInput.css';

const ACCEPTED = '.pdf,.txt,.md,.csv';
const MAX_MB   = 10;

function readAsText(file) {
  return new Promise((resolve, reject) => {
    if (file.type === 'application/pdf') {
      resolve(`[PDF: ${file.name}] — install pdfjs-dist for full text extraction.`);
      return;
    }
    const r = new FileReader();
    r.onload  = e => resolve(e.target.result);
    r.onerror = reject;
    r.readAsText(file);
  });
}

export default function ChatInput({ onSend, loading }) {
  const [text,        setText]        = useState('');
  const [files,       setFiles]       = useState([]); // { id, name, size, status, error }
  const [isDragging,  setIsDragging]  = useState(false);
  const inputRef = useRef(null);
  const fileRef  = useRef(null);

  function validate(f) {
    if (f.size > MAX_MB * 1048576) return `Too large (max ${MAX_MB}MB)`;
    const ok = ['application/pdf','text/plain','text/markdown','text/csv'];
    if (!ok.includes(f.type) && !/\.(pdf|txt|md|csv)$/i.test(f.name)) return 'Unsupported';
    return null;
  }

  function addFiles(fileList) {
    const items = Array.from(fileList).map(f => ({
      id: crypto.randomUUID(), file: f,
      name: f.name, size: f.size,
      status: 'queued', error: validate(f),
    }));
    setFiles(prev => [...prev, ...items]);
    items.filter(i => !i.error).forEach(uploadFile);
  }

  async function uploadFile(item) {
    setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'uploading' } : f));
    try {
      const content = await readAsText(item.file);
      const title   = item.name.replace(/\.[^.]+$/, '');
      await uploadDocument(title, content);
      setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'done' } : f));
      window.dispatchEvent(new CustomEvent('rag:doc-uploaded'));
    } catch (err) {
      setFiles(prev => prev.map(f => f.id === item.id
        ? { ...f, status: 'error', error: err.message } : f));
    }
  }

  function removeFile(id) {
    setFiles(prev => prev.filter(f => f.id !== id));
  }

  const onDrop = useCallback(e => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  }, []);

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleSend() {
    if (!text.trim() || loading) return;
    onSend(text.trim());
    setText('');
  }

  const uploading = files.some(f => f.status === 'uploading');
  const canSend   = text.trim().length > 0 && !loading && !uploading;

  return (
    <div
      className={`ci-wrap ${isDragging ? 'ci-wrap--drag' : ''}`}
      onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
    >
      {isDragging && (
        <div className="ci-drop-overlay">
          <UploadIcon />
          <span>Drop to attach</span>
        </div>
      )}

      {/* File pills */}
      {files.length > 0 && (
        <div className="ci-pills">
          {files.map(f => (
            <div key={f.id} className={`ci-pill ci-pill--${f.error ? 'error' : f.status}`}>
              <span className="ci-pill-name">{f.name}</span>
              {f.status === 'uploading' && <span className="ci-spin" />}
              {f.status === 'done'      && <span className="ci-ok">✓</span>}
              {(f.status === 'error' || f.error) && <span className="ci-fail" title={f.error}>✕</span>}
              {f.status !== 'uploading' && (
                <button className="ci-remove" onClick={() => removeFile(f.id)}>×</button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="ci-row">
        <button className="ci-attach" onClick={() => fileRef.current?.click()}
          title="Attach file" disabled={loading}>
          <AttachIcon />
        </button>
        <input ref={fileRef} type="file" multiple accept={ACCEPTED} className="sr-only"
          onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />

        <textarea
          ref={inputRef}
          className="ci-textarea"
          placeholder="Ask anything about your documents…"
          value={text}
          rows={1}
          onChange={e => {
            setText(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
          }}
          onKeyDown={handleKey}
          disabled={loading}
        />

        <button className={`ci-send ${canSend ? 'ci-send--active' : ''}`}
          onClick={handleSend} disabled={!canSend}>
          {loading ? <span className="ci-spin" /> : <SendIcon />}
        </button>
      </div>
    </div>
  );
}

function AttachIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.41 17.41a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/>
      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <polyline points="16 16 12 12 8 16"/>
      <line x1="12" y1="12" x2="12" y2="21"/>
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
    </svg>
  );
}