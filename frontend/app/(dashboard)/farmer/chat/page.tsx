/* eslint-disable react-hooks/purity */
"use client";

import { useState, useRef, useEffect } from "react";
import {
  Send,
  Loader2,
  Bot,
  User,
  Sprout,
  TrendingUp,
  Truck,
  Shield,
  Trash2,
} from "lucide-react";
import { getToken, getStoredUser } from "@/lib/auth";
import { streamChat, api, ChatUserContext } from "@/lib/api";
import ChatMap from "./components/ChatMap";
import StatusStepsViewer from "./components/StatusStepsViewer";
import MarkdownRenderer from "@/components/shared/MarkdownRenderer";
import styles from "./page.module.css";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  statusSteps?: string[];
  isComplete?: boolean;
}

const SUGGESTIONS = [
  { icon: <TrendingUp size={14} />, text: "Berapa harga cabai merah hari ini?" },
  { icon: <Truck size={14} />, text: "Rekomendasi rute ke Pasar Kramat Jati" },
  { icon: <Shield size={14} />, text: "Apakah ada anomali di batch saya?" },
];

export default function ChatPage() {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Read stored messages synchronously on mount to avoid React state hydration race conditions
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window === "undefined") return [];
    const stored = getStoredUser();
    if (stored) {
      const cached = localStorage.getItem(`yawgriva_chat_messages_${stored.id}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          const mapped = parsed.map((m: {
            id: string;
            role: "user" | "assistant";
            content: string;
            timestamp: string;
            statusSteps?: string[];
            isComplete?: boolean;
          }) => ({
            ...m,
            timestamp: new Date(m.timestamp)
          }));
          
          // Clean up incomplete assistant messages at the end of the history
          if (mapped.length > 0) {
            const lastMsg = mapped[mapped.length - 1];
            if (lastMsg.role === "assistant" && (!lastMsg.content || lastMsg.isComplete === false)) {
              mapped.pop();
            }
          }
          return mapped;
        } catch (e) {
          console.error("Failed to parse cached chat history", e);
        }
      }
    }
    return [];
  });

  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [userContext, setUserContext] = useState<ChatUserContext | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    const stored = getStoredUser();
    if (!stored) return undefined;
    return {
      name: stored.name,
      role: stored.role,
      region: stored.region,
    };
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasResumedRef = useRef(false);

  function startAssistantStream(messageText: string, currentContext?: ChatUserContext) {
    setIsStreaming(true);

    const assistantId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", timestamp: new Date(), statusSteps: [], isComplete: false },
    ]);

    const token = getToken();
    if (!token) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    streamChat(
      token,
      messageText,
      (chunk) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: m.content + chunk } : m
          )
        );
      },
      () => {
        setIsStreaming(false);
        abortControllerRef.current = null;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, isComplete: true } : m
          )
        );
      },
      (err: Error) => {
        if (err.name === "AbortError") return;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: m.content || "Maaf, terjadi kesalahan. Coba lagi.", isComplete: true }
              : m
          )
        );
        setIsStreaming(false);
        abortControllerRef.current = null;
      },
      currentContext || userContext,
      controller.signal,
      (statusText) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, statusSteps: [...(m.statusSteps || []), statusText] }
              : m
          )
        );
      }
    );
  }

  function handleSend(text?: string) {
    const messageText = text || input.trim();
    if (!messageText || isStreaming) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: messageText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    startAssistantStream(messageText);
  }

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Load user profile on mount to build context for AI
  useEffect(() => {
    const token = getToken();
    if (!token) return;

    // Fetch full profile to get farmer-specific fields
    api.auth.getProfile(token)
      .then((profile) => {
        const ctx: ChatUserContext = {
          name: profile.name,
          role: profile.role,
          region: profile.region,
          phone: profile.phone,
        };
        // Add farmer-specific details if available
        if (profile.farmer_profile) {
          if (profile.farmer_profile.farm_address) ctx.farm_location = profile.farmer_profile.farm_address;
          if (profile.farmer_profile.land_area_ha) ctx.land_area = `${profile.farmer_profile.land_area_ha} hektar`;
        }
        setUserContext(ctx);
      })
      .catch(() => {
        // Keep base context on error
      });
  }, []);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    const stored = getStoredUser();
    if (stored) {
      localStorage.setItem(`yawgriva_chat_messages_${stored.id}`, JSON.stringify(messages));
    }
  }, [messages]);

  // Resume streaming if the last message is from user (interrupted chat)
  useEffect(() => {
    if (userContext && !hasResumedRef.current && !isStreaming) {
      if (messages.length > 0) {
        const lastMsg = messages[messages.length - 1];
        if (lastMsg.role === "user") {
          hasResumedRef.current = true;
          setTimeout(() => {
            startAssistantStream(lastMsg.content, userContext);
          }, 0);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userContext, messages, isStreaming]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleClearChat() {
    setShowConfirmModal(true);
  }

  return (
    <div className={styles.chatPage}>
      {/* Chat Header */}
      <div className={styles.chatHeader}>
        <div className={styles.chatHeaderInfo}>
          <div className={styles.chatAvatar}>
            <Bot size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: "var(--text-lg)", fontWeight: 600 }}>
              Yawgriva AI Assistant
            </h1>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
              Tanya tentang harga, rute, atau kondisi batch Anda
            </p>
          </div>
        </div>
        <div className={styles.chatHeaderActions}>
          {messages.length > 0 && (
            <button
              onClick={handleClearChat}
              style={{
                background: "none",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                padding: "6px 12px",
                fontSize: "var(--text-xs)",
                color: "var(--color-danger)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                transition: "all var(--transition-fast)",
                fontWeight: 600
              }}
              className={styles.clearChatBtn}
            >
              <Trash2 size={12} />
              <span>Hapus Chat</span>
            </button>
          )}
          <div className={styles.chatStatus}>
            <span className={styles.statusDotOnline} />
            <span style={{ fontSize: "var(--text-xs)" }}>Online</span>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className={styles.chatMessages}>
        {messages.length === 0 && (
          <div className={`${styles.chatEmpty} ${styles.animateFadeIn}`}>
            <div className={styles.chatEmptyIcon}>
              <Sprout size={32} />
            </div>
            <h2 style={{ fontSize: "var(--text-xl)", marginBottom: "var(--space-2)" }}>
              Ada yang bisa dibantu?
            </h2>
            <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)", marginBottom: "var(--space-6)" }}>
              Saya bisa membantu Anda dengan informasi harga, rekomendasi rute, dan monitoring batch
            </p>
            <div className={styles.suggestionGrid}>
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  className={styles.suggestionBtn}
                  onClick={() => handleSend(s.text)}
                >
                  {s.icon}
                  <span>{s.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`${styles.message} ${msg.role === "user" ? styles.messageUser : styles.messageAssistant} ${styles.animateFadeIn}`}
          >
            <div className={styles.messageAvatar}>
              {msg.role === "user" ? <User size={16} /> : <Bot size={16} />}
            </div>
            <div className={styles.messageBubble}>
              {msg.role === "user" ? (
                <p>{msg.content}</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                  {msg.statusSteps && msg.statusSteps.length > 0 && (
                    <StatusStepsViewer 
                      steps={msg.statusSteps} 
                      isStreamingMessage={msg.role === "assistant" && isStreaming && messages[messages.length - 1]?.id === msg.id} 
                    />
                  )}
                  {msg.content ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                      <MarkdownRenderer
                        content={msg.content}
                        renderMap={(mapData) => <ChatMap mapData={mapData} />}
                      />
                    </div>
                  ) : (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "6px 10px" }}>
                      <span className={styles.typingDot}></span>
                      <span className={styles.typingDot}></span>
                      <span className={styles.typingDot}></span>
                    </div>
                  )}
                </div>
              )}
              {msg.role === "assistant" && isStreaming && msg.content && (
                <span className={styles.typingCursor} style={{ marginLeft: "4px" }}>▊</span>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className={styles.chatInputArea}>
        <div className={styles.chatInputWrapper}>
          <input
            type="text"
            className={styles.chatInput}
            placeholder="Ketik pesan..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            disabled={isStreaming}
          />
          <button
            className={styles.chatSendBtn}
            onClick={() => handleSend()}
            disabled={!input.trim() || isStreaming}
          >
            {isStreaming ? <Loader2 size={18} className="spin animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </div>

      {showConfirmModal && (
        <div className={styles.modalOverlay} onClick={() => setShowConfirmModal(false)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 style={{ margin: 0, fontSize: "var(--text-base)", fontWeight: 700 }}>Konfirmasi Hapus Chat</h3>
              <button 
                onClick={() => setShowConfirmModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "16px", color: "var(--color-text-muted)" }}
              >
                ✕
              </button>
            </div>
            <div className={styles.modalBody}>
              <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)", margin: 0 }}>
                Apakah Anda yakin ingin menghapus semua riwayat percakapan? Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
            <div className={styles.modalFooter}>
              <button className="btn btn-secondary" onClick={() => setShowConfirmModal(false)}>Batal</button>
              <button
                className="btn btn-primary"
                style={{ background: "var(--color-danger)", borderColor: "var(--color-danger)", color: "white" }}
                onClick={() => {
                  setMessages([]);
                  const stored = getStoredUser();
                  if (stored) {
                    localStorage.removeItem(`yawgriva_chat_messages_${stored.id}`);
                  }
                  setShowConfirmModal(false);
                }}
              >
                Hapus Semua
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
