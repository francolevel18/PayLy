import { useChat } from '@ai-sdk/react';
import { useEffect, useRef, useState } from 'react';
import { saveRemoteExpense } from '../../lib/expensesRepository';

const premiumStyles = `
/* Entrance */
@keyframes spring-in {
  0% { opacity: 0; transform: translateY(20px) scale(0.95); }
  50% { transform: translateY(-4px) scale(1.01); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes slide-up-fade {
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slide-in-right {
  from { opacity: 0; transform: translateX(24px); }
  to { opacity: 1; transform: translateX(0); }
}

/* Sheet entrance */
@keyframes sheet-enter {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

/* Sheet exit */
@keyframes sheet-exit {
  from { transform: translateY(0); opacity: 1; }
  to { transform: translateY(100%); opacity: 0; }
}

@keyframes pulse-soft {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(0.98); }
}

@keyframes shimmer-slow {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

@keyframes typing-bounce-smooth {
  0%, 80%, 100% { transform: translateY(0); }
  40% { transform: translateY(-8px); }
}

@keyframes gradient-shift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@keyframes checkmark-draw {
  0% { stroke-dasharray: 1, 150; stroke-dashoffset: 0; }
  50% { stroke-dasharray: 90, 150; stroke-dashoffset: -35; }
  100% { stroke-dasharray: 90, 150; stroke-dashoffset: -124; }
}

@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-6px); }
}

/* Classes */
.spring-in { animation: spring-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
.slide-up-fade { animation: slide-up-fade 0.3s cubic-bezier(0.16, 1, 0.3, 1) both; }
.slide-in-right { animation: slide-in-right 0.25s cubic-bezier(0.16, 1, 0.3, 1) both; }
.sheet-enter { animation: sheet-enter 0.35s cubic-bezier(0.16, 1, 0.3, 1) both; }
.sheet-exit { animation: sheet-exit 0.2s cubic-bezier(0.4, 0, 0.2, 1) both; }
.pulse-soft { animation: pulse-soft 2s ease-in-out infinite; }
.shimmer-slow {
  background: linear-gradient(90deg, transparent 0%, rgba(99, 102, 241, 0.08) 50%, transparent 100%);
  background-size: 200% 100%;
  animation: shimmer-slow 2s ease-in-out infinite;
}
.typing-bounce-smooth { animation: typing-bounce-smooth 1.4s ease-in-out infinite; }
.gradient-shift {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #667eea 100%);
  background-size: 200% 200%;
  animation: gradient-shift 3s ease infinite;
}
.checkmark-draw { animation: checkmark-draw 0.6s ease-out forwards; }
.float { animation: float 3s ease-in-out infinite; }

/* Glass morphism */
.glass {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

/* Smooth transitions */
.smooth-all { transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
.smooth-transform { transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1); }

/* Scrollbar */
.custom-scrollbar::-webkit-scrollbar { width: 6px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.3); border-radius: 10px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(148, 163, 184, 0.5); }

/* Quick action */
.quick-action {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.quick-action:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}
.quick-action:active {
  transform: translateY(0);
}

.input-focus-ring:focus {
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.message-bubble {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.message-bubble:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

@keyframes stagger-in {
  from { opacity: 0; transform: translateY(8px) scale(0.95); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.stagger-in { animation: stagger-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) both; }

@media (prefers-reduced-motion: reduce) {
  .sheet-enter, .sheet-exit, .spring-in, .slide-up-fade, .slide-in-right,
  .stagger-in, .shimmer-slow, .typing-bounce-smooth, .gradient-shift,
  .float, .checkmark-draw { animation: none !important; }
  .quick-action:hover { transform: none !important; }
  .message-bubble:hover { transform: none !important; }
}
`;

