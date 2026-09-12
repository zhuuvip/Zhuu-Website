import { useState, useRef, useEffect, useCallback } from "react";
import { useUser, Show, useAuth } from "@clerk/react";
import { Link } from "wouter";
import {
  useListAnthropicConversations,
  useCreateAnthropicConversation,
  useDeleteAnthropicConversation,
  useListAnthropicMessages,
  getListAnthropicConversationsQueryKey,
  getListAnthropicMessagesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Send,
  Plus,
  Trash2,
  MessageSquare,
  Cpu,
  Loader2,
  LogIn,
  Bot,
  User,
  Paperclip,
  Mic,
  MicOff,
  X,
  Image as ImageIcon,
  Gauge,
} from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  attachments?: Array<{
    name: string;
    type: string;
    preview?: string;
  }>;
}

interface Attachment {
  name: string;
  type: string;
  preview?: string;
  content?: string;
}

interface Usage {
  used: number;
  remaining: number;
  limit: number;
}

const BASE = (
  import.meta.env.VITE_API_URL ||
  "https://zhuuapi.vercel.app"
).replace(/\/$/, "");

function formatContent(text: string): React.ReactNode {
  if (!text) return null;

  const codeBlockRe = /```(\w+)?\n?([\s\S]*?)```/g;
  const inlineCodeRe = /`([^`]+)`/g;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  const allMatches: Array<{
    index: number;
    end: number;
    node: React.ReactNode;
  }> = [];

  let match;

  while ((match = codeBlockRe.exec(text)) !== null) {
    allMatches.push({
      index: match.index,
      end: match.index + match[0].length,
      node: (
        <pre
          key={match.index}
          style={{
            margin: "10px 0",
            background: "rgba(0,0,0,0.5)",
            border: "1px solid rgba(0,255,255,0.15)",
            borderRadius: 8,
            padding: "12px 14px",
            overflowX: "auto",
          }}
        >
          {match[1] && (
            <div
              style={{
                color: "rgba(0,200,220,0.4)",
                fontSize: 11,
                marginBottom: 6,
                textTransform: "uppercase",
              }}
            >
              {match[1]}
            </div>
          )}

          <code
            style={{
              background: "none",
              padding: 0,
              color: "#b0e8f0",
              fontSize: 13,
              fontFamily: "Courier New, monospace",
            }}
          >
            {match[2].trim()}
          </code>
        </pre>
      ),
    });
  }

  for (const m of allMatches) {
    if (m.index > lastIndex) {
      const seg = text.slice(lastIndex, m.index);

      parts.push(
        <span
          key={lastIndex}
          dangerouslySetInnerHTML={{
            __html: seg
              .replace(
                inlineCodeRe,
                '<code style="background:rgba(0,255,255,0.1);padding:2px 5px;border-radius:4px;color:#00e5ff;font-size:0.9em">$1</code>',
              )
              .replace(/\n/g, "<br/>"),
          }}
        />,
      );
    }

    parts.push(m.node);
    lastIndex = m.end;
  }

  if (lastIndex < text.length) {
    const seg = text.slice(lastIndex);

    parts.push(
      <span
        key={lastIndex}
        dangerouslySetInnerHTML={{
          __html: seg
            .replace(
              inlineCodeRe,
              '<code style="background:rgba(0,255,255,0.1);padding:2px 5px;border-radius:4px;color:#00e5ff;font-size:0.9em">$1</code>',
            )
            .replace(/\n/g, "<br/>"),
        }}
      />,
    );
  }

  return parts;
}

function useVoiceRecorder(
  onTranscript: (text: string) => void,
) {
  const [recording, setRecording] = useState(false);
  const [supported, setSupported] = useState(false);

  const recognitionRef =
    useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const SpeechRecognitionCtor =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    setSupported(!!SpeechRecognitionCtor);
  }, []);

  const startRecording = useCallback(() => {
    const SpeechRecognitionCtor =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (
      e: SpeechRecognitionEvent,
    ) => {
      const transcript =
        e.results[0]?.[0]?.transcript;

      if (transcript) {
        onTranscript(transcript);
      }
    };

    recognition.onend = () => setRecording(false);
    recognition.onerror = () => setRecording(false);

    recognitionRef.current = recognition;

    recognition.start();
    setRecording(true);
  }, [onTranscript]);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    setRecording(false);
  }, []);

  return {
    recording,
    supported,
    startRecording,
    stopRecording,
  };
}

function UsageBadge({ usage }: { usage: Usage }) {
  const percentage =
    usage.limit > 0
      ? usage.remaining / usage.limit
      : 0;

  const isEmpty = usage.remaining <= 0;
  const isLow = percentage <= 0.2;

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs ${
        isEmpty
          ? "border-red-400/30 bg-red-400/10 text-red-300"
          : isLow
            ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
            : "border-cyan-400/20 bg-cyan-400/5 text-cyan-300"
      }`}
      title="Batas penggunaan AI + Tools hari ini"
    >
      <Gauge size={13} />

      <span>
        {usage.remaining} / {usage.limit} hari ini
      </span>
    </div>
  );
}

