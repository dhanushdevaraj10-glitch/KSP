import React, { useState, useEffect, useRef, useCallback } from 'react';
import { streamAIResponse, THINKING_STEPS, getPredictions } from './aiEngine';
import type { AIMessage } from './aiEngine';

// ══════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════
interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  isStreaming?: boolean;
  predictions?: string[];
  timestamp: number;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  history: AIMessage[];
  createdAt: number;
  updatedAt: number;
}

// ══════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════
const STORAGE_KEY = 'sentinel_edge_chats';
const MAX_SESSIONS = 30;

const SUGGESTIONS = [
  { icon: '🔍', title: 'FIR ವಿಶ್ಲೇಷಣೆ', desc: 'ಇತ್ತೀಚಿನ FIR ದಾಖಲೆಗಳನ್ನು ವಿಶ್ಲೇಷಿಸಿ', prompt: 'ಇಂದಿನ FIR ದಾಖಲೆಗಳ ಸಂಪೂರ್ಣ ವಿಶ್ಲೇಷಣೆ ನೀಡಿ' },
  { icon: '📍', title: 'ಹಾಟ್‌ಸ್ಪಾಟ್ ಪತ್ತೆ', desc: 'ಅಪರಾಧ ಹಾಟ್‌ಸ್ಪಾಟ್ ನಕ್ಷೆ', prompt: 'ಬೆಂಗಳೂರಿನ ಅಪರಾಧ ಹಾಟ್‌ಸ್ಪಾಟ್‌ಗಳನ್ನು ತೋರಿಸಿ' },
  { icon: '📈', title: 'ಅಪರಾಧ ಪ್ರವೃತ್ತಿ', desc: 'ಈ ತಿಂಗಳ ಪ್ರವೃತ್ತಿ ವಿಶ್ಲೇಷಣೆ', prompt: 'ಕರ್ನಾಟಕ ರಾಜ್ಯದ ಅಪರಾಧ ಪ್ರವೃತ್ತಿ ವಿಶ್ಲೇಷಣೆ ನೀಡಿ' },
  { icon: '🚓', title: 'ಗಸ್ತು ಮಾರ್ಗ', desc: 'AI ಗಸ್ತು ಶಿಫಾರಸು ಪಡೆಯಿರಿ', prompt: 'ಇಂದಿನ ರಾತ್ರಿ ಗಸ್ತು ಮಾರ್ಗ ಶಿಫಾರಸು ಮಾಡಿ' },
];

const MENU_ITEMS = [
  { icon: '🏠', label: 'ಮುಖಪುಟ' },
  { icon: '🔍', label: 'FIR ಹುಡುಕಾಟ' },
  { icon: '📍', label: 'ಅಪರಾಧ ಹಾಟ್‌ಸ್ಪಾಟ್‌ಗಳು' },
  { icon: '📈', label: 'ಅಪರಾಧ ಪ್ರವೃತ್ತಿ' },
  { icon: '🧠', label: 'ಮಾದರಿ ಗುರುತಿಸುವಿಕೆ' },
  { icon: '📄', label: 'ವರದಿಗಳು' },
  { icon: '🔎', label: 'ಸಾಕ್ಷ್ಯ ಹುಡುಕಾಟ' },
];

// ══════════════════════════════════════════════════════
// LOCAL STORAGE HELPERS
// ══════════════════════════════════════════════════════
function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ChatSession[];
  } catch {
    return [];
  }
}

