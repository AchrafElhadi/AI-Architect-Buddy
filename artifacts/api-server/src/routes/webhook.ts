import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, conversationsTable, messagesTable, productsTable } from "@workspace/db";
import { SimulateMessageBody } from "@workspace/api-zod";
import { generateAiReply } from "../lib/ai";
import { replyToComment, sendMessengerMessage, buildCommentAckText } from "../lib/facebook";

const router: IRouter = Router();

const WEBHOOK_VERIFY_TOKEN = process.env.FB_WEBHOOK_VERIFY_TOKEN ?? "fb_verify_token_123";

// ─── Facebook Webhook Verification ───────────────────────────────────────────

router.get("/webhook/facebook", (req, res): void => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === WEBHOOK_VERIFY_TOKEN) {
    console.log("Facebook webhook verified");
    res.status(200).send(challenge);
  } else {
    res.status(403).json({ error: "Forbidden" });
  }
});

// ─── Facebook Webhook Events ──────────────────────────────────────────────────

router.post("/webhook/facebook", async (req, res): Promise<void> => {
  const body = req.body;

  if (body.object === "page") {
    for (const entry of body.entry ?? []) {
      // ── Messenger messages ──────────────────────────────────────────────────
      for (const messagingEvent of entry.messaging ?? []) {
        if (messagingEvent.message && !messagingEvent.message.is_echo) {
          const fbUserId = messagingEvent.sender?.id as string;
          const messageText = messagingEvent.message?.text as string;
          const fbMessageId = messagingEvent.message?.mid as string;

          if (fbUserId && messageText) {
            const result = await handleIncomingMessage({
              fbUserId,
              messageText,
              fbMessageId,
              source: "facebook",
            });

            // Send AI reply back via Messenger
            if (result?.aiReply?.content) {
              await sendMessengerMessage(fbUserId, result.aiReply.content);
            }
          }
        }
      }

      // ── Page feed events (comments on posts) ────────────────────────────────
      for (const change of entry.changes ?? []) {
        if (change.field === "feed" && change.value?.item === "comment") {
          const fbUserId = change.value?.from?.id as string;
          const fbUserName = change.value?.from?.name as string | undefined;
          const messageText = change.value?.message as string;
          const commentId = change.value?.comment_id as string;

          if (fbUserId && messageText) {
            const result = await handleIncomingMessage({
              fbUserId,
              fbUserName,
              messageText,
              fbMessageId: commentId,
              source: "facebook",
            });

            if (result?.aiReply?.content) {
              // 1️⃣ Reply publicly on the comment: "I answered you in private"
              const ackText = buildCommentAckText(result.aiReply.content);
              await replyToComment(commentId, ackText);

              // 2️⃣ Send the full AI reply as a private Messenger message
              await sendMessengerMessage(fbUserId, result.aiReply.content);
            }
          }
        }
      }
    }
  }

  res.status(200).json({ status: "ok" });
});

// ─── Core message handler (shared by webhook + simulate) ─────────────────────

async function handleIncomingMessage({
  fbUserId,
  messageText,
  fbMessageId,
  fbUserName,
  productId,
  source,
}: {
  fbUserId: string;
  messageText: string;
  fbMessageId?: string;
  fbUserName?: string;
  productId?: number;
  source: "facebook" | "simulated";
}) {
  let targetProductId = productId;

  if (!targetProductId) {
    const [firstProduct] = await db.select().from(productsTable).where(eq(productsTable.isActive, true)).limit(1);
    if (!firstProduct) return null;
    targetProductId = firstProduct.id;
  }

  const conditions = [
    eq(conversationsTable.fbUserId, fbUserId),
    eq(conversationsTable.productId, targetProductId),
  ];

  let [conv] = await db
    .select()
    .from(conversationsTable)
    .where(and(...conditions))
    .limit(1);

  if (!conv) {
    const [newConv] = await db.insert(conversationsTable).values({
      productId: targetProductId,
      fbUserId,
      fbUserName: fbUserName ?? null,
      mode: "ai",
      status: "in_progress",
    }).returning();
    conv = newConv;
  }

  const [userMessage] = await db.insert(messagesTable).values({
    conversationId: conv.id,
    role: "user",
    content: messageText,
    source,
    fbMessageId: fbMessageId ?? null,
  }).returning();

  await db.update(conversationsTable).set({ updatedAt: new Date() }).where(eq(conversationsTable.id, conv.id));

  // If in manual mode, store message but don't generate AI reply
  if (conv.mode !== "ai") {
    return { conv, userMessage, aiReply: null };
  }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, targetProductId));
  if (!product) return { conv, userMessage, aiReply: null };

  const history = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, conv.id))
    .orderBy(messagesTable.createdAt);

  const chatHistory = history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const { content, shouldEscalate } = await generateAiReply(
    {
      name: product.name,
      price: product.price,
      colors: product.colors,
      stock: product.stock,
      description: product.description,
      attributes: product.attributes,
    },
    chatHistory,
  );

  const [aiReply] = await db.insert(messagesTable).values({
    conversationId: conv.id,
    role: "assistant",
    content,
    source: "ai",
  }).returning();

  if (shouldEscalate) {
    await db.update(conversationsTable)
      .set({ mode: "manual", status: "manual_intervention", updatedAt: new Date() })
      .where(eq(conversationsTable.id, conv.id));
  } else {
    await db.update(conversationsTable).set({ updatedAt: new Date() }).where(eq(conversationsTable.id, conv.id));
  }

  return { conv, userMessage, aiReply };
}

// ─── Simulate endpoint (for testing without real Facebook) ───────────────────

router.post("/simulate/message", async (req, res): Promise<void> => {
  const parsed = SimulateMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const result = await handleIncomingMessage({
    fbUserId: parsed.data.fbUserId,
    messageText: parsed.data.message,
    fbUserName: parsed.data.fbUserName,
    productId: parsed.data.productId,
    source: "simulated",
  });

  if (!result) {
    res.status(404).json({ error: "No active product found" });
    return;
  }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, result.conv.productId));

  const convWithMeta = {
    ...result.conv,
    productName: product?.name ?? "Unknown",
    lastMessage: result.aiReply?.content ?? result.userMessage.content,
    messageCount: 2,
  };

  res.status(201).json({
    conversation: convWithMeta,
    userMessage: result.userMessage,
    aiReply: result.aiReply,
  });
});

export default router;
