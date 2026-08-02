import { useEffect, useRef, useState } from "react";
import { Send, X, Sparkles } from "lucide-react";
import { postAssistantQuery } from "../api/client";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
}

const QUICK_PROMPTS = [
  "Which products are at risk?",
  "Why is Masala Chips low?",
  "What should I reorder?",
  "Forecast summary",
];

export default function AssistantChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Hi! I'm your inventory assistant. Ask me anything about stock levels, forecasts, or reorder recommendations.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      text: text.trim(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await postAssistantQuery(text.trim());
      const assistantMsg: Message = {
        id: `a-${Date.now()}`,
        role: "assistant",
        text: res.answer,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          text: "Sorry, I couldn't process that request. Please make sure the backend is running and try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating chat bubble */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="chat-fab"
          aria-label="Open AI Assistant"
        >
          <Sparkles className="w-5 h-5 text-white" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="chat-panel">
          {/* Header */}
          <div className="chat-header">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center gradient-purple">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--neu-text)]">
                  Stock Assistant
                </p>
                <p className="text-[10px] text-[var(--neu-text-muted)]">
                  AI-powered insights
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="neu-icon-btn !w-8 !h-8"
              aria-label="Close chat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="chat-messages">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`chat-bubble ${msg.role === "user" ? "chat-bubble-user" : "chat-bubble-assistant"}`}
              >
                {msg.text}
              </div>
            ))}
            {loading && (
              <div className="chat-bubble chat-bubble-assistant">
                <span className="typing-dots">
                  <span />
                  <span />
                  <span />
                </span>
              </div>
            )}
          </div>

          {/* Quick prompts */}
          <div className="chat-quick-prompts">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => sendMessage(prompt)}
                disabled={loading}
                className="chat-chip"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="chat-input-bar">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendMessage(input);
              }}
              placeholder="Ask about inventory..."
              className="chat-input"
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
              className="chat-send-btn"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
