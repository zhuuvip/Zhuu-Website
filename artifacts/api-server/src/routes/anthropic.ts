import { Router } from "express";
import { db, conversations, messages } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  CreateAnthropicConversationBody,
  SendAnthropicMessageBody,
  GetAnthropicConversationParams,
  DeleteAnthropicConversationParams,
  ListAnthropicMessagesParams,
  SendAnthropicMessageParams,
} from "@workspace/api-zod";

const router = Router();

const SYSTEM_PROMPT = `
You are ZhuuAI, the intelligent AI assistant of ZhuuVIP.

- Be natural, friendly, calm, and confident.
- Adapt automatically to the user's language, tone, and knowledge level.
- Be concise for simple questions and detailed when necessary.
- Understand and maintain conversation context.
- Be useful for programming, technology, science, mathematics, education, writing, creativity, planning, troubleshooting, and everyday conversation.
- Think carefully before answering.
- Never invent facts when uncertain.
- For coding tasks, provide practical working solutions.
- Follow the user's intent and adapt your communication style.
- Respond naturally like a capable AI assistant.
- Your name is ZhuuAI.
`;

async function callGeminiWithRetry(
  history: { role: string; content: string }[],
  retries = 2
): Promise<string> {
  const messages = history
    .filter((m) => m.content && m.content.trim())
    .map((m) => {
      const role = m.role === "assistant" ? "ZhuuAI" : "User";
      return `${role}: ${m.content.trim()}`;
    })
    .join("\n\n");

  if (!messages) {
    return "Silakan kirim pesan untuk memulai percakapan dengan ZhuuAI.";
  }

  const prompt = `${SYSTEM_PROMPT}

Conversation:
${messages}

ZhuuAI:`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);

      const response = await fetch(
        `https://www.lanzapi.my.id/ai/chatgpt?prompt=${encodeURIComponent(prompt)}`,
        {
          method: "GET",
          signal: controller.signal,
        }
      );

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`AI API error ${response.status}`);
      }

      const data = await response.json().catch(() => null);

      const text =
        typeof data === "string"
          ? data
          : data?.response ??
            data?.result ??
            data?.message ??
            data?.answer ??
            data?.data;

      if (typeof text === "string" && text.trim()) {
        return text.trim();
      }

      return "ZhuuAI menerima request, tetapi tidak mendapatkan jawaban yang valid. Coba lagi.";
    } catch (err: any) {
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }

      if (err?.name === "AbortError") {
        return "⏱️ ZhuuAI sedang terlalu lama merespons. Coba lagi.";
      }

      return "❌ ZhuuAI sedang mengalami gangguan koneksi. Coba lagi sebentar.";
    }
  }

  return "❌ ZhuuAI gagal merespons. Coba lagi.";
}

router.get("/anthropic/conversations", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const all = await db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(conversations.createdAt);
    res.json(all);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

router.post("/anthropic/conversations", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const parsed = CreateAnthropicConversationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  try {
    const [conv] = await db
      .insert(conversations)
      .values({ ...parsed.data, userId })
      .returning();
    res.status(201).json(conv);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

router.get("/anthropic/conversations/:id", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const params = GetAnthropicConversationParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const [conv] = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, params.data.id), eq(conversations.userId, userId)));
    if (!conv) { res.status(404).json({ error: "Not found" }); return; }
    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, params.data.id))
      .orderBy(messages.createdAt);
    res.json({ ...conv, messages: msgs });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch conversation" });
  }
});

router.delete("/anthropic/conversations/:id", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const params = DeleteAnthropicConversationParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const [conv] = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(and(eq(conversations.id, params.data.id), eq(conversations.userId, userId)));
    if (!conv) { res.status(404).json({ error: "Not found" }); return; }
    await db.delete(messages).where(eq(messages.conversationId, params.data.id));
    await db.delete(conversations).where(eq(conversations.id, params.data.id));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});

router.get("/anthropic/conversations/:id/messages", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const params = ListAnthropicMessagesParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const [conv] = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(and(eq(conversations.id, params.data.id), eq(conversations.userId, userId)));
    if (!conv) { res.status(404).json({ error: "Not found" }); return; }
    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, params.data.id))
      .orderBy(messages.createdAt);
    res.json(msgs);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

router.post("/anthropic/conversations/:id/messages", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const params = SendAnthropicMessageParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const body = SendAnthropicMessageBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  try {
    const [conv] = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, params.data.id), eq(conversations.userId, userId)));
    if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

    await db.insert(messages).values({
      conversationId: params.data.id,
      role: "user",
      content: body.data.content,
    });

    const history = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, params.data.id))
      .orderBy(messages.createdAt);

    const fullContent = await callGeminiWithRetry(
      history.map((m) => ({ role: m.role, content: m.content }))
    );

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.write(`data: ${JSON.stringify({ content: fullContent })}\n\n`);
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();

    await db.insert(messages).values({
      conversationId: params.data.id,
      role: "assistant",
      content: fullContent,
    });
  } catch (err) {
    req.log.error(err);
    if (!res.headersSent) {
      res.status(500).json({ error: "AI request failed. Please try again." });
      return;
    }
    res.write(`data: ${JSON.stringify({ content: "Sorry, an error occurred. Please try again." })}\n\n`);
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  }
});

router.post("/chat/stream", async (req, res): Promise<void> => {
  const { messages: msgHistory } = req.body as {
    messages: { role: string; content: string }[];
  };
  if (!msgHistory || !Array.isArray(msgHistory)) {
    res.status(400).json({ error: "messages array required" });
    return;
  }

  try {
    const fullContent = await callGeminiWithRetry(
      msgHistory.filter((m) => m.role === "user" || m.role === "assistant")
    );

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: fullContent } }] })}\n\n`);
    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (err) {
    req.log.error(err);
    if (!res.headersSent) {
      res.status(500).json({ error: "AI request failed. Please try again." });
      return;
    }
    res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: "Sorry, an error occurred. Please try again." } }] })}\n\n`);
    res.write(`data: [DONE]\n\n`);
    res.end();
  }
});

export default router;
