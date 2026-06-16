'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { AnimatedCrystalBall } from '@/components/AnimatedCrystalBall';
import { SparkSpinner } from '@/components/SparkSpinner';
import { CrystalBallOracle } from '@/components/CrystalBallOracle';
import { useAuth } from '@/lib/auth-context';
import { useConversation } from '@/lib/conversation-context';
import { usePage } from '@/lib/page-context';
import type { ChatMessage, CompositionEnvelope } from '@/lib/types';
import { ArtifactCard } from '@/components/ArtifactCard';
import { PromptsLibrary } from '@/components/PromptsLibrary';
import {
  saveConversation,
  getConversations,
  autoTitle,
  nowISO,
} from '@/lib/firestore-service';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// ── Crystal-ball thinking indicator ──────────────────────────────────────────
const THINKING_PHRASES = [
  'Gazing into the warehouse…',
  'Reading the query leaves…',
  'The crystals are computing…',
  'Communing with the schema…',
  'Divining your results…',
  'Scanning the data plane…',
  'Interrogating the cosmos…',
  'Decoding the data stream…',
];

function CrystalBallThinking() {
  const [phrase, setPhrase] = useState(() => {
    const idx = Math.floor(Math.random() * THINKING_PHRASES.length);
    return THINKING_PHRASES[idx];
  });
  const current = useRef(phrase);

  useEffect(() => {
    const id = setInterval(() => {
      const pool = THINKING_PHRASES.filter(p => p !== current.current);
      const next = pool[Math.floor(Math.random() * pool.length)];
      current.current = next;
      setPhrase(next);
    }, 2800);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '6px 0 8px',
    }}>
      <SparkSpinner size={24} />
      <span style={{
        fontSize: 13,
        fontStyle: 'italic',
        color: 'var(--text-muted)',
        fontFamily: "'Google Sans', 'Inter', sans-serif",
        letterSpacing: '0.01em',
        transition: 'opacity 0.4s ease',
      }}>
        {phrase}
      </span>
    </div>
  );
}

