import { useState, useEffect, useRef } from 'react';
import { uploadDocument, listDocuments, clearSessionId } from '../../Api/ragApi';
import './Sidebar.css';

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

function fmt(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1048576) return `${(bytes/1024).toFixed(1)}KB`;
  return `${(bytes/1048576).toFixed(1)}MB`;
}

export default function Sidebar({ open, onToggle }) {
  const [docs,       setDocs]       = useState([]);
  const [uploads,    setUploads]    = useState([]); // { id, name, size, status, error }
  const [isDragging, setIsDragging] = useState(false);
  const [titleMap,   setTitleMap]   = useState({}); // id → custom title
  const fileRef = useRef(null);

  useEffect(() => {
    listDocuments().then(setDocs).catch(() => {});
  }, []);

  function validate(file) {
    if (file.size > MAX_MB * 1024 * 1024) return `Too large (max ${MAX_MB}MB)`;
    const ok = ['application/pdf','text/plain','text/markdown','text/csv'];
    if (!ok.includes(file.type) && !/\.(pdf|txt|md|csv)$/i.test(file.name))
      return 'Unsupported type';
    return null;
  }

  function queueFiles(files) {
    const items = Array.from(files).map(f => ({
      id:     crypto.randomUUID(),
      file:   f,
      name:   f.name,
      size:   f.size,
      status: 'queued',
      error:  validate(f),
    }));
    setUploads(prev => [...prev, ...items]);
    items.forEach(item => { if (!item.error) processUpload(item); });
  }

  async function processUpload(item) {
    setUploads(prev => prev.map(u => u.id === item.id ? { ...u, status: 'uploading' } : u));
    try {
      const text  = await readAsText(item.file);
      const title = (titleMap[item.id] || item.name).replace(/\.[^.]+$/, '');
      const res   = await uploadDocument(title, text);
      setUploads(prev => prev.map(u => u.id === item.id
        ? { ...u, status: 'done', chunks: res.chunks_indexed } : u));
      setDocs(prev => [{ document_id: res.document_id, title: res.title,
        chunk_count: res.chunks_indexed, created_at: res.created_at }, ...prev]);
    } catch (err) {
      setUploads(prev => prev.map(u => u.id === item.id
        ? { ...u, status: 'error', error: err.message } : u));
    }
  }

  function handleNewChat() {
    clearSessionId();
    window.dispatchEvent(new CustomEvent('rag:new-session'));
  }

  const onDrop = e => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files?.length) queueFiles(e.dataTransfer.files);
  };

  return (
    <>
      {/* Toggle button — always visible */}
      <button className="sidebar-toggle" onClick={onToggle} aria-label="Toggle sidebar">
        <span className={`toggle-icon ${open ? 'open' : ''}`} />
      </button>

      <aside className={`sidebar ${open ? 'open' : ''}`}>
        {/* Header */}
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="logo-mark" />
            <span>KnowledgeBot</span>
          </div>
          <button className="new-chat-btn" onClick={handleNewChat}>
            <PlusIcon /> New chat
          </button>
        </div>

        {/* Upload zone */}
        <div
          className={`upload-zone ${isDragging ? 'dragging' : ''}`}
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
        >
          <input ref={fileRef} type="file" multiple accept={ACCEPTED} className="sr-only"
            onChange={e => { queueFiles(e.target.files); e.target.value = ''; }} />
          <UploadIcon />
          <span className="upload-label">Upload documents</span>
          <span className="upload-hint">PDF · TXT · MD · CSV</span>
        </div>

        {/* Upload queue */}
        {uploads.length > 0 && (
          <div className="upload-queue">
            {uploads.map(u => (
              <div key={u.id} className={`upload-item upload-${u.status}`}>
                <FileIcon type={u.file?.type} />
                <div className="upload-item-info">
                  <span className="upload-item-name">{u.name}</span>
                  <span className="upload-item-meta">
                    {u.error  ? u.error :
                     u.status === 'done' ? `${u.chunks} chunks indexed` :
                     u.status === 'uploading' ? 'Indexing…' :
                     fmt(u.size)}
                  </span>
                </div>
                {u.status === 'uploading' && <span className="upload-spin" />}
                {u.status === 'done'      && <span className="upload-check">✓</span>}
                {(u.status === 'error' || u.error) && <span className="upload-err">✕</span>}
              </div>
            ))}
          </div>
        )}

        {/* Indexed docs list */}
        <div className="sidebar-section-label">
          {docs.length} document{docs.length !== 1 ? 's' : ''} indexed
        </div>
        <div className="doc-list">
          {docs.length === 0 && (
            <p className="doc-empty">No documents yet. Upload one above.</p>
          )}
          {docs.map(d => (
            <div key={d.document_id} className="doc-item">
              <DocIcon />
              <div className="doc-item-info">
                <span className="doc-item-title">{d.title}</span>
                <span className="doc-item-meta">{d.chunk_count} chunks</span>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 16 12 12 8 16"/>
      <line x1="12" y1="12" x2="12" y2="21"/>
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
    </svg>
  );
}

function FileIcon({ type }) {
  const isPdf = type === 'application/pdf';
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke={isPdf ? '#ef4444' : 'currentColor'} strokeWidth="2" strokeLinecap="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  );
}

function DocIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  );
}