import './ChatMessage.css';

export default function ChatMessage({ msg, isFallback }) {
  const isUser = msg.role === 'user';

  return (
    <div className={`msg-row ${isUser ? 'msg-row--user' : 'msg-row--bot'}`}>
      {!isUser && (
        <div className="msg-avatar">
          <BotIcon />
        </div>
      )}

      <div className={`msg-bubble ${isUser ? 'msg-bubble--user' : 'msg-bubble--bot'} ${isFallback ? 'msg-bubble--fallback' : ''} ${msg.isError ? 'msg-bubble--error' : ''}`}>
        {/* Loading dots */}
        {msg.loading ? (
          <div className="msg-typing">
            <span /><span /><span />
          </div>
        ) : (
          <>
            <p className="msg-text">{msg.text}</p>

            {/* Tool badge */}
            {msg.tool_used && (
              <div className="msg-tool-badge">
                <ToolIcon tool={msg.tool_used} />
                {msg.tool_used}
              </div>
            )}

            {/* Sources */}
            {msg.sources?.length > 0 && !isFallback && (
              <div className="msg-sources">
                <span className="msg-sources-label">Sources</span>
                {msg.sources.map(s => (
                  <div key={s.chunk_id} className="msg-source-item">
                    <span className="msg-source-title">{s.document_title}</span>
                    <span className="msg-source-score">
                      {Math.round(s.relevance_score * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Timestamp */}
            <span className="msg-time">
              {new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </>
        )}
      </div>

      {isUser && (
        <div className="msg-avatar msg-avatar--user">
          <UserIcon />
        </div>
      )}
    </div>
  );
}

function BotIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2"/>
      <path d="M12 11V5"/>
      <circle cx="12" cy="4" r="1"/>
      <line x1="8" y1="15" x2="8" y2="15"/>
      <line x1="16" y1="15" x2="16" y2="15"/>
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  );
}

function ToolIcon({ tool }) {
  if (tool === 'calculator') return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="4" y="2" width="16" height="20" rx="2"/>
      <line x1="8" y1="6" x2="16" y2="6"/>
      <line x1="8" y1="10" x2="8" y2="10"/>
      <line x1="12" y1="10" x2="12" y2="10"/>
      <line x1="16" y1="10" x2="16" y2="10"/>
    </svg>
  );
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12" y2="16"/>
    </svg>
  );
}