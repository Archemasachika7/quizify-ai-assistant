import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X, Send, Bot, Sparkles, Trash2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

type BotType = "helper" | "cluebot";

interface LocalMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

// ─── Bot definitions ──────────────────────────────────────────────────────────

const BOTS = [
  {
    id: "helper" as BotType,
    name: "Helper",
    model: "Gemma",
    tagline: "Friendly study buddy",
    gradient: "from-emerald-500 to-teal-500",
    ring: "ring-emerald-500/30",
    icon: <Bot className="w-3.5 h-3.5" />,
    placeholder: "Ask Helper anything about your study material…",
    greeting: "Hey! I'm Helper, powered by Gemma. Ask me about any concept, quiz question, or topic you'd like explained.",
  },
  {
    id: "cluebot" as BotType,
    name: "ClueBot",
    model: "Gemini Flash 2.5",
    tagline: "Analytical hint giver",
    gradient: "from-violet-500 to-purple-500",
    ring: "ring-violet-500/30",
    icon: <Sparkles className="w-3.5 h-3.5" />,
    placeholder: "Ask ClueBot for strategic hints…",
    greeting: "Hello! I'm ClueBot, powered by Gemini Flash 2.5. I specialise in spotting patterns and giving you the right clue at the right time — without just handing you answers.",
  },
] as const;

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex gap-1 items-center py-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.9s" }}
        />
      ))}
    </div>
  );
}

// ─── Single message bubble ────────────────────────────────────────────────────

function MessageBubble({
  msg,
  botGradient,
  botIcon,
}: {
  msg: LocalMessage;
  botGradient: string;
  botIcon: React.ReactNode;
}) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex gap-2", isUser ? "flex-row-reverse" : "flex-row")}>
      {!isUser && (
        <span
          className={cn(
            "w-7 h-7 rounded-xl flex items-center justify-center bg-gradient-to-br text-white shrink-0 mt-0.5",
            botGradient,
          )}
        >
          {botIcon}
        </span>
      )}
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
          isUser
            ? "gradient-primary text-primary-foreground rounded-tr-sm"
            : "bg-surface text-foreground rounded-tl-sm",
        )}
      >
        <p className="whitespace-pre-wrap">{msg.content}</p>
        <p
          className={cn(
            "text-[10px] mt-1 leading-none select-none",
            isUser ? "text-primary-foreground/55 text-right" : "text-muted-foreground",
          )}
        >
          {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
}

// ─── Main widget ──────────────────────────────────────────────────────────────