function saveSessions(sessions: ChatSession[]) {
  try {
    // Keep only last MAX_SESSIONS
    const trimmed = sessions.slice(-MAX_SESSIONS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // storage full — ignore
  }
}

function makeSessionTitle(firstMessage: string): string {
  return firstMessage.length > 35 ? firstMessage.slice(0, 35) + '...' : firstMessage;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'ಈಗ';
  if (m < 60) return `${m} ನಿಮಿಷ ಹಿಂದೆ`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ಗಂಟೆ ಹಿಂದೆ`;
  const d = Math.floor(h / 24);
  return `${d} ದಿನ ಹಿಂದೆ`;
}

// ══════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════
export default function App() {
  // Chat state
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [history, setHistory] = useState<AIMessage[]>([]);

  // UI state
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [inputFocused, setInputFocused] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Load sessions from localStorage on mount
  useEffect(() => {
    const saved = loadSessions();
    setSessions(saved);
  }, []);

  // ── Save sessions whenever they change
  useEffect(() => {
    if (sessions.length > 0) saveSessions(sessions);
  }, [sessions]);

  // ── Clock
  useEffect(() => {
    const tick = () => setCurrentTime(
      new Date().toLocaleTimeString('kn-IN', { hour: '2-digit', minute: '2-digit' })
    );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, statusText]);

  // ── Sync active session messages → local state
  useEffect(() => {
    if (!activeSessionId) { setMessages([]); setHistory([]); return; }
    const s = sessions.find(s => s.id === activeSessionId);
    if (s) { setMessages(s.messages); setHistory(s.history); }
  }, [activeSessionId, sessions]);

  // ── Persist messages back into sessions
  const persistSession = useCallback((
    sessionId: string,
    msgs: Message[],
    hist: AIMessage[]
  ) => {
    setSessions(prev => prev.map(s =>
      s.id === sessionId
        ? { ...s, messages: msgs, history: hist, updatedAt: Date.now() }
        : s
    ));
  }, []);

  // ── Create new session
  const createNewSession = useCallback((): string => {
    const id = `session_${Date.now()}`;
    const session: ChatSession = {
      id, title: 'ಹೊಸ ತನಿಖೆ',
      messages: [], history: [],
      createdAt: Date.now(), updatedAt: Date.now(),
    };
    setSessions(prev => [...prev, session]);
    setActiveSessionId(id);
    setMessages([]);
    setHistory([]);
    setInput('');
    setPendingFile(null);
    return id;
  }, []);

  // ── Load session
  const openSession = useCallback((sessionId: string) => {
    const s = sessions.find(s => s.id === sessionId);
    if (!s) return;
    setActiveSessionId(sessionId);
    setMessages(s.messages);
    setHistory(s.history);
    setInput('');
    setPendingFile(null);
  }, [sessions]);

  // ── Delete session
  const deleteSession = useCallback((sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    if (activeSessionId === sessionId) {
      setActiveSessionId(null);
      setMessages([]);
      setHistory([]);
    }
  }, [activeSessionId]);

  // ── Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 180) + 'px';
  };

  // ══════════════════════════════════════════════════════
  // SEND MESSAGE
  // ══════════════════════════════════════════════════════
  const sendMessage = useCallback(async (promptText?: string) => {
    const text = (promptText ?? input).trim();
    if (!text && !pendingFile) return;
    if (isLoading) return;

    // Ensure we have a session
    let sessionId = activeSessionId;
    if (!sessionId) sessionId = createNewSession();

    let displayText = text;
    let aiPrompt = text;

    if (pendingFile) {
      displayText = text ? `📎 ${pendingFile.name}\n\n${text}` : `📎 ${pendingFile.name} — ದಯವಿಟ್ಟು ವಿಶ್ಲೇಷಿಸಿ`;
      aiPrompt = `"${pendingFile.name}" ಫೈಲ್ ಅಪ್‌ಲೋಡ್ ಆಗಿದೆ. ${text || 'ಸಂಪೂರ್ಣ ವಿಶ್ಲೇಷಣೆ ಮತ್ತು ವರದಿ ನೀಡಿ.'}`;
      setPendingFile(null);
    }

    const userMsg: Message = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: displayText,
      timestamp: Date.now(),
    };

    const updatedMsgs = [...messages, userMsg];
    setMessages(updatedMsgs);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const newHistory: AIMessage[] = [...history, { role: 'user', content: aiPrompt }];

    setIsLoading(true);
    setStatusText(THINKING_STEPS[0]);

    const aiMsgId = `a_${Date.now()}`;
    const aiMsg: Message = {
      id: aiMsgId,
      role: 'ai',
      content: '',
      isStreaming: true,
      timestamp: Date.now(),
    };

    const msgsWithAI = [...updatedMsgs, aiMsg];
    setMessages(msgsWithAI);

    // Update session title from first user message
    const firstUserText = updatedMsgs.find(m => m.role === 'user')?.content;
    if (firstUserText) {
      setSessions(prev => prev.map(s =>
        s.id === sessionId
          ? { ...s, title: makeSessionTitle(firstUserText) }
          : s
      ));
    }

    let aiContent = '';

    await streamAIResponse(
      aiPrompt,
      newHistory,
      (token) => {
        aiContent += token;
        setStatusText('');
        setMessages(prev =>
          prev.map(m => m.id === aiMsgId ? { ...m, content: aiContent, isStreaming: true } : m)
        );
      },
      (status) => setStatusText(status),
      () => {
        const preds = getPredictions(aiPrompt);
        const finalMsgs: Message[] = msgsWithAI.map(m =>
          m.id === aiMsgId
            ? { ...m, content: aiContent, isStreaming: false, predictions: preds }
            : m
        );
        setMessages(finalMsgs);

        const finalHistory: AIMessage[] = [...newHistory, { role: 'assistant', content: aiContent }];
        setHistory(finalHistory);

        // Persist to localStorage
        if (sessionId) persistSession(sessionId, finalMsgs, finalHistory);

        setIsLoading(false);
        setStatusText('');
      }
    );
  }, [input, isLoading, pendingFile, history, messages, activeSessionId, createNewSession, persistSession]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) { setPendingFile(e.target.files[0]); e.target.value = ''; }
  };

  const toggleRecording = () => {
    setIsRecording(prev => !prev);
    if (!isRecording) {
      setTimeout(() => {
        setIsRecording(false);
        setInput('ಶಿವಾಜಿನಗರದಲ್ಲಿ ಕಳೆದ ವಾರದ ದರೋಡೆ ಪ್ರಕರಣಗಳನ್ನು ತೋರಿಸಿ');
        textareaRef.current?.focus();
      }, 2500);
    }
  };

  // Filtered sessions for search
  const filteredSessions = searchQuery
    ? sessions.filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : [...sessions].reverse();

  // Group sessions by date
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  function groupLabel(ts: number): string {
    const d = new Date(ts).toDateString();
    if (d === today) return 'ಇಂದು';
    if (d === yesterday) return 'ನಿನ್ನೆ';
    return new Date(ts).toLocaleDateString('kn-IN', { month: 'long', day: 'numeric' });
  }

  const groupedSessions = filteredSessions.reduce<Record<string, ChatSession[]>>((acc, s) => {
    const label = groupLabel(s.updatedAt);
    if (!acc[label]) acc[label] = [];
    acc[label].push(s);
    return acc;
  }, {});

  // ══════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════
  return (
    <div className="app">

      {/* ═══════════ SIDEBAR ═══════════ */}
      <aside className="sidebar">
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="logo-icon">🛡️</div>
          <div className="logo-text">
            <h1>Sentinel Edge</h1>
            <p>ಕರ್ನಾಟಕ ರಾಜ್ಯ ಪೊಲೀಸ್</p>
          </div>
        </div>

        {/* New Chat */}
        <button className="new-chat-btn" onClick={createNewSession}>
          ✏️ &nbsp;ಹೊಸ ತನಿಖೆ
        </button>

        {/* Menu */}
        <div style={{ padding: '4px 8px 0' }}>
          <div className="sidebar-section-label">ಮೆನು</div>
          {MENU_ITEMS.map((item, i) => (
            <button key={i} className="menu-item" onClick={() => {
              if (i === 0) createNewSession();
            }}>
              <span className="icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>

        {/* Chat History */}
        <div className="sidebar-menu" style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 8 }}>
          {/* Search bar */}
          <div style={{ padding: '0 8px 8px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '6px 10px'
            }}>
              <span style={{ fontSize: 13 }}>🔍</span>
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="ಹಿಂದಿನ ಸಂಭಾಷಣೆ ಹುಡುಕಿ..."
                style={{
                  background: 'none', border: 'none', outline: 'none',
                  color: 'var(--text-primary)', fontSize: 12, width: '100%',
                  fontFamily: 'inherit'
                }}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14 }}>✕</button>
              )}
            </div>
          </div>

          {/* Sessions grouped by date */}
          {Object.keys(groupedSessions).length === 0 ? (
            <div style={{ padding: '8px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
              ಇನ್ನೂ ಯಾವುದೇ ಸಂಭಾಷಣೆ ಇಲ್ಲ
            </div>
          ) : (
            Object.entries(groupedSessions).map(([label, group]) => (
              <div key={label}>
                <div className="sidebar-section-label">{label}</div>
                {group.map(session => (
                  <div key={session.id} style={{ position: 'relative' }}>
                    <button
                      className={`menu-item ${activeSessionId === session.id ? 'active' : ''}`}
                      style={{ paddingRight: 28 }}
                      onClick={() => openSession(session.id)}
                    >
                      <span style={{ fontSize: 13 }}>💬</span>
                      <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>
                        {session.title}
                      </span>
                    </button>
                    <button
                      onClick={(e) => deleteSession(session.id, e)}
                      style={{
                        position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', color: 'var(--text-muted)',
                        cursor: 'pointer', fontSize: 13, padding: '2px 4px',
                        borderRadius: 4, lineHeight: 1,
                      }}
                      title="ಅಳಿಸಿ"
                    >✕</button>
                    <div style={{ padding: '0 10px 4px 35px', fontSize: 10, color: 'var(--text-muted)' }}>
                      {timeAgo(session.updatedAt)} · {session.messages.length} ಸಂದೇಶ
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>

        {/* Bottom status */}
        <div className="sidebar-bottom">
          <button className="menu-item">⚙️ ಸೆಟ್ಟಿಂಗ್‌ಗಳು</button>
          <button className="menu-item">👤 ನನ್ನ ಪ್ರೊಫೈಲ್</button>
          <button className="menu-item">🚪 ಲಾಗ್ ಔಟ್</button>
          <div className="status-bar" style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              <div className="status-dot"></div>
              AI ಆನ್‌ಲೈನ್ · {sessions.length} ಸಂಭಾಷಣೆ
            </div>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>v2.0</span>
          </div>
        </div>
      </aside>

      {/* ═══════════ MAIN ═══════════ */}
      <main className="main">

        {/* HEADER */}
        <header className="header">
          <div className="header-left">
            <div className="header-badge ai-badge">🤖 AI ಗುಪ್ತಚರ ಸಹಾಯಕ</div>
            <div className="header-badge">📍 ಬೆಂಗಳೂರು ಕೇಂದ್ರ ಠಾಣೆ</div>
          </div>
          <div className="header-right">
            <button className="icon-btn">🔔</button>
            <div className="officer-info">
              <div className="name">ಇನ್ಸ್‌ಪೆಕ್ಟರ್ ರಮೇಶ್</div>
              <div className="rank">{currentTime} · KSP-2847</div>
            </div>
            <div className="avatar">ರ</div>
          </div>
        </header>

        {/* CHAT AREA */}
        <div className="chat-area">
          {messages.length === 0 ? (
            /* Welcome */
            <div className="welcome-screen">
              <div className="welcome-icon">🛡️</div>
              <h2 className="welcome-title">AI ಅಪರಾಧ ಗುಪ್ತಚರ ಸಹಾಯಕ</h2>
              <p className="welcome-subtitle">
                FIR ದಾಖಲೆಗಳು, ಅಪರಾಧ ಮಾದರಿಗಳು, ಹಾಟ್‌ಸ್ಪಾಟ್‌ಗಳು ಮತ್ತು ತನಿಖೆಯ ಯಾವುದೇ ವಿಷಯ ಬಗ್ಗೆ ನಿಮ್ಮ ಪ್ರಶ್ನೆ ಕೇಳಿ.
              </p>
              <div className="suggestions-grid">
                {SUGGESTIONS.map((s, i) => (
                  <button key={i} className="suggestion-card" onClick={() => sendMessage(s.prompt)}>
                    <div className="icon">{s.icon}</div>
                    <div className="title">{s.title}</div>
                    <div className="desc">{s.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <div key={msg.id} className={`message-row ${msg.role}`}>
                  {msg.role === 'ai' && <div className="message-avatar ai">🛡️</div>}

                  <div className="message-content-wrap">
                    {/* Message bubble */}
                    <div className={`message-bubble ${msg.role}`}>
                      {msg.content}
                      {msg.isStreaming && (
                        <span style={{
                          display: 'inline-block', width: 2, height: '1em',
                          background: '#60a5fa', marginLeft: 2, verticalAlign: 'middle',
                          animation: 'blink 1s step-end infinite'
                        }} />
                      )}
                    </div>

                    {/* Timestamp */}
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                      {new Date(msg.timestamp).toLocaleTimeString('kn-IN', { hour: '2-digit', minute: '2-digit' })}
                    </div>

                    {/* AI Predictions (shown only on last AI message after streaming) */}
                    {msg.role === 'ai' && !msg.isStreaming && msg.predictions && msg.predictions.length > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span>⚡</span> ಮುಂದಿನ ಸಂಭಾವ್ಯ ಪ್ರಶ್ನೆಗಳು
                        </div>
                        <div className="message-actions">
                          {msg.predictions.slice(0, 4).map((pred, i) => (
                            <button
                              key={i}
                              className="action-chip"
                              onClick={() => sendMessage(pred.replace(/^[^\s]+\s/, ''))}
                            >
                              {pred}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {msg.role === 'user' && <div className="message-avatar user">👮</div>}
                </div>
              ))}

              {/* Typing indicator */}
              {isLoading && statusText && (
                <div className="typing-row">
                  <div className="message-avatar ai">🛡️</div>
                  <div className="typing-bubble">
                    <div className="typing-spinner"></div>
                    {statusText}
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* INPUT AREA */}
        <div className="input-area">
          <div className="input-wrap">
            <div className={`input-container ${inputFocused ? 'focused' : ''}`}>
              {pendingFile && (
                <div className="file-preview">
                  <div className="file-preview-name">
                    📎 {pendingFile.name}
                    <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                      &nbsp;({(pendingFile.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <button className="remove-file" onClick={() => setPendingFile(null)}>✕</button>
                </div>
              )}
              <div className="input-top">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                  placeholder="ಅಪರಾಧ ಮಾಹಿತಿಯ ಬಗ್ಗೆ ನಿಮ್ಮ ಪ್ರಶ್ನೆಯನ್ನು ಇಲ್ಲಿ ನಮೂದಿಸಿ..."
                  disabled={isLoading}
                  rows={1}
                />
                <button
                  className="send-btn"
                  onClick={() => sendMessage()}
                  disabled={isLoading || (!input.trim() && !pendingFile)}
                >
                  {isLoading ? '⏳' : '➤'}
                </button>
              </div>
              <div className="input-bottom">
                <div className="input-tools">
                  {/* File upload */}
                  <button className="tool-btn" title="ಫೈಲ್ ಅಪ್‌ಲೋಡ್ (PDF, CSV, DOCX)">
                    📎
                    <input type="file" onChange={handleFileChange}
                      accept=".pdf,.csv,.txt,.docx,.xlsx,.png,.jpg,.jpeg" />
                  </button>
                  {/* Image upload */}
                  <button className="tool-btn" title="ಚಿತ್ರ ಅಪ್‌ಲೋಡ್">
                    🖼️
                    <input type="file" onChange={handleFileChange} accept="image/*" />
                  </button>
                  {/* Voice */}
                  <button
                    className={`tool-btn mic-btn ${isRecording ? 'recording' : ''}`}
                    title="ಕನ್ನಡ ಧ್ವನಿ ಇನ್‌ಪುಟ್"
                    onClick={toggleRecording}
                  >
                    {isRecording ? '🔴' : '🎙️'}
                  </button>
                  {/* Location */}
                  <button className="tool-btn" title="ಸ್ಥಳ ಸೇರಿಸಿ">📍</button>
                </div>
                <span className="input-hint">
                  Enter — ಕಳುಹಿಸಿ &nbsp;·&nbsp; Shift+Enter — ಹೊಸ ಸಾಲು
                </span>
              </div>
            </div>
            <p className="disclaimer">
              🔒 Sentinel Edge AI ತಪ್ಪು ಮಾಡಬಹುದು. ಪ್ರಮುಖ ಮಾಹಿತಿಯನ್ನು ಯಾವಾಗಲೂ ಪರಿಶೀಲಿಸಿ. ಗೌಪ್ಯ.
            </p>
          </div>
        </div>
      </main>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        .input-container.focused { border-color: var(--border-bright); box-shadow: 0 0 0 3px rgba(59,130,246,0.08); }
      `}</style>
    </div>
  );
}
