import { useState, useEffect, useRef, useCallback } from 'react';
import { askQuestion, getSavedSessionId, saveSessionId, clearSessionId } from '../../Api/ragApi';
import ChatMessage from '../ChatMessage/ChatMessage';
import ChatInput from '../ChatInput/ChatInput';
import './Chatwindow.css';

const WELCOME = {
  id:     'welcome',
  role:   'assistant',
  text:   "Hello! I'm your knowledge assistant. Upload documents in the sidebar, then ask me anything about them.",
  ts:     Date.now(),
};

export default function ChatWindow() {
  const [messages,   setMessages]   = useState([WELCOME]);
  const [loading,    setLoading]    = useState(false);
  const [sessionId,  setSessionId]  = useState(getSavedSessionId);
  const [health,     setHealth]     = useState('checking'); // 'ok' | 'degraded' | 'checking'
  const bottomRef = useRef(null);

  // Health ping on mount
  useEffect(() => {
    fetch('http://localhost:3000/health')
      .then(r => r.json())
      .then(d => setHealth(d.status))
      .catch(() => setHealth('degraded'));
  }, []);

  // Listen for new session event from sidebar
  useEffect(() => {
    const handler = () => {
      setMessages([WELCOME]);
      setSessionId(null);
    };
    window.addEventListener('rag:new-session', handler);
    return () => window.removeEventListener('rag:new-session', handler);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || loading) return;

    const userMsg = {
      id:   crypto.randomUUID(),
      role: 'user',
      text: text.trim(),
      ts:   Date.now(),
    };

    const loadingId = crypto.randomUUID();
    const loadingMsg = {
      id:      loadingId,
      role:    'assistant',
      text:    '',
      loading: true,
      ts:      Date.now(),
    };

    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setLoading(true);

    try {
      const data = await askQuestion(text.trim(), sessionId);

      if (data.session_id && data.session_id !== sessionId) {
        setSessionId(data.session_id);
        saveSessionId(data.session_id);
      }

      const botMsg = {
        id:             loadingId,
        role:           'assistant',
        text:           data.answer,
        sources:        data.sources || [],
        retrieval_count: data.retrieval_count,
        tool_used:      data.tool_used,
        ts:             Date.now(),
        loading:        false,
      };

      setMessages(prev => prev.map(m => m.id === loadingId ? botMsg : m));
    } catch (err) {
      setMessages(prev => prev.map(m =>
        m.id === loadingId
          ? { ...m, text: `Error: ${err.message}`, loading: false, isError: true }
          : m
      ));
    } finally {
      setLoading(false);
    }
  }, [loading, sessionId]);

  const isFallback = (text) =>
    text === 'The answer is not found in the uploaded documents.';

  return (
    <div className="chat-window">
      {/* Top bar */}
      <div className="chat-topbar">
        <div className="chat-topbar-left">
          <span className="chat-title">Chat</span>
          {sessionId && (
            <span className="session-pill">
              session {sessionId.slice(0, 8)}…
            </span>
          )}
        </div>
        <div className="chat-topbar-right">
          <span className={`health-dot health-${health}`} title={`Backend: ${health}`} />
          <span className="health-label">{health === 'ok' ? 'Connected' : health === 'degraded' ? 'Degraded' : '…'}</span>
        </div>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.map(msg => (
          <ChatMessage key={msg.id} msg={msg} isFallback={isFallback(msg.text)} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="chat-input-area">
        <ChatInput onSend={sendMessage} loading={loading} />
        <p className="chat-disclaimer">
          Answers are grounded in your uploaded documents only.
        </p>
      </div>
    </div>
  );
}