export function ChatWidget() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [activeBot, setActiveBot] = useState<BotType>("helper");
  const [messages, setMessages] = useState<Record<BotType, LocalMessage[]>>({
    helper: [],
    cluebot: [],
  });
  const [sessionIds, setSessionIds] = useState<Record<BotType, string | null>>({
    helper: null,
    cluebot: null,
  });
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [unread, setUnread] = useState(0);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeConfig = BOTS.find((b) => b.id === activeBot)!;
  const currentMessages = messages[activeBot];

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, isOpen]);

  // Reset unread badge when opening
  useEffect(() => {
    if (isOpen) setUnread(0);
  }, [isOpen]);

  // Focus textarea when switching bots
  useEffect(() => {
    if (isOpen) textareaRef.current?.focus();
  }, [activeBot, isOpen]);

  // Only render for authenticated users
  if (!user) return null;

  // ── Inject greeting lazily on first open ─────────────────────────────
  function ensureGreeting(bot: BotType) {
    setMessages((prev) => {
      if (prev[bot].length > 0) return prev;
      const config = BOTS.find((b) => b.id === bot)!;
      const greeting: LocalMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: config.greeting,
        timestamp: new Date(),
      };
      return { ...prev, [bot]: [greeting] };
    });
  }

  function handleOpen() {
    setIsOpen(true);
    ensureGreeting(activeBot);
  }

  function handleBotSwitch(bot: BotType) {
    setActiveBot(bot);
    ensureGreeting(bot);
  }

  // ── Lazily create a Supabase chat session ────────────────────────────
  async function getOrCreateSession(bot: BotType): Promise<string> {
    if (sessionIds[bot]) return sessionIds[bot]!;
    const { data, error } = await (supabase
      .from("chat_sessions") as any)
      .insert({
        user_id: user!.id,
        bot_type: bot,
        title: bot === "helper" ? "Helper chat" : "ClueBot chat",
      })
      .select("id")
      .single();
    if (error || !data) throw new Error("Could not create chat session.");
    setSessionIds((prev) => ({ ...prev, [bot]: data.id }));
    return data.id;
  }

  // ── Persist a message pair to DB (fire-and-forget) ──────────────────
  async function persistMessages(
    sid: string,
    userContent: string,
    assistantContent: string,
  ) {
    await (supabase.from("chat_messages") as any).insert([
      { session_id: sid, role: "user", content: userContent },
      { session_id: sid, role: "assistant", content: assistantContent },
    ]);
  }

  // ── Send message ─────────────────────────────────────────────────────
  async function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMsg: LocalMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => ({ ...prev, [activeBot]: [...prev[activeBot], userMsg] }));
    setInput("");
    setIsLoading(true);

    try {
      const sid = await getOrCreateSession(activeBot);

      // Build history (exclude the greeting if it's the first real message)
      const history = [...currentMessages, userMsg]
        .filter((m) => !(m.role === "assistant" && m.id === messages[activeBot][0]?.id))
        .slice(-12)
        .map((m) => ({ role: m.role, content: m.content }));

      const { data, error } = await supabase.functions.invoke("chat-bot", {
        body: { bot: activeBot, messages: history },
      });

      if (error || !data?.content) throw new Error(error?.message || "Empty AI response.");

      const assistantMsg: LocalMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.content as string,
        timestamp: new Date(),
      };

      setMessages((prev) => ({ ...prev, [activeBot]: [...prev[activeBot], assistantMsg] }));

      // Bump unread badge if chat is closed
      if (!isOpen) setUnread((n) => n + 1);

      // Persist async — don't block the UI
      persistMessages(sid, trimmed, data.content as string).catch(console.error);
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "Oops — something went wrong. Please try again in a moment.";

      const errMsg: LocalMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: message,
        timestamp: new Date(),
      };
      setMessages((prev) => ({ ...prev, [activeBot]: [...prev[activeBot], errMsg] }));
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function clearChat() {
    setMessages((prev) => ({ ...prev, [activeBot]: [] }));
    setSessionIds((prev) => ({ ...prev, [activeBot]: null }));
    // Re-inject greeting
    setTimeout(() => ensureGreeting(activeBot), 50);
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Floating action button ──────────────────────────────────────────── */}
      <motion.button
        onClick={isOpen ? () => setIsOpen(false) : handleOpen}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full gradient-primary flex items-center justify-center shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        aria-label={isOpen ? "Close chat" : "Open AI chat"}
      >
        <AnimatePresence mode="wait" initial={false}>
          {isOpen ? (
            <motion.span
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X className="w-6 h-6 text-primary-foreground" />
            </motion.span>
          ) : (
            <motion.span
              key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <MessageSquare className="w-6 h-6 text-primary-foreground" />
            </motion.span>
          )}
        </AnimatePresence>

        {/* Unread badge */}
        <AnimatePresence>
          {unread > 0 && !isOpen && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive flex items-center justify-center text-[10px] font-bold text-white"
            >
              {unread > 9 ? "9+" : unread}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* ── Chat panel ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 28, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 28, scale: 0.94 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
            className="fixed bottom-24 right-6 z-50 flex flex-col glass rounded-2xl border border-border shadow-elevated overflow-hidden"
            style={{
              width: "min(380px, calc(100vw - 24px))",
              maxHeight: "min(580px, calc(100vh - 128px))",
            }}
          >
            {/* ── Bot selector tabs ─────────────────────────────────────────── */}
            <div className="flex-none px-3 pt-3 pb-0 border-b border-border">
              <div className="flex gap-1.5 mb-3">
                {BOTS.map((bot) => {
                  const active = activeBot === bot.id;
                  return (
                    <button
                      key={bot.id}
                      onClick={() => handleBotSwitch(bot.id)}
                      className={cn(
                        "flex-1 flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        active
                          ? "bg-surface-elevated text-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-surface",
                      )}
                    >
                      <span
                        className={cn(
                          "w-6 h-6 rounded-lg flex items-center justify-center bg-gradient-to-br text-white shrink-0 transition-opacity",
                          bot.gradient,
                          !active && "opacity-60",
                        )}
                      >
                        {bot.icon}
                      </span>
                      <div className="text-left min-w-0">
                        <div className="truncate leading-none">{bot.name}</div>
                        <div className="text-[10px] text-muted-foreground leading-none mt-0.5 truncate">
                          {bot.model}
                        </div>
                      </div>
                      {active && (
                        <motion.span
                          layoutId="active-dot"
                          className={cn(
                            "ml-auto w-1.5 h-1.5 rounded-full bg-gradient-to-br shrink-0",
                            bot.gradient,
                          )}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Active bot description row */}
              <div className="flex items-center justify-between pb-2">
                <p className="text-[11px] text-muted-foreground">{activeConfig.tagline}</p>
                <button
                  onClick={clearChat}
                  className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded-md hover:bg-surface"
                  title="Clear conversation"
                  aria-label="Clear conversation"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* ── Message list ──────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0 scroll-smooth">
              {currentMessages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  botGradient={activeConfig.gradient}
                  botIcon={activeConfig.icon}
                />
              ))}

              {/* AI typing indicator */}
              {isLoading && (
                <div className="flex gap-2">
                  <span
                    className={cn(
                      "w-7 h-7 rounded-xl flex items-center justify-center bg-gradient-to-br text-white shrink-0",
                      activeConfig.gradient,
                    )}
                  >
                    {activeConfig.icon}
                  </span>
                  <div className="bg-surface rounded-2xl rounded-tl-sm px-3.5 py-3">
                    <TypingDots />
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* ── Input area ────────────────────────────────────────────────── */}
            <div className="flex-none p-3 border-t border-border">
              <div className="flex gap-2 items-end">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={activeConfig.placeholder}
                  rows={1}
                  disabled={isLoading}
                  className="resize-none min-h-[40px] max-h-[120px] bg-surface border-border text-sm rounded-xl py-2.5 leading-snug focus-visible:ring-1 focus-visible:ring-ring"
                />
                <Button
                  onClick={sendMessage}
                  disabled={!input.trim() || isLoading}
                  size="icon"
                  className="gradient-primary shrink-0 rounded-xl h-10 w-10 glow"
                  aria-label="Send message"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5 text-center select-none">
                Enter to send · Shift+Enter for new line
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
