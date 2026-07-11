'use client';

import { useState, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useConversation } from '@/lib/conversation-context';
import { ChatOrchestrator } from '@/lib/chat-orchestrator';
import type {
  ChatMessage,
  CompositionEnvelope,
  SkillName,
  StepInfo,
  DataManagementResult,
  HandoffEnvelope,
  ContextItem,
  OperationLogEntry,
  SavedArtifact,
  SavedArtifactType,
  ArtifactStep,
  ParameterDef,
} from '@/lib/types';
import {
  saveConversation,
  getConversations,
  autoTitle,
  nowISO,
} from '@/lib/firestore-service';
import { saveArtifact, recordRun } from '@/lib/saved-work';

// ---- Types ----------------------------------------------------------------

export interface ChatContext {
  lastSkill?: SkillName;
  lastResultRef?: string;
  lastTable?: string;
  dataset?: string;
  project?: string;
}

export interface ChatError {
  message: string;
  type: string;
  sql?: string;
  retryFn?: () => void | Promise<void>;
}

export interface ChatOrchestrationReturn {
  // State
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  loading: boolean;
  input: string;
  setInput: (value: string) => void;
  context: ChatContext;
  setContext: React.Dispatch<React.SetStateAction<ChatContext>>;
  contextItems: ContextItem[];
  setContextItems: React.Dispatch<React.SetStateAction<ContextItem[]>>;
  pinnedEnvelopeId: string | null;
  setPinnedEnvelopeId: React.Dispatch<React.SetStateAction<string | null>>;
  statusText: string | null;
  lastError: ChatError | null;
  setLastError: (error: ChatError | null) => void;
  thinkingSteps: Record<number, (string | StepInfo)[]>;
  editingIdx: number | null;
  editText: string;
  setEditText: (text: string) => void;
  rerunningIdx: number | null;

  // Actions
  sendMessage: (text?: string) => Promise<void>;
  handleConfirm: (envelope: CompositionEnvelope) => Promise<void>;
  handleCancel: (envelope: CompositionEnvelope) => void;
  handleChipClick: (chip: HandoffEnvelope) => Promise<void>;
  handleRunSql: (sql: string) => void;
  handleInlineClick: (message: string) => void;
  removeContextItem: (id: string) => void;
  pinEnvelopeContext: (env: CompositionEnvelope, focusInput?: () => void) => void;
  extractContextItems: (env: CompositionEnvelope) => ContextItem[];
  startEdit: (idx: number, text: string) => void;
  cancelEdit: () => void;
  submitEdit: (userIdx: number) => Promise<void>;
  rerunMessage: (assistantIdx: number) => Promise<void>;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;

  // Refs
  titleSetRef: React.MutableRefObject<boolean>;
  pendingStepsRef: React.MutableRefObject<(string | StepInfo)[]>;

  // Persistence
  persistConversation: (msgs: ChatMessage[]) => Promise<void>;

  // Saved work
  saveModalState: {
    open: boolean;
    envelope?: CompositionEnvelope;
    type: SavedArtifactType;
    defaultName: string;
    defaultDescription: string;
  } | null;
  saveEnvelopeAsArtifact: (envelope: CompositionEnvelope) => void;
  handleSaveConfirm: (name: string, description: string, tags: string[]) => Promise<void>;
  handleSaveModalClose: () => void;
  saveChatAsWorkflow: (name: string, description: string, tags: string[]) => Promise<void>;
  runSavedArtifact: (artifact: SavedArtifact) => Promise<void>;
}

// ---- Hook -----------------------------------------------------------------