export default function Home() {
  const { activeProject, user } = useAuth();
  const { conversationId, newConversation } = useConversation();
  const { activePage, setActivePage } = usePage();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [rerunningIdx, setRerunningIdx] = useState<number | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [context, setContext] = useState<{
    lastSkill?: string;
    lastResultRef?: string;
    lastTable?: string;
    dataset?: string;
    project?: string;
  }>({});

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const titleSetRef = useRef(false);

  // Auto-focus and auto-size the edit textarea when it opens
  useEffect(() => {
    if (editingIdx !== null && editTextareaRef.current) {
      const el = editTextareaRef.current;
      el.focus();
      el.selectionStart = el.selectionEnd = el.value.length;
      autoResizeEl(el);
    }
  }, [editingIdx]);

  const autoResizeEl = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    const maxHeight = Math.round(14 * 1.5 * 8 + 2); // 8 lines max
    el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px';
  };

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    // 5 lines × 14px font × 1.5 line-height + 2px padding buffer
    const maxHeight = Math.round(14 * 1.5 * 5 + 2);
    el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px';
  };
  useEffect(() => {
    if (!user) return;
    setMessages([]);
    setContext({});
    titleSetRef.current = false;

    getConversations(user.uid).then((convs) => {
      const match = convs.find((c) => c.id === conversationId);
      if (match) {
        setMessages(match.messages);
      }
    }).catch(() => {});
  }, [conversationId, user]);



  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-save conversation to Firestore after each assistant reply
  const persistConversation = useCallback(async (msgs: ChatMessage[]) => {
    if (!user || msgs.length === 0) return;
    const firstUserMsg = msgs.find((m) => m.role === 'user')?.content ?? 'New conversation';
    const title = titleSetRef.current
      ? undefined
      : autoTitle(firstUserMsg);
    if (title) titleSetRef.current = true;

    const existing = await getConversations(user.uid).then((c) => c.find((x) => x.id === conversationId)).catch(() => undefined);

    await saveConversation(user.uid, {
      id: conversationId,
      title: title ?? existing?.title ?? autoTitle(firstUserMsg),
      createdAt: existing?.createdAt ?? nowISO(),
      updatedAt: nowISO(),
      project: activeProject || context.project || '',
      messages: msgs,
    });
  }, [user, conversationId, activeProject, context.project]);

  // Submit an edited user message at `userIdx`, replacing it and the following assistant reply
  async function submitEdit(userIdx: number) {
    const text = editText.trim();
    if (!text || loading) return;
    setEditingIdx(null);
    setLoading(true);
    setRerunningIdx(userIdx + 1); // show spinner on the assistant msg below

    const historyBefore = messages.slice(0, userIdx);
    const editedUserMsg: ChatMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: text,
          history: historyBefore,
          context: { ...context, project: activeProject || context.project },
        }),
      });
      const data = await res.json();
      const envelopes: CompositionEnvelope[] = data.envelopes ?? [];
      const newAssistantMsg: ChatMessage = {
        role: 'assistant',
        content: '',
        envelopes,
        timestamp: new Date().toISOString(),
      };

      // Replace the user message and its immediately following assistant message
      const tail = messages.slice(userIdx + 1);
      const nextAssistantOffset = tail.findIndex((m) => m.role === 'assistant');
      const updatedMsgs = [
        ...historyBefore,
        editedUserMsg,
        newAssistantMsg,
        // Keep any messages after the replaced assistant response
        ...(nextAssistantOffset >= 0 ? tail.slice(nextAssistantOffset + 1) : []),
      ];
      setMessages(updatedMsgs);
      persistConversation(updatedMsgs).catch((e) => console.warn('[persist]', e));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRerunningIdx(null);
    }
  }

  // Re-run the user prompt that preceded message at index `assistantIdx`
  async function rerunMessage(assistantIdx: number) {
    if (loading) return;
    setRerunningIdx(assistantIdx);
    // Find the most recent user message before assistantIdx
    let userText = '';
    for (let i = assistantIdx - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userText = messages[i].content;
        break;
      }
    }
    if (!userText) return;

    // Truncate messages up to (but not including) the assistant message
    const historyUpTo = messages.slice(0, assistantIdx);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userText,
          history: historyUpTo.slice(0, -1),
          context: { ...context, project: activeProject || context.project },
        }),
      });

      const data = await res.json();
      const envelopes: CompositionEnvelope[] = data.envelopes ?? [];
      const newAssistantMsg: ChatMessage = {
        role: 'assistant',
        content: '',
        envelopes,
        timestamp: new Date().toISOString(),
      };

      // Replace the assistant message at assistantIdx with the new one
      const updatedMsgs = [
        ...messages.slice(0, assistantIdx),
        newAssistantMsg,
        ...messages.slice(assistantIdx + 1),
      ];
      setMessages(updatedMsgs);
      persistConversation(updatedMsgs).catch((e) => console.warn('[persist]', e));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRerunningIdx(null);
    }
  }

  async function sendMessage(messageText?: string) {
    const text = messageText ?? input.trim();
    if (!text || loading) return;

    setInput('');
    setLoading(true);

    const userMsg: ChatMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    const updatedMsgs = [...messages, userMsg];
    setMessages(updatedMsgs);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: text,
          history: messages,
          context: { ...context, project: activeProject || context.project },
        }),
      });

      if (res.status === 401) {
        const errorMsg: ChatMessage = {
          role: 'assistant',
          content: 'BigQuery authentication failed. If running locally, please run `/Users/schomer/google-cloud-sdk/bin/gcloud auth application-default login` in your terminal to authenticate your local environment. If hosted, verify that your service account has BigQuery permissions.',
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMsg]);
        setLoading(false);
        return;
      }


      if (res.status === 429) {
        const errorMsg: ChatMessage = {
          role: 'assistant',
          content: 'The AI model is a bit busy right now. Wait a few seconds and try again.',
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMsg]);
        setLoading(false);
        return;
      }


      const data = await res.json();
      const envelopes: CompositionEnvelope[] = data.envelopes ?? [];

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: '',
        envelopes,
        timestamp: new Date().toISOString(),
      };

      const finalMsgs = [...updatedMsgs, assistantMsg];
      setMessages(finalMsgs);

      if (envelopes.length > 0) {
        const last = envelopes[envelopes.length - 1];
        const schemaData = last.skill === 'schema'
          ? (last.primaryArtifact.data as { dataset?: string; table?: string } | null)
          : null;
        setContext((prev) => ({
          ...prev,
          lastSkill: last.skill,
          lastResultRef: last.id,
          // Capture dataset context when browsing a DATASET so table clicks can resolve correctly
          ...(schemaData?.dataset ? { dataset: schemaData.dataset } : {}),
          ...(schemaData?.table ? { lastTable: schemaData.table } : {}),
        }));
      }

      // Persist to Firestore — fire and forget, never surface Firestore errors to the user
      persistConversation(finalMsgs).catch((e) => console.warn('[persist]', e));

    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Something went wrong. Please try again.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  async function handleConfirm(envelope: CompositionEnvelope) {
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'confirm',
          history: messages,
          context: { ...context, project: activeProject || context.project, confirmedPayload: envelope.primaryArtifact.data },
        }),
      });
      const data = await res.json();
      const envelopes: CompositionEnvelope[] = data.envelopes ?? [];
      const assistantMsg: ChatMessage = { role: 'assistant', content: '', envelopes, timestamp: new Date().toISOString() };
      const finalMsgs = [...messages, assistantMsg];
      setMessages(finalMsgs);
      persistConversation(finalMsgs).catch((e) => console.warn('[persist]', e));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function handleCancel(envelope: CompositionEnvelope) {
    // Remove the message containing this envelope from the conversation
    setMessages((prev) =>
      prev.map((msg) =>
        msg.envelopes?.some((e) => e.id === envelope.id)
          ? { ...msg, envelopes: msg.envelopes?.filter((e) => e.id !== envelope.id) }
          : msg
      ).filter((msg) => !msg.envelopes || msg.envelopes.length > 0 || msg.content)
    );
  }

  function handleChipClick(chip: { label: string }) {
    sendMessage(chip.label);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const hasChat = messages.length > 0;

  return (
    <>
      {/* ── Prompts page (full inline view) ── */}
      {activePage === 'prompts' && (
        <PromptsLibrary
          open
          inline
          onClose={() => setActivePage('chat')}
          onUsePrompt={(text) => { setInput(text); setActivePage('chat'); inputRef.current?.focus(); }}
        />
      )}

      {/* ── Chat view ── */}
      <div style={{ display: activePage === 'prompts' ? 'none' : 'flex', flexDirection: 'column', height: '100%', background: 'var(--chat-bg)' }}>

        {/* ── EMPTY STATE: centered hero + prompt ── */}
        {!hasChat && (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}>
            <CrystalBallOracle ballSize={88} />
              <h1 style={{ fontSize: 22, fontWeight: 500, color: 'var(--text)', margin: '20px 0 6px', letterSpacing: '-0.2px' }}>
                BigQuery AIF
              </h1>
              <p style={{ color: 'var(--text-muted)', margin: '0 0 32px', fontSize: 14 }}>
                Ask anything about your data
              </p>




            {/* Centered prompt field */}
            <div style={{
              width: '100%',
              maxWidth: 640,
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 999,
              padding: '10px 10px 10px 20px',
              display: 'flex',
              alignItems: 'flex-end',
              gap: 10,
              boxShadow: '0 4px 32px rgba(0,0,0,0.10)',
            }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => { setInput(e.target.value); autoResize(e.target); }}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your data…"
                rows={1}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text)',
                  fontSize: 14,
                  resize: 'none',
                  lineHeight: 1.5,
                  fontFamily: 'inherit',
                  alignSelf: 'center',
                }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                style={{
                  width: 34,
                  height: 34,
                  flexShrink: 0,
                  borderRadius: '50%',
                  background: input.trim() ? '#bfdbfe' : 'var(--surface)',
                  border: `1px solid ${input.trim() ? '#93c5fd' : 'var(--border)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: input.trim() ? 'pointer' : 'default',
                  transition: 'all 0.15s',
                  padding: 0,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 13V3M8 3L3.5 7.5M8 3L12.5 7.5" stroke={input.trim() ? '#1d4ed8' : 'var(--text-muted)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* ── ACTIVE CHAT: scrollable message thread ── */}
        {hasChat && (
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px 24px 140px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
          }}>
            {messages.map((msg, i) => (
              <div key={i} className={i > 0 ? 'fade-up' : ''}>
                {msg.role === 'user' ? (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
                    {editingIdx === i ? (
                      /* ── Edit mode ── */
                      <div style={{
                        maxWidth: '70%',
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        alignItems: 'flex-end',
                      }}>
                        <textarea
                          ref={editTextareaRef}
                          value={editText}
                          onChange={(e) => { setEditText(e.target.value); autoResizeEl(e.target); }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitEdit(i); }
                            if (e.key === 'Escape') { setEditingIdx(null); }
                          }}
                          rows={1}
                          style={{
                            width: '100%',
                            background: 'var(--surface)',
                            border: '1.5px solid #93c5fd',
                            borderRadius: '12px 12px 4px 12px',
                            padding: '10px 14px',
                            fontSize: 14,
                            color: 'var(--text)',
                            lineHeight: 1.5,
                            resize: 'none',
                            outline: 'none',
                            fontFamily: 'inherit',
                            boxShadow: '0 0 0 3px rgba(147,197,253,0.25)',
                            transition: 'border-color 0.15s',
                          }}
                        />
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => setEditingIdx(null)}
                            style={{
                              padding: '4px 12px',
                              borderRadius: 6,
                              border: '1px solid var(--border)',
                              background: 'var(--surface-2)',
                              color: 'var(--text-muted)',
                              fontSize: 12,
                              cursor: 'pointer',
                            }}
                          >Cancel</button>
                          <button
                            onClick={() => submitEdit(i)}
                            disabled={!editText.trim() || loading}
                            style={{
                              padding: '4px 14px',
                              borderRadius: 6,
                              border: '1px solid #93c5fd',
                              background: '#bfdbfe',
                              color: '#1d4ed8',
                              fontSize: 12,
                              fontWeight: 500,
                              cursor: !editText.trim() || loading ? 'not-allowed' : 'pointer',
                              opacity: !editText.trim() || loading ? 0.5 : 1,
                            }}
                          >Save</button>
                        </div>
                      </div>
                    ) : (
                      /* ── View mode ── */
                      <div
                        role="button"
                        tabIndex={0}
                        title="Click to edit"
                        onClick={() => { if (!loading) { setEditingIdx(i); setEditText(msg.content); } }}
                        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !loading) { setEditingIdx(i); setEditText(msg.content); } }}
                        style={{
                          maxWidth: '70%',
                          background: 'var(--accent-dim)',
                          border: '1px solid #c5d8fb',
                          borderRadius: '16px 16px 4px 16px',
                          padding: '10px 16px',
                          fontSize: 14,
                          color: '#1557b0',
                          lineHeight: 1.5,
                          cursor: loading ? 'default' : 'text',
                          userSelect: 'text',
                        }}
                      >
                        {msg.content}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {msg.envelopes?.map((env) => (
                      <ArtifactCard
                        key={env.id}
                        envelope={env}
                        onConfirm={() => handleConfirm(env)}
                        onCancel={() => handleCancel(env)}
                        onChipClick={handleChipClick}
                      />
                    ))}
                    {!msg.envelopes && msg.content && (
                      <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                        {msg.content}
                      </div>
                    )}
                    {/* Regenerate button / inline spinner */}
                    <div style={{ display: 'flex', alignItems: 'center', marginTop: 2 }}>
                      {rerunningIdx === i ? (
                        <CrystalBallThinking />
                      ) : (
                        <button
                          id={`regenerate-btn-${i}`}
                          onClick={() => rerunMessage(i)}
                          disabled={loading}
                          title="Regenerate response"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            background: 'none',
                            border: '1px solid transparent',
                            borderRadius: 6,
                            padding: '3px 8px 3px 4px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            color: 'var(--text-muted)',
                            fontSize: 12,
                            opacity: loading ? 0.4 : 0.6,
                            transition: 'all 0.15s',
                          }}
                          onMouseEnter={(e) => {
                            if (!loading) {
                              (e.currentTarget as HTMLButtonElement).style.opacity = '1';
                              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)';
                              (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.opacity = '0.6';
                            (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent';
                            (e.currentTarget as HTMLButtonElement).style.background = 'none';
                          }}
                        >
                          <span
                            className="material-symbols-outlined"
                            style={{ fontSize: 14, lineHeight: 1, fontVariationSettings: `'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20` }}
                          >redo</span>
                          Regenerate
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {loading && rerunningIdx === null && <CrystalBallThinking />}
            <div ref={bottomRef} />
          </div>
        )}

        {/* ── Floating prompt bar (active chat only) ── */}
        {hasChat && (
          <div style={{
            position: 'fixed',
            bottom: 28,
            left: '50%',
            transform: 'translateX(-50%)',
            marginLeft: 110,
            width: 'min(680px, calc(100vw - 268px))',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 999,
            padding: '10px 10px 10px 20px',
            display: 'flex',
            alignItems: 'flex-end',
            gap: 10,
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            backdropFilter: 'blur(12px)',
            zIndex: 50,
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => { setInput(e.target.value); autoResize(e.target); }}
              onKeyDown={handleKeyDown}
              placeholder="Ask a follow-up…"
              rows={1}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text)',
                fontSize: 14,
                resize: 'none',
                lineHeight: 1.5,
                fontFamily: 'inherit',
                alignSelf: 'center',
              }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              style={{
                width: 34,
                height: 34,
                flexShrink: 0,
                borderRadius: '50%',
                background: input.trim() ? '#bfdbfe' : 'var(--surface)',
                border: `1px solid ${input.trim() ? '#93c5fd' : 'var(--border)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: input.trim() ? 'pointer' : 'default',
                transition: 'all 0.15s',
                padding: 0,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 13V3M8 3L3.5 7.5M8 3L12.5 7.5" stroke={input.trim() ? '#1d4ed8' : 'var(--text-muted)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        )}
      </div>
    </>
  );
}
