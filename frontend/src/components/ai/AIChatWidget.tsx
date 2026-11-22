import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { aiService, type ChatMessage, type DailyBriefing } from '../../services/aiService';

interface MessageItem extends ChatMessage {
  id: string;
  timestamp: string;
  suggestions?: string[];
}

export default function AIChatWidget() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [briefingOpen, setBriefingOpen] = useState(true);
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [loadingBriefing, setLoadingBriefing] = useState(false);
  const [briefingError, setBriefingError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const [input, setInput] = useState('');
  const [loadingReply, setLoadingReply] = useState(false);
  const [messages, setMessages] = useState<MessageItem[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        '👋 **Hello! I am your ClinicCash AI Advisor.**\n\nI monitor your cash flow, overdue patient invoices, upcoming bills, and gap risks on a daily basis.\n\nClick a suggestion below or ask me any question about your clinic finances!',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      suggestions: [
        'Daily Briefing 🌤️',
        'Top Overdue Invoices 💰',
        'How to Close Cash Gap 💡',
        'Upcoming Bills 📅',
      ],
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      if (!briefing && !loadingBriefing) {
        fetchBriefing(false);
      }
    }
  }, [isOpen]);

  const fetchBriefing = async (isManual = false) => {
    setLoadingBriefing(true);
    setBriefingError(null);
    if (isManual) {
      setBriefingOpen(true);
    }
    try {
      const data = await aiService.getDailyBriefing();
      setBriefing(data);
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastUpdated(nowStr);

      if (isManual) {
        const topAction =
          data.urgent_actions && data.urgent_actions.length > 0
            ? `\n\n🎯 **Today's Priority Action:** ${data.urgent_actions[0].title} — ${data.urgent_actions[0].impact}`
            : '';
        const updateMsg: MessageItem = {
          id: `update-${Date.now()}`,
          role: 'assistant',
          content:
            `🔄 **Daily Briefing Refreshed** (${nowStr})\n\n` +
            `• **Opening Cash:** ₹${data.cash_balance.toLocaleString('en-IN')}\n` +
            `• **Overdue Inflows:** ₹${data.overdue_total.toLocaleString('en-IN')} (${data.overdue_count} invoices)\n` +
            `• **Upcoming 7-Day Bills:** ₹${data.bills_due_soon_total.toLocaleString('en-IN')}\n` +
            `• **Health Score:** ${data.health_score}/100 (${data.health_label})` +
            topAction,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          suggestions: ['How to Close Cash Gap 💡', 'Top Overdue Invoices 💰', 'Upcoming Bills 📅'],
        };
        setMessages((prev) => [...prev, updateMsg]);
      }
    } catch (err: any) {
      console.error('Failed to load daily briefing:', err);
      const errMsg = err?.message || 'Could not connect to daily briefing service.';
      setBriefingError(errMsg);
      if (isManual) {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            content: `⚠️ **Failed to refresh daily briefing:** ${errMsg}\n\nPlease verify backend status and try again.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            suggestions: ['Retry Daily Briefing 🌤️', 'Top Overdue Invoices 💰'],
          },
        ]);
      }
    } finally {
      setLoadingBriefing(false);
    }
  };

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || loadingReply) return;

    const userMsg: MessageItem = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setLoadingReply(true);

    try {
      const historyPayload: ChatMessage[] = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await aiService.sendMessage(text, historyPayload);
      const assistantMsg: MessageItem = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: res.reply,
        suggestions: res.suggestions,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: MessageItem = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content:
          '⚠️ Sorry, I could not connect to the AI engine right now. Please check backend connection and try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestions: ['Retry Daily Briefing 🌤️', 'Top Overdue Invoices 💰'],
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoadingReply(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    // If it's a navigation suggestion
    if (suggestion.includes('Gap Closer')) {
      navigate('/dashboard/gap-closer');
      return;
    }
    if (suggestion.includes('Reminders')) {
      navigate('/dashboard/reminders');
      return;
    }
    if (suggestion.includes('Funding Chain')) {
      navigate('/dashboard/funding-chain');
      return;
    }
    handleSend(suggestion);
  };

  // Render markdown-like simple text formatting
  const renderFormattedText = (content: string) => {
    const lines = content.split('\n');
    return (
      <div className="space-y-1.5 text-sm leading-relaxed">
        {lines.map((line, idx) => {
          if (!line.trim()) return <div key={idx} className="h-1.5" />;

          // Heading ###
          if (line.startsWith('### ')) {
            return (
              <h4 key={idx} className="font-bold text-base text-text mt-2 mb-1 flex items-center gap-1.5">
                {line.replace('### ', '')}
              </h4>
            );
          }
          if (line.startsWith('#### ')) {
            return (
              <h5 key={idx} className="font-semibold text-sm text-text mt-1.5 mb-0.5">
                {line.replace('#### ', '')}
              </h5>
            );
          }

          // Bullet item
          if (line.startsWith('- ') || line.startsWith('• ')) {
            const raw = line.replace(/^[-•]\s*/, '');
            return (
              <div key={idx} className="flex items-start gap-2 pl-1">
                <span className="text-teal-500 font-bold mt-0.5">•</span>
                <span>{renderInlineStyles(raw)}</span>
              </div>
            );
          }

          // Numbered list
          if (/^\d+\.\s/.test(line)) {
            return (
              <div key={idx} className="flex items-start gap-2 pl-1 font-medium">
                <span>{renderInlineStyles(line)}</span>
              </div>
            );
          }

          return <p key={idx}>{renderInlineStyles(line)}</p>;
        })}
      </div>
    );
  };

  const renderInlineStyles = (text: string) => {
    // Simple bolding parser for **bold**
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-semibold text-text">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return (
          <em key={i} className="italic text-text/80">
            {part.slice(1, -1)}
          </em>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={i} className="rounded bg-black/10 dark:bg-white/10 px-1 py-0.5 text-xs font-mono">
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  return (
    <>
      {/* Floating Trigger Button with AI Sparkle Symbol */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-full bg-gradient-to-r from-teal-500 to-emerald-600 px-4 py-3.5 text-white shadow-xl shadow-teal-500/25 transition-all duration-200 hover:scale-105 hover:shadow-teal-500/40 active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-400"
        aria-label={isOpen ? 'Close AI Advisor' : 'Open AI Advisor'}
        title="ClinicCash AI Daily Advisor"
      >
        <div className="relative">
          <Sparkles className="h-5 w-5 animate-pulse text-amber-200" />
          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </span>
        </div>
        <span className="font-semibold text-sm tracking-wide hidden sm:inline">AI Daily Advisor</span>
      </button>

      {/* AI Assistant Drawer / Popover Window */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="ClinicCash AI Advisor"
          className="fixed bottom-20 right-4 sm:right-6 z-50 flex h-[620px] max-h-[86vh] w-[92vw] sm:w-[440px] flex-col rounded-3xl border border-border bg-card shadow-2xl overflow-hidden animate-fade-in"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-teal-600 via-teal-700 to-emerald-700 p-4 text-white">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
                <Bot className="h-6 w-6 text-amber-200" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-white">ClinicCash AI</h3>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/25 px-2 py-0.5 text-[11px] font-semibold text-emerald-100">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                    Daily Active
                  </span>
                </div>
                <p className="text-xs text-white/80">Daily Financial Updates & Advisory</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => fetchBriefing(true)}
                disabled={loadingBriefing}
                className="rounded-xl p-2 text-white/80 hover:bg-white/15 hover:text-white transition-colors"
                title="Refresh Daily Briefing"
              >
                <RefreshCw className={`h-4 w-4 ${loadingBriefing ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-xl p-2 text-white/80 hover:bg-white/15 hover:text-white transition-colors"
                title="Close AI Assistant"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Collapsible Daily Briefing Widget */}
          <div className="border-b border-border bg-card/60 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => setBriefingOpen((prev) => !prev)}
              className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-semibold text-text/80 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                <span>Today's Daily Briefing & Health</span>
                {briefing && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      briefing.health_score >= 85
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                        : briefing.health_score >= 70
                        ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                        : 'bg-red-50 text-red-700 dark:bg-red-500/20 dark:text-red-300'
                    }`}
                  >
                    Score: {briefing.health_score}/100
                  </span>
                )}
                {lastUpdated && (
                  <span className="hidden sm:inline text-[10px] text-text/50 font-normal">
                    Synced {lastUpdated}
                  </span>
                )}
              </div>
              {briefingOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {briefingOpen && (
              <div className="p-3 text-xs bg-bg/50 border-t border-border/50 max-h-48 overflow-y-auto space-y-2">
                {loadingBriefing ? (
                  <div className="flex items-center justify-center py-4 text-text/60 gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin text-teal-600" />
                    <span>Analyzing clinic metrics for today...</span>
                  </div>
                ) : briefingError ? (
                  <div className="rounded-xl border border-red-300 bg-red-50 p-2.5 text-xs text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300 flex items-center justify-between gap-2">
                    <span>{briefingError}</span>
                    <button
                      type="button"
                      onClick={() => fetchBriefing(true)}
                      className="rounded-lg bg-red-100 hover:bg-red-200 dark:bg-red-900/50 px-2.5 py-1 text-[11px] font-semibold text-red-800 dark:text-red-200 transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                ) : briefing ? (
                  <>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl border border-border bg-card p-2">
                        <div className="text-[10px] text-text/60 font-medium">Opening Cash</div>
                        <div className="font-bold text-teal-600 dark:text-teal-400 text-xs mt-0.5">
                          ₹{briefing.cash_balance.toLocaleString('en-IN')}
                        </div>
                      </div>
                      <div className="rounded-xl border border-border bg-card p-2">
                        <div className="text-[10px] text-text/60 font-medium">Overdue Inflows</div>
                        <div className="font-bold text-amber-600 dark:text-amber-400 text-xs mt-0.5">
                          ₹{briefing.overdue_total.toLocaleString('en-IN')}
                        </div>
                      </div>
                      <div className="rounded-xl border border-border bg-card p-2">
                        <div className="text-[10px] text-text/60 font-medium">7-Day Bills</div>
                        <div className="font-bold text-text text-xs mt-0.5">
                          ₹{briefing.bills_due_soon_total.toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>

                    {/* Urgent Action Highlight */}
                    {briefing.urgent_actions.length > 0 && (
                      <div className="rounded-xl bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800/50 p-2.5">
                        <div className="font-bold text-teal-900 dark:text-teal-200 flex items-center gap-1.5 text-[11px]">
                          <span>{briefing.urgent_actions[0].symbol}</span>
                          <span>Priority Action: {briefing.urgent_actions[0].title}</span>
                        </div>
                        <div className="text-[11px] text-teal-800/80 dark:text-teal-300/80 mt-1">
                          {briefing.urgent_actions[0].impact}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-text/70 pt-0.5">
                      <span className="italic truncate max-w-[75%]">{briefing.daily_tip}</span>
                      <button
                        type="button"
                        onClick={() => fetchBriefing(true)}
                        disabled={loadingBriefing}
                        className="inline-flex items-center gap-1 font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 hover:underline shrink-0"
                      >
                        <RefreshCw className={`h-3 w-3 ${loadingBriefing ? 'animate-spin' : ''}`} />
                        Refresh
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-3">
                    <button
                      type="button"
                      onClick={() => fetchBriefing(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 transition-colors shadow-sm"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Load Today's Briefing
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Chat Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-bg/30">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-4 py-3 shadow-sm ${
                    m.role === 'user'
                      ? 'bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-br-none'
                      : 'bg-card border border-border text-text rounded-bl-none'
                  }`}
                >
                  {m.role === 'assistant' ? (
                    renderFormattedText(m.content)
                  ) : (
                    <p className="text-sm">{m.content}</p>
                  )}
                  <span
                    className={`block mt-1 text-[10px] ${
                      m.role === 'user' ? 'text-teal-100/70 text-right' : 'text-text/50'
                    }`}
                  >
                    {m.timestamp}
                  </span>
                </div>

                {/* Interactive Suggestion Chips */}
                {m.suggestions && m.suggestions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5 max-w-[95%]">
                    {m.suggestions.map((s, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSuggestionClick(s)}
                        className="rounded-full border border-teal-500/30 bg-teal-50/50 hover:bg-teal-100/80 dark:bg-teal-950/40 dark:hover:bg-teal-900/60 px-3 py-1 text-xs font-medium text-teal-800 dark:text-teal-300 transition-colors shadow-sm"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {loadingReply && (
              <div className="flex items-center gap-2 rounded-2xl bg-card border border-border px-4 py-3 text-xs text-text/70 w-fit">
                <Bot className="h-4 w-4 animate-bounce text-teal-600" />
                <span>AI analyzing clinic finances...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input & Send Bar */}
          <div className="border-t border-border bg-card p-3">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask AI anything (e.g., 'What is today's status?')..."
                className="flex-1 rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm text-text placeholder:text-text/40 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                disabled={loadingReply}
              />
              <button
                onClick={() => handleSend()}
                disabled={loadingReply || !input.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white transition-colors"
                title="Send Message"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[10px] text-text/50 px-1">
              <span>Powered by ClinicCash Financial AI</span>
              <span>Updated daily based on live records</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
