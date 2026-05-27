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

const GEMINI_MODEL = "gemini-2.0-flash-lite";

const SYSTEM_PROMPT = `You are Zhuu AI — a highly intelligent, reliable, and versatile AI assistant. You are especially strong in coding, programming, debugging, algorithm design, and technical explanations. You are also knowledgeable about science, math, writing, creative tasks, and general knowledge. You speak in a friendly, clear, and confident manner. When answering coding questions, always provide working, well-commented code. Your name is Zhuu AI.`;

function getGeminiKey(): string | null {
  const key = process.env.GEMINI_API_KEY;
  return key && key.trim().length > 0 ? key.trim() : null;
}

function requireAuth(req: any, res: any): string | null {
  const auth = req.auth;
  const userId: string | undefined = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  return userId;
}

async function callGeminiWithRetry(
  history: { role: string; content: string }[],
  retries = 2
): Promise<string> {
  const apiKey = getGeminiKey();
  if (!apiKey) {
    return "⚠️ **AI is not configured yet.** To enable Zhuu AI, please add your `GEMINI_API_KEY` in the Replit Secrets tab. Get a free key at https://aistudio.google.com/app/apikey";
  }

  const contents = history
    .filter((m) => m.content && m.content.trim())
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  if (contents.length === 0) {
    return "Please send a message to get started!";
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25_000);

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents,
            generationConfig: {
              maxOutputTokens: 2048,
              temperature: 0.85,
              topP: 0.95,
            },
          }),
        }
      );

      clearTimeout(timeout);

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        const msg = (errBody as any)?.error?.message ?? response.statusText;
        if (response.status === 429 && attempt < retries) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        if (response.status === 400) {
          return `❌ AI request error: ${msg}. Please check your API key is valid.`;
        }
        throw new Error(`Gemini API error ${response.status}: ${msg}`);
      }

      const data = (await response.json()) as any;
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        const finishReason = data?.candidates?.[0]?.finishReason;
        if (finishReason === "SAFETY") {
          return "I can't respond to that request due to safety guidelines. Please try rephrasing your message.";
        }
        return "I didn't receive a valid response. Please try again.";
      }

      return text;
    } catch (err: any) {
      if (err?.name === "AbortError") {
        if (attempt < retries) continue;
        return "⏱️ The AI took too long to respond. Please try again with a shorter message.";
      }
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }

  return "The AI failed to respond after multiple attempts. Please try again.";
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