export default function AIChatSheet({ isOpen, onClose, auth, setters }) {
  const { messages, sendMessage, status, addToolOutput } = useChat({
    api: '/api/chat',
    async onToolCall({ toolCall }) {
      if (toolCall.toolName === 'saveExpense') {
        const { amount, description, category, paymentMethod, installments, date } = toolCall.input;

        const expense = {
          id: crypto.randomUUID(),
          amount,
          description,
          category,
          paymentMethod,
          rawText: description,
          createdAt: date || new Date().toISOString(),
          creditCardId: null,
          installments: installments || 1,
          installmentNumber: installments && installments > 1 ? 1 : null,
          syncState: auth.user ? "pending" : "local",
          lastSyncError: "",
          syncedAt: "",
          metadata: {}
        };

        setters.setExpenses((current) => [expense, ...current]);

        if (auth.user) {
          setters.setSyncStatus("syncing");
        }

        try {
          const savedExpense = await saveRemoteExpense(expense);
          if (savedExpense) {
            const syncedAt = new Date().toISOString();
            setters.setExpenses((current) =>
              current.map((item) =>
                item.id === expense.id ? { ...item, syncState: "synced", lastSyncError: "", syncedAt } : item
              )
            );
            setters.setSyncStatus("synced");
          }
        } catch (err) {
          console.warn("Fallo guardado remoto desde chat", err);
          setters.setSyncStatus("idle");
        }

        addToolOutput({
          tool: 'saveExpense',
          toolCallId: toolCall.toolCallId,
          state: 'output-available',
          output: `Gasto de ${amount} por ${description} guardado exitosamente.`
        });
      }
    },
    sendAutomaticallyWhen: ({ messages }) => {
      const lastAssistant = [...messages].reverse().find(m =>
        m.role === 'assistant' &&
        m.parts?.some(p => p.type.startsWith('tool-'))
      );
      if (!lastAssistant) return false;

      const hasCompletedTools = lastAssistant.parts?.some(
        p => p.type.startsWith('tool-') && p.state === 'output-available'
      );
      const hasText = lastAssistant.parts?.some(
        p => p.type === 'text' && p.state === 'done'
      );

      return hasCompletedTools && !hasText;
    },
  });

  const [input, setInput] = useState('');
  const [isClosing, setIsClosing] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const prevLenRef = useRef(0);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 180);
  };

  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current;
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      if (atBottom || messages.length > prevLenRef.current) {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      }
    }
    prevLenRef.current = messages.length;
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  if (!isOpen && !isClosing) return null;

  const isWaiting = status === 'submitted';
  const isStreaming = status === 'streaming';
  const isLoading = isWaiting || isStreaming;

  const handleSubmit = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
    sendMessage({ text });
    setInput('');
  };

  const handleQuickAction = (text) => {
    sendMessage({ text });
    setInput('');
  };

  const hasContent = input.trim().length > 0;

  const paymentLabels = {
    cash: 'Efectivo',
    debit: 'Debito',
    credit: 'Credito',
    transfer: 'Transferencia'
  };

  const quickActions = [
    { icon: '🛒', label: 'Super', text: 'Gasto en el super' },
    { icon: '⛽', label: 'Nafta', text: 'Gasto en nafta' },
    { icon: '☕', label: 'Cafe', text: 'Gasto en cafe' },
    { icon: '🍽️', label: 'Almuerzo', text: 'Gasto en almuerzo' }
  ];

  return (
    <div className={`fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-slate-50 to-white ${isClosing ? 'sheet-exit' : 'sheet-enter'}`}>
      <style>{premiumStyles}</style>

      {/* Header with glass effect */}
      <div className="glass border-b border-slate-200/50 px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="flex h-10 w-10 items-center justify-center rounded-full gradient-shift text-white text-sm font-bold shadow-lg">
                P
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-400 border-2 border-white"></div>
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 leading-tight">Payly</h2>
              <p className="text-xs text-slate-500">
                {isStreaming ? (
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-500 pulse-soft"></span>
                    escribiendo...
                  </span>
                ) : isWaiting ? (
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500 pulse-soft"></span>
                    pensando...
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500"></span>
                    en linea
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full bg-slate-100 p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600 smooth-all"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center mt-8 spring-in">
            <div className="text-6xl mb-4 float"></div>
            <p className="font-semibold text-slate-700 text-lg">Contame en que gastaste</p>
            <p className="text-sm text-slate-500 mt-1">y lo guardo al toque</p>
            
            <div className="mt-8 space-y-2">
              <p className="text-xs bg-white border border-slate-200 inline-block px-4 py-2 rounded-full text-slate-600 shadow-sm">
                💳 "4500 en el super con debito"
              </p>
              <br />
              <p className="text-xs bg-white border border-slate-200 inline-block px-4 py-2 rounded-full text-slate-600 shadow-sm">
                🛒 "20000 de nafta y 8000 en la farmacia"
              </p>
              <br />
              <p className="text-xs bg-white border border-slate-200 inline-block px-4 py-2 rounded-full text-slate-600 shadow-sm">
                🔥 "30 lucas en cuotas con credito"
              </p>
            </div>

            {/* Quick actions */}
            <div className="mt-8">
              <p className="text-xs text-slate-400 mb-3">ACCIONES RAPIDAS</p>
              <div className="flex flex-wrap justify-center gap-2">
                {quickActions.map((action, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleQuickAction(action.text)}
                    disabled={isLoading}
                    className="quick-action flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-full text-sm text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    style={{ animationDelay: `${idx * 0.05}s` }}
                  >
                    <span className="text-lg">{action.icon}</span>
                    <span>{action.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((m, idx) => {
          const isUser = m.role === 'user';
          const isLast = idx === messages.length - 1;
          const textParts = m.parts?.filter(p => p.type === 'text') || [];
          const toolParts = m.parts?.filter(p => p.type.startsWith('tool-') && p.type.replace('tool-', '') === 'saveExpense') || [];
          const isStreamingMsg = isLast && !isUser && isStreaming;

          return (
            <div
              key={m.id}
              className={`flex ${isUser ? 'justify-end' : 'justify-start'} ${isUser ? 'slide-in-right' : 'slide-up-fade'}`}
              style={{ animationDelay: `${idx * 0.05}s` }}
            >
              <div className={`message-bubble max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                isUser
                  ? 'bg-slate-900 text-white rounded-br-md shadow-lg'
                  : `bg-white text-slate-800 rounded-bl-md border border-slate-200 shadow-sm ${isStreamingMsg ? 'shimmer-slow' : ''}`
              }`}>
                {textParts.map((p, i) => (
                  <div key={i} className="whitespace-pre-wrap break-words">
                    {p.text}
                  </div>
                ))}

                {toolParts.length > 0 && (
                  <div className={`mt-3 space-y-2 ${textParts.length > 0 ? 'pt-3 border-t border-slate-200/60' : ''}`}>
                    {toolParts.map((t, tIdx) => {
                      const isComplete = t.state === 'output-available';
                      const isPending = t.state === 'input-available' || t.state === 'input-streaming';
                      const isError = t.state === 'output-error';

                      const PaymentIcon = ({ method }) => {
                        if (method === 'cash') return <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path d="M10 1a4 4 0 00-4 4v1h8V5a4 4 0 00-4-4zM4 8v2a6 6 0 1012 0V8H4zm6 10a4 4 0 01-4-4h8a4 4 0 01-4 4z"/></svg>;
                        if (method === 'debit') return <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zm-2 5v5a2 2 0 002 2h12a2 2 0 002-2V9H2zm3 3h2v2H5v-2zm6 0h2v2h-2v-2z"/></svg>;
                        if (method === 'credit') return <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm0 4h12v6H4V8z"/></svg>;
                        return <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path d="M8 5a1 1 0 100 2h5.586l-1.293 1.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L13.586 5H8zM12 15a1 1 0 100-2H6.414l1.293-1.293a1 1 0 10-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L6.414 15H12z"/></svg>;
                      };

                      return (
                        <div
                          key={t.toolCallId}
                          className={`flex items-center gap-3 text-sm px-4 py-3 rounded-xl stagger-in ${
                            isComplete
                              ? 'bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 border border-emerald-200 shadow-sm'
                              : isError
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-600 border border-indigo-200 shadow-sm'
                          }`}
                          style={{ animationDelay: `${tIdx * 0.05}s` }}
                        >
                          {isComplete ? (
                            <>
                              <svg className="h-5 w-5 shrink-0 text-emerald-500 checkmark-draw" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                              </svg>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{t.input?.description}</div>
                                <div className="flex items-center gap-2 text-xs text-emerald-600 mt-0.5">
                                  <span>${t.input?.amount?.toLocaleString?.() || t.input?.amount}</span>
                                  {t.input?.installments > 1 && (
                                    <>
                                      <span>·</span>
                                      <span>{t.input.installments}x</span>
                                    </>
                                  )}
                                  <span>·</span>
                                  <span><PaymentIcon method={t.input?.paymentMethod} /> {paymentLabels[t.input?.paymentMethod] || 'Efectivo'}</span>
                                </div>
                              </div>
                            </>
                          ) : isPending ? (
                            <>
                              <div className="flex h-5 w-5 items-center justify-center">
                                <div className="h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{t.input?.description || 'Procesando...'}</div>
                                {t.input?.amount && (
                                  <div className="text-xs text-indigo-600 mt-0.5">
                                    ${t.input.amount?.toLocaleString?.() || t.input.amount}
                                  </div>
                                )}
                              </div>
                            </>
                          ) : isError ? (
                            <>
                              <span className="text-base">❌</span>
                              <span className="flex-1">Error: {t.errorText}</span>
                            </>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isWaiting && (
          <div className="flex justify-start slide-up-fade">
            <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-5 py-3 shadow-sm flex items-center gap-1.5">
              <span className="typing-bounce-smooth inline-block h-2 w-2 rounded-full bg-indigo-400" style={{ animationDelay: '0ms' }}></span>
              <span className="typing-bounce-smooth inline-block h-2 w-2 rounded-full bg-indigo-400" style={{ animationDelay: '150ms' }}></span>
              <span className="typing-bounce-smooth inline-block h-2 w-2 rounded-full bg-indigo-400" style={{ animationDelay: '300ms' }}></span>
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="glass border-t border-slate-200/50 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sticky bottom-0">
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none input-focus-ring smooth-all"
              value={input}
              placeholder={isLoading ? 'Esperando respuesta...' : 'Contame que gastaste...'}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !hasContent}
            className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full smooth-all overflow-hidden ${
              hasContent && !isLoading
                ? 'bg-slate-900 text-white hover:bg-slate-800 active:scale-95 shadow-lg'
                : 'bg-slate-100 text-slate-300 cursor-not-allowed'
            }`}
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.949 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.114A28.897 28.897 0 003.105 2.289z" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