export function useChatOrchestration(): ChatOrchestrationReturn {
  const { activeProject, user, signIn, refreshAccessToken } = useAuth();
  const { conversationId, addOperation } = useConversation();

  // Core state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [rerunningIdx, setRerunningIdx] = useState<number | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [context, setContext] = useState<ChatContext>({});
  const [contextItems, setContextItems] = useState<ContextItem[]>([]);
  const [pinnedEnvelopeId, setPinnedEnvelopeId] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [lastError, setLastError] = useState<ChatError | null>(null);
  const [thinkingSteps, setThinkingSteps] = useState<Record<number, (string | StepInfo)[]>>({});
  const [saveModalState, setSaveModalState] = useState<{
    open: boolean;
    envelope?: CompositionEnvelope;
    type: SavedArtifactType;
    defaultName: string;
    defaultDescription: string;
  } | null>(null);

  // Refs
  const titleSetRef = useRef(false);
  const pendingStepsRef = useRef<(string | StepInfo)[]>([]);
  const authRetrying = useRef(false);

  // ---- Auth-retry wrapper ------------------------------------------------

  function looksLikeAuthError(msg: string): boolean {
    const lower = msg.toLowerCase();
    return lower.includes('access token') || lower.includes('credentials') || lower.includes('access_denied')
      || lower.includes('unauthenticated') || lower.includes('authorized') || lower.includes('sign in')
      || lower.includes('invalid authentication') || lower.includes('oauth 2');
  }

  async function withAuthRetry<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (looksLikeAuthError(msg) && !authRetrying.current) {
        authRetrying.current = true;
        setStatusText('Refreshing session...');
        try {
          const ok = await refreshAccessToken();
          if (ok) {
            const result = await fn();
            authRetrying.current = false;
            return result;
          }
        } catch {
          // retry also failed -- fall through
        }
        authRetrying.current = false;
      }
      throw err;
    }
  }

  // ---- Context helpers ---------------------------------------------------

  function extractContextFromEnvelope(env: CompositionEnvelope): Partial<ChatContext> {
    const data = env.primaryArtifact.data as Record<string, unknown> | null;
    if (!data) return {};
    const result: Partial<ChatContext> = {};

    if (data.dataset && typeof data.dataset === 'string') result.dataset = data.dataset;
    if (data.table && typeof data.table === 'string') result.lastTable = data.table;

    if (data.sql && typeof data.sql === 'string') {
      const sqlMatch = (data.sql as string).match(/\bFROM\s+`?([A-Za-z0-9_.-]+)`?/i);
      if (sqlMatch) {
        const parts = sqlMatch[1].split('.');
        if (parts.length >= 3) result.dataset = parts[parts.length - 2];
        result.lastTable = parts[parts.length - 1];
      }
    }

    if (env.skill === 'data-quality' || env.skill === 'data-management') {
      const tableFq = data.table as string | undefined;
      if (tableFq && typeof tableFq === 'string') {
        const parts = tableFq.replace(/`/g, '').split('.');
        if (parts.length >= 2) result.dataset = parts[parts.length - 2];
        result.lastTable = parts[parts.length - 1];
      }
    }

    return result;
  }

  function extractContextItems(env: CompositionEnvelope): ContextItem[] {
    const items: ContextItem[] = [];
    const data = env.primaryArtifact.data as Record<string, unknown> | null;
    if (!data) return items;

    let ds: string | undefined;
    let tbl: string | undefined;
    const sql = (data.sql as string | undefined) || env.provenance.sql;

    if (data.dataset && typeof data.dataset === 'string') ds = data.dataset;
    if (data.table && typeof data.table === 'string') tbl = data.table;

    if (sql) {
      const sqlMatch = sql.match(/\bFROM\s+`?([A-Za-z0-9_.-]+)`?/i);
      if (sqlMatch) {
        const parts = sqlMatch[1].split('.');
        if (parts.length >= 3 && !ds) ds = parts[parts.length - 2];
        if (!tbl) tbl = parts[parts.length - 1];
      }
    }

    if (env.skill === 'data-quality' || env.skill === 'data-management') {
      const tableFq = data.table as string | undefined;
      if (tableFq && typeof tableFq === 'string') {
        const parts = tableFq.replace(/`/g, '').split('.');
        if (parts.length >= 2 && !ds) ds = parts[parts.length - 2];
        if (!tbl) tbl = parts[parts.length - 1];
      }
    }

    if (ds && !tbl) {
      items.push({
        id: `ds_${env.id}`,
        type: 'dataset',
        label: ds,
        icon: 'dataset',
        dataset: ds,
      });
    }

    if (tbl) {
      items.push({
        id: `tbl_${env.id}`,
        type: 'table',
        label: tbl,
        icon: 'table_chart',
        dataset: ds,
        table: tbl,
      });
    }

    const rowCount = Array.isArray(data.rows) ? (data.rows as unknown[]).length : null;
    if (rowCount !== null && env.primaryArtifact.type !== 'SCHEMA_VIEW') {
      items.push({
        id: `res_${env.id}`,
        type: 'result',
        label: `${rowCount} rows`,
        icon: 'query_stats',
        dataset: ds,
        table: tbl,
        skill: env.skill,
        resultRef: env.id,
        sql: sql,
      });
    }

    return items;
  }

  function removeContextItem(id: string) {
    setContextItems((prev) => prev.filter((item) => item.id !== id));
  }

  function pinEnvelopeContext(env: CompositionEnvelope, focusInput?: () => void) {
    const items = extractContextItems(env);
    if (items.length === 0) return;
    setContextItems(items);
    setPinnedEnvelopeId(env.id);
    focusInput?.();
  }

  function deriveContextFromItems(): ChatContext {
    const dsItem = contextItems.find((i) => i.type === 'dataset');
    const tblItem = contextItems.find((i) => i.type === 'table');
    const resItem = contextItems.find((i) => i.type === 'result');
    return {
      ...context,
      dataset: dsItem?.dataset ?? tblItem?.dataset ?? context.dataset,
      lastTable: tblItem?.table ?? context.lastTable,
      lastSkill: resItem?.skill ?? context.lastSkill,
      lastResultRef: resItem?.resultRef ?? context.lastResultRef,
    };
  }

  // ---- Persistence -------------------------------------------------------

  const persistConversation = useCallback(async (msgs: ChatMessage[]) => {
    if (!user || msgs.length === 0) return;
    // Use the most recent user message as the conversation title
    const userMsgs = msgs.filter((m) => m.role === 'user');
    const lastUserMsg = userMsgs.length > 0 ? userMsgs[userMsgs.length - 1].content : 'New conversation';

    const existing = await getConversations(user.uid).then((c) => c.find((x) => x.id === conversationId)).catch(() => undefined);

    await saveConversation(user.uid, {
      id: conversationId,
      title: autoTitle(lastUserMsg),
      createdAt: existing?.createdAt ?? nowISO(),
      updatedAt: nowISO(),
      project: activeProject || context.project || '',
      messages: msgs,
    });
  }, [user, conversationId, activeProject, context.project]);

  // ---- Update context from envelopes ------------------------------------

  function updateContextFromEnvelopes(envelopes: CompositionEnvelope[]) {
    if (envelopes.length > 0) {
      const last = envelopes[envelopes.length - 1];
      setContext((prev) => ({
        ...prev,
        lastSkill: last.skill,
        lastResultRef: last.id,
        ...extractContextFromEnvelope(last),
      }));
      const autoItems = extractContextItems(last);
      if (autoItems.length > 0) {
        setContextItems(autoItems);
        setPinnedEnvelopeId(null);
      }
    }
  }

  // ---- Log operations from envelopes for conversation summary -------------

  const DML_OPERATIONS = new Set(['DEDUPE', 'DELETE', 'UPDATE', 'FILL_NULLS', 'MERGE']);

  function logOperationsFromEnvelopes(envelopes: CompositionEnvelope[], baseIndex: number) {
    for (const env of envelopes) {
      const data = env.primaryArtifact.data as Record<string, unknown> | null;
      let operation = env.skill as string;
      let table: string | undefined;
      let undoable = false;

      // Extract table from envelope data
      if (data?.table && typeof data.table === 'string') {
        const parts = (data.table as string).replace(/`/g, '').split('.');
        table = parts[parts.length - 1];
      }
      if (!table && env.provenance?.sql) {
        const m = env.provenance.sql.match(/\bFROM\s+`?([A-Za-z0-9_.-]+)`?/i);
        if (m) {
          const parts = m[1].split('.');
          table = parts[parts.length - 1];
        }
      }

      // Classify operation more specifically
      if (env.skill === 'data-management' && data?.operation) {
        operation = String(data.operation).toLowerCase();
        undoable = DML_OPERATIONS.has(String(data.operation));
      } else if (env.skill === 'data-loading' && data?.operationType) {
        operation = String(data.operationType).toLowerCase();
      } else if (env.skill === 'data-quality') {
        operation = 'quality_check';
      }

      const entry: OperationLogEntry = {
        messageIndex: baseIndex,
        skill: env.skill,
        operation,
        table,
        timestamp: new Date().toISOString(),
        undoable,
      };
      addOperation(entry);
    }
  }

  // ---- Message handlers --------------------------------------------------

  async function sendMessage(messageText?: string) {
    const text = messageText ?? input.trim();
    if (!text || loading) return;

    setInput('');
    setLoading(true);
    pendingStepsRef.current = [];

    const userMsg: ChatMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    const updatedMsgs = [...messages, userMsg];
    setMessages(updatedMsgs);

    try {
      const derivedCtx = deriveContextFromItems();
      const data = await withAuthRetry(() => ChatOrchestrator.processMessage({
        message: text,
        history: messages,
        context: { ...derivedCtx, project: activeProject || derivedCtx.project, uid: user?.uid },
        onStatus: (s: string | StepInfo) => { setStatusText(typeof s === 'string' ? s : s.text); pendingStepsRef.current.push(s); },
      }));

      const envelopes: CompositionEnvelope[] = data.envelopes ?? [];

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: '',
        envelopes,
        timestamp: new Date().toISOString(),
      };

      const finalMsgs = [...updatedMsgs, assistantMsg];
      setMessages(finalMsgs);
      const assistantIdx = finalMsgs.length - 1;
      setThinkingSteps((prev) => ({ ...prev, [assistantIdx]: [...pendingStepsRef.current] }));

      updateContextFromEnvelopes(envelopes);
      logOperationsFromEnvelopes(envelopes, assistantIdx);

      setLastError(null);
      persistConversation(finalMsgs).catch((e) => console.warn('[persist]', e));

    } catch (err: any) {
      console.error(err);
      const msg = err?.message || String(err);

      let errorType = 'unknown';
      let errorText = msg;

      if (msg.includes('Gemini API failed')) {
        errorType = 'gemini';
        errorText = msg.replace('Gemini API failed: ', '');
      } else if (msg.includes('access token') || msg.includes('credentials') || msg.includes('access_denied') || msg.includes('UNAUTHENTICATED') || msg.includes('authorized') || msg.includes('access not authorized') || msg.includes('sign in')) {
        errorType = 'auth';
        errorText = 'Your session has expired. Sign in to continue where you left off.';
      } else if (msg.includes('quota') || msg.includes('rate limit') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')) {
        errorType = 'rate_limit';
        errorText = 'The service is temporarily busy. Try again in a few seconds.';
      } else if (msg.includes('Syntax error') || msg.includes('query failed')) {
        errorType = 'sql';
        errorText = msg.replace('BigQuery query failed: ', '');
      }

      const retryFn = errorType === 'auth'
        ? async () => {
            const ok = await signIn();
            if (ok) {
              setMessages((prev) => prev.slice(0, -2));
              sendMessage(text);
            }
          }
        : () => sendMessage(text);
      setLastError({ message: errorText, type: errorType, retryFn });

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
      setStatusText(null);
    }
  }

  async function handleConfirm(envelope: CompositionEnvelope) {
    setLoading(true);
    try {
      const data = await withAuthRetry(() => ChatOrchestrator.processMessage({
        message: 'confirm',
        history: messages,
        context: { ...deriveContextFromItems(), project: activeProject || context.project, uid: user?.uid, confirmedPayload: envelope.primaryArtifact.data as DataManagementResult },
        onStatus: (s: string | StepInfo) => setStatusText(typeof s === 'string' ? s : s.text),
      }));
      const envelopes: CompositionEnvelope[] = data.envelopes ?? [];
      const assistantMsg: ChatMessage = { role: 'assistant', content: '', envelopes, timestamp: new Date().toISOString() };
      const cleaned = messages.map((msg) =>
        msg.envelopes?.some((e) => e.id === envelope.id)
          ? { ...msg, envelopes: msg.envelopes?.filter((e) => e.id !== envelope.id) }
          : msg
      ).filter((msg) => !msg.envelopes || msg.envelopes.length > 0 || msg.content);
      const finalMsgs = [...cleaned, assistantMsg];
      setMessages(finalMsgs);
      persistConversation(finalMsgs).catch((e) => console.warn('[persist]', e));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function handleCancel(envelope: CompositionEnvelope) {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.envelopes?.some((e) => e.id === envelope.id)
          ? { ...msg, envelopes: msg.envelopes?.filter((e) => e.id !== envelope.id) }
          : msg
      ).filter((msg) => !msg.envelopes || msg.envelopes.length > 0 || msg.content)
    );
  }

  async function handleChipClick(chip: HandoffEnvelope) {
    if (loading) return;

    // Intercept save actions -- route to saved-work service, not orchestrator
    const chipContext = chip.context as Record<string, unknown>;
    if (chipContext.saveAction && user) {
      try {
        const saveType = String(chipContext.saveAction) as 'query' | 'view' | 'check' | 'setup' | 'pipeline';
        const sql = chipContext.sql ? String(chipContext.sql) : undefined;
        const table = chipContext.table ? String(chipContext.table) : undefined;
        const name = sql
          ? sql.replace(/\s+/g, ' ').trim().slice(0, 60)
          : chip.label;
        const { saveItem: doSave } = await import('@/lib/saved-work');
        await doSave(user.uid, {
          userId: user.uid,
          type: saveType,
          name,
          description: chip.label,
          data: {
            sql,
            table,
            project: activeProject || undefined,
            checkType: chipContext.checkType ? String(chipContext.checkType) : undefined,
          },
        });
        const userMsg: ChatMessage = { role: 'user', content: chip.label, timestamp: new Date().toISOString() };
        const assistantMsg: ChatMessage = {
          role: 'assistant',
          content: `Saved to your library. View it in Saved Work.`,
          timestamp: new Date().toISOString(),
        };
        const finalMsgs = [...messages, userMsg, assistantMsg];
        setMessages(finalMsgs);
        persistConversation(finalMsgs).catch((e) => console.warn('[persist]', e));
      } catch (err) {
        console.error('[save]', err);
        setLastError({ message: 'Failed to save item', type: 'unknown' });
      }
      return;
    }

    setLoading(true);
    setLastError(null);


    const userMsg: ChatMessage = {
      role: 'user',
      content: chip.label,
      timestamp: new Date().toISOString(),
    };
    const updatedMsgs = [...messages, userMsg];
    setMessages(updatedMsgs);

    try {
      const mergedContext = {
        ...deriveContextFromItems(),
        project: activeProject || context.project,
        uid: user?.uid,
        forcedSkill: chip.targetSkill as SkillName,
        ...(chipContext.dataset ? { dataset: String(chipContext.dataset) } : {}),
        ...(chipContext.table ? { lastTable: String(chipContext.table) } : {}),
        handoffContext: chipContext,
      };

      let enrichedMessage = chip.label;
      if (chipContext.sql && typeof chipContext.sql === 'string') {
        enrichedMessage = `${chip.label}. Use this SQL: ${chipContext.sql}`;
      } else if (chipContext.table && typeof chipContext.table === 'string') {
        enrichedMessage = `${chip.label} for table ${chipContext.table}`;
      } else if (chipContext.dataset && typeof chipContext.dataset === 'string') {
        enrichedMessage = `${chip.label} in dataset ${chipContext.dataset}`;
      }

      const data = await withAuthRetry(() => ChatOrchestrator.processMessage({
        message: enrichedMessage,
        history: messages,
        context: mergedContext,
        onStatus: (s: string | StepInfo) => setStatusText(typeof s === 'string' ? s : s.text),
      }));

      const envelopes: CompositionEnvelope[] = data.envelopes ?? [];
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: '',
        envelopes,
        timestamp: new Date().toISOString(),
      };

      const finalMsgs = [...updatedMsgs, assistantMsg];
      setMessages(finalMsgs);

      updateContextFromEnvelopes(envelopes);
      logOperationsFromEnvelopes(envelopes, finalMsgs.length - 1);

      setLastError(null);
      persistConversation(finalMsgs).catch((e) => console.warn('[persist]', e));
    } catch (err: any) {
      console.error(err);
      const msg = err?.message || String(err);
      setLastError({ message: msg, type: 'unknown', retryFn: () => handleChipClick(chip) });
      setMessages((prev) => [...prev, { role: 'assistant', content: '', timestamp: new Date().toISOString() }]);
    } finally {
      setLoading(false);
      setStatusText(null);
    }
  }

  function handleInlineClick(message: string) {
    sendMessage(message);
  }

  function handleRunSql(sql: string) {
    const chip: HandoffEnvelope = {
      label: 'Run edited SQL',
      targetSkill: 'query' as SkillName,
      sourceSkill: 'user',
      context: { sql },
    };
    handleChipClick(chip);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // ---- Edit / rerun ------------------------------------------------------

  function startEdit(idx: number, text: string) {
    if (!loading) {
      setEditingIdx(idx);
      setEditText(text);
    }
  }

  function cancelEdit() {
    setEditingIdx(null);
  }

  async function submitEdit(userIdx: number) {
    const text = editText.trim();
    if (!text || loading) return;
    setEditingIdx(null);
    setLoading(true);
    setRerunningIdx(userIdx + 1);
    pendingStepsRef.current = [];

    const historyBefore = messages.slice(0, userIdx);
    const editedUserMsg: ChatMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    try {
      const data = await withAuthRetry(() => ChatOrchestrator.processMessage({
        message: text,
        history: historyBefore,
        context: { ...deriveContextFromItems(), project: activeProject || context.project, uid: user?.uid },
        onStatus: (s: string | StepInfo) => { setStatusText(typeof s === 'string' ? s : s.text); pendingStepsRef.current.push(s); },
      }));
      const envelopes: CompositionEnvelope[] = data.envelopes ?? [];
      const newAssistantMsg: ChatMessage = {
        role: 'assistant',
        content: '',
        envelopes,
        timestamp: new Date().toISOString(),
      };

      const tail = messages.slice(userIdx + 1);
      const nextAssistantOffset = tail.findIndex((m) => m.role === 'assistant');
      const updatedMsgs = [
        ...historyBefore,
        editedUserMsg,
        newAssistantMsg,
        ...(nextAssistantOffset >= 0 ? tail.slice(nextAssistantOffset + 1) : []),
      ];
      setMessages(updatedMsgs);
      const newAssistantIdx = updatedMsgs.findIndex((m) => m === newAssistantMsg);
      if (newAssistantIdx >= 0) {
        setThinkingSteps((prev) => ({ ...prev, [newAssistantIdx]: [...pendingStepsRef.current] }));
      }
      persistConversation(updatedMsgs).catch((e) => console.warn('[persist]', e));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setStatusText(null);
      setRerunningIdx(null);
    }
  }

  async function rerunMessage(assistantIdx: number) {
    if (loading) return;
    setRerunningIdx(assistantIdx);
    pendingStepsRef.current = [];
    let userText = '';
    for (let i = assistantIdx - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userText = messages[i].content;
        break;
      }
    }
    if (!userText) return;

    const historyUpTo = messages.slice(0, assistantIdx);
    setLoading(true);

    try {
      const data = await withAuthRetry(() => ChatOrchestrator.processMessage({
        message: userText,
        history: historyUpTo.slice(0, -1),
        context: { ...deriveContextFromItems(), project: activeProject || context.project, uid: user?.uid },
        onStatus: (s: string | StepInfo) => { setStatusText(typeof s === 'string' ? s : s.text); pendingStepsRef.current.push(s); },
      }));
      const envelopes: CompositionEnvelope[] = data.envelopes ?? [];
      const newAssistantMsg: ChatMessage = {
        role: 'assistant',
        content: '',
        envelopes,
        timestamp: new Date().toISOString(),
      };

      const updatedMsgs = [
        ...messages.slice(0, assistantIdx),
        newAssistantMsg,
        ...messages.slice(assistantIdx + 1),
      ];
      setMessages(updatedMsgs);
      setThinkingSteps((prev) => ({ ...prev, [assistantIdx]: [...pendingStepsRef.current] }));
      persistConversation(updatedMsgs).catch((e) => console.warn('[persist]', e));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setStatusText(null);
      setRerunningIdx(null);
    }
  }

  // ---- Saved work functions -----------------------------------------------

  const saveEnvelopeAsArtifact = useCallback((envelope: CompositionEnvelope) => {
    // Auto-detect type
    const type: SavedArtifactType = 'query';
    const defaultName = envelope.headline?.text?.slice(0, 80) || 'Untitled';
    const defaultDescription = envelope.insight || '';
    setSaveModalState({
      open: true,
      envelope,
      type,
      defaultName,
      defaultDescription,
    });
  }, []);

  const handleSaveConfirm = useCallback(async (name: string, description: string, tags: string[]) => {
    if (!user || !saveModalState?.envelope) return;
    const env = saveModalState.envelope;
    const step: ArtifactStep = {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36),
      order: 0,
      skill: env.skill,
      prompt: name,
      cachedSql: env.provenance?.sql,
      visualizationType: env.primaryArtifact?.type,
      parameters: env.extractedParameters,
    };
    try {
      await saveArtifact(user.uid, {
        userId: user.uid,
        type: saveModalState.type,
        name,
        description,
        steps: [step],
        parameters: env.extractedParameters || [],
        project: activeProject || undefined,
        tags,
        pinned: false,
      });
      // Confirm in chat
      const now = new Date().toISOString();
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `Saved "${name}" to your library.`, timestamp: now, envelopes: [] },
      ]);
    } catch (err) {
      console.error('Failed to save artifact:', err);
    }
    setSaveModalState(null);
  }, [user, saveModalState, activeProject]);

  const saveChatAsWorkflow = useCallback(async (name: string, description: string, tags: string[]) => {
    if (!user) return;
    // Collect all envelopes from assistant messages
    const steps: ArtifactStep[] = [];
    const allParams: ParameterDef[] = [];
    let stepOrder = 0;
    for (const msg of messages) {
      if (msg.role === 'assistant' && msg.envelopes) {
        for (const env of msg.envelopes) {
          // Skip confirmation cards, completion cards, cost confirms
          if (env.primaryArtifact?.type === 'CONFIRMATION_CARD' ||
              env.primaryArtifact?.type === 'COMPLETION_CARD' ||
              env.primaryArtifact?.type === 'COST_CONFIRM_CARD') continue;
          steps.push({
            id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + stepOrder,
            order: stepOrder++,
            skill: env.skill,
            prompt: env.headline?.text || '',
            cachedSql: env.provenance?.sql,
            visualizationType: env.primaryArtifact?.type,
            parameters: env.extractedParameters,
          });
          if (env.extractedParameters) {
            allParams.push(...env.extractedParameters);
          }
        }
      }
    }
    if (steps.length === 0) return;
    // Dedupe params by name
    const uniqueParams: ParameterDef[] = [];
    const seen = new Set<string>();
    for (const p of allParams) {
      if (!seen.has(p.name)) {
        seen.add(p.name);
        uniqueParams.push(p);
      }
    }
    try {
      await saveArtifact(user.uid, {
        userId: user.uid,
        type: 'workflow',
        name,
        description,
        steps,
        parameters: uniqueParams,
        project: activeProject || undefined,
        tags,
        pinned: false,
      });
      const now = new Date().toISOString();
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `Saved workflow "${name}" with ${steps.length} steps to your library.`, timestamp: now, envelopes: [] },
      ]);
    } catch (err) {
      console.error('Failed to save workflow:', err);
    }
  }, [user, messages, activeProject]);

  const runSavedArtifact = useCallback(async (artifact: SavedArtifact) => {
    if (!user) return;
    // Send the artifact name as a user message and let the saved skill handle it
    const prompt = `run my ${artifact.name}`;
    await sendMessage(prompt);
  }, [user, sendMessage]);

  return {
    messages,
    setMessages,
    loading,
    input,
    setInput,
    context,
    setContext,
    contextItems,
    setContextItems,
    pinnedEnvelopeId,
    setPinnedEnvelopeId,
    statusText,
    lastError,
    setLastError,
    thinkingSteps,
    editingIdx,
    editText,
    setEditText,
    rerunningIdx,

    sendMessage,
    handleConfirm,
    handleCancel,
    handleChipClick,
    handleRunSql,
    handleInlineClick,
    removeContextItem,
    pinEnvelopeContext,
    extractContextItems,
    startEdit,
    cancelEdit,
    submitEdit,
    rerunMessage,
    handleKeyDown,

    titleSetRef,
    pendingStepsRef,

    persistConversation,

    saveModalState,
    saveEnvelopeAsArtifact,
    handleSaveConfirm,
    handleSaveModalClose: () => setSaveModalState(null),
    saveChatAsWorkflow,
    runSavedArtifact,
  };
}
