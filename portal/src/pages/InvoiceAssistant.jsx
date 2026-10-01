import { useState, useEffect, useRef } from 'react';
import { api } from '@/api/client';
import { Sparkles, MessageSquare, Plus, Trash2, Wrench, CornerDownLeft } from 'lucide-react';
import MessageBubble from '@/components/agents/MessageBubble';

export default function InvoiceAssistant() {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef(null);

  const loadConversations = async () => {
    setLoadingConvos(true);
    try {
      const res = await api.assistant.listConversations();
      setConversations(res.items || []);
    } catch (e) {
      setError(e.message || 'Unable to load conversations.');
    }
    setLoadingConvos(false);
  };

  const loadMessages = async (id) => {
    try {
      const convo = await api.assistant.getConversation(id);
      setMessages(convo?.messages || []);
    } catch (e) {
      setError(e.message || 'Unable to load messages.');
    }
  };

  useEffect(() => { loadConversations(); }, []);

  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    loadMessages(activeId);
  }, [activeId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const newConversation = async () => {
    try {
      const convo = await api.assistant.createConversation('New invoice draft');
      setConversations((c) => [convo, ...c]);
      setActiveId(convo.id);
      setMessages([]);
      setError('');
    } catch (e) {
      setError(e.message || 'Failed to start conversation');
    }
  };

  const send = async () => {
    if (!input.trim() || sending) return;
    let convoId = activeId;
    if (!convoId) {
      const convo = await api.assistant.createConversation(input.slice(0, 40) || 'New invoice draft');
      setConversations((c) => [convo, ...c]);
      setActiveId(convo.id);
      convoId = convo.id;
    }
    const content = input.trim();
    const userMsg = { role: 'user', content };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setSending(true);
    setError('');
    try {
      const res = await api.assistant.addMessage(convoId, { content });
      setMessages(res.messages || []);
    } catch (e) {
      setError(e.message || 'Failed to send message');
      setMessages((m) => m.filter((x) => x !== userMsg));
    }
    setSending(false);
  };

  const deleteConversation = async (id) => {
    try {
      await api.assistant.deleteConversation(id);
      setConversations((c) => c.filter((x) => x.id !== id));
      if (activeId === id) { setActiveId(null); setMessages([]); }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="p-10">
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <Sparkles size={22} className="text-neutral-900" />
          <h1 className="text-2xl font-semibold text-neutral-900">Invoice Assistant</h1>
        </div>
        <p className="text-sm text-neutral-500 mt-1">Draft new invoices from your tracked, unbilled time entries — powered by your own multi-provider LLM API.</p>
      </div>

      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-sm text-amber-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-12 gap-0 h-[calc(100vh-220px)]">
        {/* Conversation list */}
        <div className="col-span-3 bg-white border border-neutral-200 border-r-0 rounded-l-xl flex flex-col overflow-hidden">
          <div className="p-3 border-b border-neutral-200">
            <button
              onClick={newConversation}
              className="flex items-center justify-center gap-2 w-full px-3 py-2 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 transition"
            >
              <Plus size={16} /> New chat
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loadingConvos ? (
              <div className="text-center text-xs text-neutral-400 py-6">Loading...</div>
            ) : conversations.length === 0 ? (
              <div className="text-center text-xs text-neutral-400 py-6 px-3">
                No conversations yet. Start a new chat to draft an invoice.
              </div>
            ) : (
              conversations.map((c) => (
                <div
                  key={c.id}
                  className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition ${
                    activeId === c.id ? 'bg-neutral-100' : 'hover:bg-neutral-50'
                  }`}
                  onClick={() => setActiveId(c.id)}
                >
                  <MessageSquare size={14} className="text-neutral-400 shrink-0" />
                  <span className="flex-1 text-sm text-neutral-700 truncate">{c.title || 'Untitled'}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteConversation(c.id); }}
                    className="opacity-0 group-hover:opacity-100 text-neutral-300 hover:text-red-500 transition"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat panel */}
        <div className="col-span-9 bg-white border border-neutral-200 border-l-0 rounded-r-xl flex flex-col overflow-hidden">
          {!activeId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
              <Sparkles size={32} className="text-neutral-300 mb-3" />
              <p className="text-sm text-neutral-400 mb-1">Start a conversation to draft invoices</p>
              <p className="text-xs text-neutral-400 max-w-md">
                Ask things like "Draft an invoice for all unbilled hours for Acme Corp" or
                "Create invoices for all clients with unbilled time this month."
              </p>
            </div>
          ) : (
            <>
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.length === 0 && (
                  <div className="text-center text-sm text-neutral-400 py-10">
                    Send a message to get started — e.g. "Draft an invoice for all unbilled time entries."
                  </div>
                )}
                {messages.map((m, i) => (
                  <MessageRow key={i} message={m} />
                ))}
                {sending && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-neutral-200 rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-neutral-400">
                      <span className="inline-flex gap-1">
                        <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-neutral-200">
                <div className="relative">
                  <textarea
                    rows={3}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                    placeholder="Describe the invoice you want to draft... (Enter to send, Shift+Enter for new line)"
                    className="w-full px-4 py-3 pr-12 border border-neutral-200 rounded-lg text-sm leading-relaxed focus:outline-none focus:border-neutral-900 transition resize-none"
                  />
                  <button
                    onClick={send}
                    disabled={!input.trim() || sending}
                    className="absolute bottom-3 right-3 flex items-center justify-center w-8 h-8 rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-40 disabled:bg-neutral-300 transition"
                    title="Send (Enter)"
                  >
                    <CornerDownLeft size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function formatToolContent(content) {
  if (content == null) return '';
  if (typeof content === 'string') {
    try { return JSON.stringify(JSON.parse(content), null, 2); } catch { return content; }
  }
  return JSON.stringify(content, null, 2);
}

function MessageRow({ message }) {
  if (message.role === 'tool') {
    return (
      <div className="flex justify-start">
        <div className="flex items-start gap-2 max-w-[80%] bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs text-neutral-500">
          <Wrench size={12} className="mt-0.5 text-neutral-400 shrink-0" />
          <div>
            <div className="font-medium text-neutral-600 mb-0.5">{message.tool_name}</div>
            <pre className="whitespace-pre-wrap break-words font-mono text-[11px] text-neutral-500">
              {formatToolContent(message.content)}
            </pre>
          </div>
        </div>
      </div>
    );
  }
  // Tool activity is shown via the dedicated `tool` cards above; strip the
  // assistant's tool_calls so MessageBubble only renders its text content.
  if (message.role === 'assistant' && message.tool_calls) {
    return <MessageBubble message={{ role: 'assistant', content: message.content }} />;
  }
  return <MessageBubble message={message} />;
}