function AIChat() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  const { data: conversations = [] } =
    useListAnthropicConversations();

  const createConv =
    useCreateAnthropicConversation();

  const deleteConv =
    useDeleteAnthropicConversation();

  const [activeConvId, setActiveConvId] =
    useState<number | null>(null);

  const [messages, setMessages] =
    useState<Message[]>([]);

  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);

  const [attachments, setAttachments] =
    useState<Attachment[]>([]);

  const [usage, setUsage] = useState<Usage>({
    used: 0,
    remaining: 30,
    limit: 30,
  });

  const messagesEndRef =
    useRef<HTMLDivElement>(null);

  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const textareaRef =
    useRef<HTMLTextAreaElement>(null);

  const {
    data: savedMessages = [],
  } = useListAnthropicMessages(
    activeConvId ?? 0,
    {
      query: {
        enabled: !!activeConvId,
        queryKey:
          getListAnthropicMessagesQueryKey(
            activeConvId ?? 0,
          ),
      },
    },
  );

  const loadUsage = useCallback(async () => {
    try {
      const token = await getToken();

      if (!token) return;

      const res = await fetch(
        `${BASE}/api/anthropic/daily-limit`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!res.ok) return;

      const data = await res.json();

      setUsage({
        used: Number(data.used ?? 0),
        remaining: Number(
          data.remaining ?? 30,
        ),
        limit: Number(data.limit ?? 30),
      });
    } catch (err) {
      console.error(
        "Failed to load daily usage:",
        err,
      );
    }
  }, [getToken]);

  useEffect(() => {
    loadUsage();
  }, [loadUsage]);

  useEffect(() => {
    if (
      activeConvId &&
      savedMessages.length > 0
    ) {
      setMessages(
        savedMessages.map((m) => ({
          role: m.role as
            | "user"
            | "assistant",
          content: m.content,
        })),
      );
    }
  }, [savedMessages, activeConvId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  const {
    recording,
    supported: voiceSupported,
    startRecording,
    stopRecording,
  } = useVoiceRecorder((transcript) => {
    setInput((prev) =>
      prev
        ? prev + " " + transcript
        : transcript,
    );

    textareaRef.current?.focus();
  });

  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(
      e.target.files || [],
    );

    files.forEach((file) => {
      const reader = new FileReader();

      reader.onload = (ev) => {
        const result =
          ev.target?.result as string;

        setAttachments((prev) => [
          ...prev,
          {
            name: file.name,
            type: file.type,
            preview:
              file.type.startsWith("image/")
                ? result
                : undefined,
            content: result,
          },
        ]);
      };

      reader.readAsDataURL(file);
    });

    e.target.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) =>
      prev.filter((_, i) => i !== index),
    );
  };

  const buildMessageContent = () => {
    let content = input.trim();

    if (attachments.length > 0) {
      const textFiles =
        attachments.filter(
          (a) =>
            !a.type.startsWith("image/"),
        );

      if (textFiles.length > 0) {
        const textDescs = textFiles
          .map(
            (a) => `[File: ${a.name}]`,
          )
          .join(", ");

        content = content
          ? `${content}\n${textDescs}`
          : textDescs;
      }

      if (
        !content &&
        attachments.some((a) =>
          a.type.startsWith("image/"),
        )
      ) {
        content =
          "Analyze this image for me.";
      }
    }

    return content;
  };

  const getImagePayload = () =>
    attachments
      .filter(
        (a) =>
          a.type.startsWith("image/") &&
          a.content,
      )
      .map((a) => ({
        name: a.name,
        type: a.type,
        data: a.content!,
      }));

  const streamResponse = async (
    url: string,
    body: object,
    headers: Record<string, string> = {},
  ): Promise<string> => {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      let detail = `Request failed (${res.status})`;

      try {
        const errorData =
          await res.json();

        detail =
          errorData?.message ||
          errorData?.detail ||
          errorData?.error ||
          detail;

        if (
          res.status === 429
        ) {
          setUsage({
            used: Number(
              errorData.used ?? 30,
            ),
            remaining: 0,
            limit: Number(
              errorData.limit ?? 30,
            ),
          });
        }
      } catch {}

      throw new Error(detail);
    }

    const reader =
      res.body?.getReader();

    if (!reader) {
      throw new Error(
        "AI response stream unavailable.",
      );
    }

    const decoder =
      new TextDecoder();

    let buffer = "";
    let full = "";

    while (true) {
      const { done, value } =
        await reader.read();

      if (done) break;

      buffer += decoder.decode(
        value,
        { stream: true },
      );

      const lines =
        buffer.split("\n");

      buffer =
        lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) {
          continue;
        }

        const d =
          line.slice(6).trim();

        if (d === "[DONE]") {
          continue;
        }

        try {
          const p = JSON.parse(d);

          const c =
            p?.choices?.[0]
              ?.delta?.content ??
            p?.content ??
            "";

          if (c) {
            full += c;

            setMessages((prev) => {
              const u = [...prev];

              u[u.length - 1] = {
                role: "assistant",
                content: full,
                streaming: true,
              };

              return u;
            });
          }

          if (p?.usage) {
            setUsage({
              used: Number(
                p.usage.used ?? 0,
              ),
              remaining: Number(
                p.usage.remaining ?? 0,
              ),
              limit: Number(
                p.usage.limit ?? 30,
              ),
            });
          }
        } catch (err) {
          console.error(
            "SSE parse error:",
            err,
          );
        }
      }
    }

    return full;
  };

  const sendMessage = async () => {
    const content =
      buildMessageContent();

    const imagePayload =
      getImagePayload();

    if (
      !content ||
      streaming ||
      usage.remaining <= 0
    ) {
      return;
    }

    const userMsg: Message = {
      role: "user",
      content,
      attachments:
        attachments.length > 0
          ? attachments.map((a) => ({
              name: a.name,
              type: a.type,
              preview: a.preview,
            }))
          : undefined,
    };

    setMessages((prev) => [
      ...prev,
      userMsg,
      {
        role: "assistant",
        content: "",
        streaming: true,
      },
    ]);

    setInput("");
    setAttachments([]);
    setStreaming(true);

    try {
      let full = "";

      const token =
        await getToken();

      if (!token) {
        throw new Error(
          "Session login tidak ditemukan. Silakan login kembali.",
        );
      }

      if (activeConvId) {
        full =
          await streamResponse(
            `${BASE}/api/anthropic/conversations/${activeConvId}/messages`,
            {
              content,
              ...(imagePayload.length > 0
                ? {
                    images:
                      imagePayload,
                  }
                : {}),
            },
            {
              Authorization:
                `Bearer ${token}`,
            },
          );

        queryClient.invalidateQueries({
          queryKey:
            getListAnthropicMessagesQueryKey(
              activeConvId,
            ),
        });
      } else {
        /*
         * IMPORTANT:
         * /chat/stream now requires authentication,
         * so we MUST send the Clerk token here too.
         */
        const allMsgs = [
          ...messages,
          userMsg,
        ].map((m) => ({
          role: m.role,
          content: m.content,
        }));

        full =
          await streamResponse(
            `${BASE}/api/chat/stream`,
            {
              messages: allMsgs,
              ...(imagePayload.length > 0
                ? {
                    images:
                      imagePayload,
                  }
                : {}),
            },
            {
              Authorization:
                `Bearer ${token}`,
            },
          );
      }

      setMessages((prev) => {
        const u = [...prev];

        u[u.length - 1] = {
          role: "assistant",
          content: full,
        };

        return u;
      });

      await loadUsage();
    } catch (err) {
      console.error(
        "Send error:",
        err,
      );

      setMessages((prev) => {
        const u = [...prev];

        u[u.length - 1] = {
          role: "assistant",
          content:
            err instanceof Error
              ? `Error: ${err.message}`
              : "Error: please try again.",
        };

        return u;
      });

      await loadUsage();
    } finally {
      setStreaming(false);
    }
  };

  const newConversation =
    async () => {
      const conv =
        await createConv.mutateAsync({
          data: {
            title: `Chat ${new Date().toLocaleTimeString()}`,
          },
        });

      setActiveConvId(conv.id);
      setMessages([]);

      queryClient.invalidateQueries({
        queryKey:
          getListAnthropicConversationsQueryKey(),
      });
    };

  const deleteConversation =
    async (id: number) => {
      await deleteConv.mutateAsync({
        id,
      });

      if (activeConvId === id) {
        setActiveConvId(null);
        setMessages([]);
      }

      queryClient.invalidateQueries({
        queryKey:
          getListAnthropicConversationsQueryKey(),
      });
    };

  const handleKeyDown = (
    e: React.KeyboardEvent,
  ) => {
    if (
      e.key === "Enter" &&
      !e.shiftKey
    ) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div
      className="flex h-[calc(100dvh-64px)] min-h-0 overflow-hidden"
      data-testid="ai-page"
    >
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0 border-r border-cyan-400/10 flex-col bg-slate-950/60 backdrop-blur-xl hidden md:flex">
        <div className="p-4 border-b border-cyan-400/10">
          <button
            onClick={newConversation}
            disabled={
              createConv.isPending
            }
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400/15 to-purple-500/15 border border-cyan-400/20 text-cyan-300 text-sm font-medium hover:from-cyan-400/25 hover:to-purple-500/25 transition-all"
          >
            {createConv.isPending ? (
              <Loader2
                size={14}
                className="animate-spin"
              />
            ) : (
              <Plus size={14} />
            )}
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {conversations.length === 0 ? (
            <div className="text-center py-8 text-blue-300/30 text-xs px-4">
              Start a conversation to
              save your history
            </div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl mb-1 cursor-pointer transition-all ${
                  activeConvId === conv.id
                    ? "bg-cyan-400/10 border border-cyan-400/20 text-cyan-300"
                    : "text-blue-200/60 hover:bg-white/5"
                }`}
                onClick={() => {
                  setActiveConvId(
                    conv.id,
                  );
                  setMessages([]);
                }}
              >
                <MessageSquare
                  size={13}
                  className="flex-shrink-0"
                />

                <span className="flex-1 text-xs truncate">
                  {conv.title}
                </span>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConversation(
                      conv.id,
                    );
                  }}
                  className="opacity-0 group-hover:opacity-100 text-red-400/60 hover:text-red-400 transition-all p-0.5"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="p-3 border-t border-cyan-400/10">
          <div className="text-xs text-blue-300/30 text-center">
            {activeConvId
              ? "Saving history ✓"
              : "Chat without saving history"}
          </div>
        </div>
      </div>

      {/* Chat */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        {/* Header */}
        <div className="px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 border-b border-cyan-400/10 flex items-center gap-3 bg-slate-950/40 backdrop-blur-xl flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-cyan-400 to-purple-500 flex items-center justify-center">
            <Cpu
              size={16}
              className="text-white"
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-blue-100">
              Zhuu AI
            </div>

            <div className="text-xs text-blue-300/40">
              Powered by Lanz AI
            </div>
          </div>

          <UsageBadge usage={usage} />
        </div>

        {/* Messages */}
        <div
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 md:px-6 py-4 sm:py-6 space-y-4" style={{ WebkitOverflowScrolling: "touch" }}
          data-testid="messages-container"
        >
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-cyan-400/20 to-purple-500/20 border border-cyan-400/20 flex items-center justify-center mb-4">
                <Cpu
                  size={28}
                  className="text-cyan-400"
                />
              </div>

              <h2
                className="text-xl font-bold text-blue-100 mb-2"
                style={{
                  fontFamily:
                    "'Orbitron', sans-serif",
                }}
              >
                Zhuu AI
              </h2>

              <p className="text-blue-300/50 text-sm max-w-sm mb-4">
                Ask me anything — coding,
                math, writing, or just have
                a conversation.
              </p>

              <div className="flex flex-wrap gap-2 justify-center">
                {[
                  "Write some Python code",
                  "Explain quantum computing",
                  "Help me debug my code",
                  "Give me a deep ocean fun fact 🌊",
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() =>
                      setInput(s)
                    }
                    className="px-3 py-1.5 rounded-full border border-cyan-400/20 text-cyan-300/70 text-xs hover:bg-cyan-400/10 hover:text-cyan-300 transition-all"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(
            (msg, i) => (
              <div
                key={i}
                className={`flex gap-3 msg-fade-in ${
                  msg.role === "user"
                    ? "justify-end"
                    : "justify-start"
                }`}
              >
                {msg.role ===
                  "assistant" && (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-r from-cyan-400 to-purple-500 flex items-center justify-center flex-shrink-0 mt-1">
                    <Bot
                      size={13}
                      className="text-white"
                    />
                  </div>
                )}

                <div className="max-w-[78%] flex flex-col gap-2">
                  {msg.attachments &&
                    msg.attachments.length >
                      0 && (
                      <div className="flex flex-wrap gap-2 justify-end">
                        {msg.attachments.map(
                          (att, ai) => (
                            <div
                              key={ai}
                              className="rounded-lg overflow-hidden border border-cyan-400/20"
                            >
                              {att.preview ? (
                                <img
                                  src={
                                    att.preview
                                  }
                                  alt={
                                    att.name
                                  }
                                  style={{
                                    maxWidth: 180,
                                    maxHeight: 120,
                                    objectFit:
                                      "cover",
                                    display:
                                      "block",
                                  }}
                                />
                              ) : (
                                <div className="flex items-center gap-2 px-3 py-2 bg-white/5 text-xs text-blue-300/70">
                                  <Paperclip
                                    size={12}
                                  />
                                  {att.name}
                                </div>
                              )}
                            </div>
                          ),
                        )}
                      </div>
                    )}

                  <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-gradient-to-r from-cyan-400/15 to-blue-500/15 border border-cyan-400/20 text-blue-100"
                        : "glass-card text-blue-100"
                    }`}
                  >
                    {msg.role ===
                    "assistant" ? (
                      formatContent(
                        msg.content,
                      )
                    ) : (
                      <pre className="whitespace-pre-wrap font-sans">
                        {msg.content}
                      </pre>
                    )}

                    {msg.streaming && (
                      <span className="inline-block w-1.5 h-4 bg-cyan-400 ml-1 animate-pulse rounded-sm" />
                    )}
                  </div>
                </div>

                {msg.role ===
                  "user" && (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0 mt-1">
                    <User
                      size={13}
                      className="text-white"
                    />
                  </div>
                )}
              </div>
            ),
          )}

          <div
            ref={messagesEndRef}
          />
        </div>

        {/* Input */}
        <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] border-t border-cyan-400/10 bg-slate-950/40 backdrop-blur-xl flex-shrink-0">
          {usage.remaining <= 0 && (
            <div className="mb-3 px-4 py-2.5 rounded-xl border border-red-400/20 bg-red-400/10 text-red-300 text-xs text-center">
              🚫 Batas harian habis.
              Coba lagi besok.
            </div>
          )}

          {usage.remaining > 0 &&
            usage.remaining <= 5 && (
              <div className="mb-3 px-4 py-2 rounded-xl border border-amber-400/20 bg-amber-400/10 text-amber-300 text-xs text-center">
                ⚠️ Tinggal{" "}
                <b>
                  {usage.remaining}
                </b>{" "}
                penggunaan hari ini.
              </div>
            )}

          {attachments.length >
            0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {attachments.map(
                (att, i) => (
                  <div
                    key={i}
                    className="relative group rounded-lg overflow-hidden border border-cyan-400/20"
                  >
                    {att.preview ? (
                      <img
                        src={att.preview}
                        alt={att.name}
                        style={{
                          width: 56,
                          height: 56,
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      <div className="flex items-center gap-1.5 px-3 py-2 bg-white/5 text-xs text-blue-300/70">
                        <Paperclip
                          size={11}
                        />
                        <span className="max-w-[80px] truncate">
                          {att.name}
                        </span>
                      </div>
                    )}

                    <button
                      onClick={() =>
                        removeAttachment(
                          i,
                        )
                      }
                      className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-red-500/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <X
                        size={10}
                        className="text-white"
                      />
                    </button>
                  </div>
                ),
              )}
            </div>
          )}

          <div className="flex gap-2 items-end min-w-0">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.txt,.csv,.json,.md,.py,.js,.ts"
              onChange={
                handleFileSelect
              }
              className="hidden"
            />

            <button
              onClick={() =>
                fileInputRef.current?.click()
              }
              title="Attach file or image"
              disabled={
                usage.remaining <= 0
              }
              className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all border border-cyan-400/20 hover:bg-cyan-400/10 text-blue-300/50 hover:text-cyan-300 disabled:opacity-30"
            >
              <ImageIcon
                size={17}
              />
            </button>

            {voiceSupported && (
              <button
                onClick={
                  recording
                    ? stopRecording
                    : startRecording
                }
                disabled={
                  usage.remaining <= 0
                }
                title={
                  recording
                    ? "Stop recording"
                    : "Start voice input"
                }
                className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all border ${
                  recording
                    ? "border-red-400/60 bg-red-400/10 text-red-400 animate-pulse"
                    : "border-cyan-400/20 hover:bg-cyan-400/10 text-blue-300/50 hover:text-cyan-300"
                } disabled:opacity-30`}
              >
                {recording ? (
                  <MicOff size={17} />
                ) : (
                  <Mic size={17} />
                )}
              </button>
            )}

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) =>
                setInput(
                  e.target.value,
                )
              }
              onKeyDown={
                handleKeyDown
              }
              placeholder={
                usage.remaining <= 0
                  ? "Limit harian habis"
                  : recording
                    ? "🎙️ Listening..."
                    : "Ask Zhuu AI anything..."
              }
              disabled={
                usage.remaining <= 0
              }
              rows={1}
              className="flex-1 bg-white/5 border border-cyan-400/20 rounded-xl px-4 py-3 text-sm text-blue-100 placeholder-blue-300/30 focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30 resize-none transition-all disabled:opacity-40"
              style={{
                minHeight: "48px",
                maxHeight: "160px",
                overflowY: "auto",
              }}
            />

            <button
              onClick={sendMessage}
              disabled={
                streaming ||
                usage.remaining <= 0 ||
                (!input.trim() &&
                  attachments.length ===
                    0)
              }
              data-testid="btn-send-message"
              className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-r from-cyan-400 to-purple-500 flex items-center justify-center text-white shadow-lg hover:shadow-cyan-400/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:scale-105"
            >
              {streaming ? (
                <Loader2
                  size={18}
                  className="animate-spin"
                />
              ) : (
                <Send size={18} />
              )}
            </button>
          </div>

          <div className="mt-2 text-[10px] text-blue-300/25 text-center">
            Enter to send · Shift+Enter
            for new line ·{" "}
            {usage.remaining} penggunaan
            tersisa hari ini
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AIPage() {
  return (
    <>
      <Show when="signed-in">
        <AIChat />
      </Show>

      <Show when="signed-out">
        <div className="ocean-bg min-h-[calc(100vh-64px)] flex flex-col items-center justify-center px-4 text-center">
          <div className="glass-card rounded-3xl p-10 max-w-md w-full">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-cyan-400/20 to-purple-500/20 border border-cyan-400/20 flex items-center justify-center mx-auto mb-6">
              <Cpu
                size={28}
                className="text-cyan-400"
              />
            </div>

            <h2
              className="text-2xl font-bold text-blue-100 mb-3"
              style={{
                fontFamily:
                  "'Orbitron', sans-serif",
              }}
            >
              Zhuu AI
            </h2>

            <p className="text-blue-300/60 text-sm mb-6">
              Sign in untuk menggunakan
              Zhuu AI dan mendapatkan
              batas 30 penggunaan per
              hari.
            </p>

            <div className="flex flex-col gap-2">
              <Link href="/sign-in">
                <button className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-purple-500 text-white font-semibold hover:opacity-90 transition-all cursor-pointer">
                  <LogIn
                    size={16}
                  />
                  Sign In
                </button>
              </Link>

              <Link href="/sign-up">
                <button className="w-full px-6 py-3 rounded-xl border border-cyan-400/30 text-cyan-300 font-medium text-sm hover:bg-cyan-400/10 transition-all cursor-pointer">
                  Create an Account
                </button>
              </Link>
            </div>
          </div>
        </div>
      </Show>
    </>
  );
}
