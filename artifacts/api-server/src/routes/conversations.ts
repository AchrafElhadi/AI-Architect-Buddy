import { Router, type IRouter } from "express";
import { eq, and, sql, desc } from "drizzle-orm";
import { db, conversationsTable, messagesTable, productsTable } from "@workspace/db";
import {
  ListConversationsQueryParams,
  GetConversationParams,
  UpdateConversationParams,
  UpdateConversationBody,
  SendMessageParams,
  SendMessageBody,
  TriggerAiReplyParams,
} from "@workspace/api-zod";
import { generateAiReply } from "../lib/ai";

const router: IRouter = Router();

router.get("/conversations", async (req, res): Promise<void> => {
  const query = ListConversationsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions = [];

  if (query.data.tab) {
    const tabToStatus: Record<string, string> = {
      confirmed: "confirmed",
      in_progress: "in_progress",
      manual: "manual_intervention",
    };
    const status = tabToStatus[query.data.tab];
    if (status) conditions.push(eq(conversationsTable.status, status));
  }

  if (query.data.productId) {
    conditions.push(eq(conversationsTable.productId, query.data.productId));
  }

  const convs = await db
    .select({
      id: conversationsTable.id,
      productId: conversationsTable.productId,
      productName: productsTable.name,
      fbUserId: conversationsTable.fbUserId,
      fbUserName: conversationsTable.fbUserName,
      mode: conversationsTable.mode,
      status: conversationsTable.status,
      createdAt: conversationsTable.createdAt,
      updatedAt: conversationsTable.updatedAt,
    })
    .from(conversationsTable)
    .leftJoin(productsTable, eq(conversationsTable.productId, productsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(conversationsTable.updatedAt));

  const convIds = convs.map((c) => c.id);

  const lastMsgMap = new Map<number, string>();
  const countMap = new Map<number, number>();

  if (convIds.length > 0) {
    for (const cid of convIds) {
      const msgs = await db
        .select({ content: messagesTable.content })
        .from(messagesTable)
        .where(eq(messagesTable.conversationId, cid))
        .orderBy(desc(messagesTable.createdAt))
        .limit(1);
      if (msgs[0]) lastMsgMap.set(cid, msgs[0].content);

      const [countRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(messagesTable)
        .where(eq(messagesTable.conversationId, cid));
      countMap.set(cid, countRow?.count ?? 0);
    }
  }

  const result = convs.map((c) => ({
    ...c,
    productName: c.productName ?? "Unknown",
    lastMessage: lastMsgMap.get(c.id) ?? null,
    messageCount: countMap.get(c.id) ?? 0,
  }));

  res.json(result);
});

router.get("/conversations/:id", async (req, res): Promise<void> => {
  const params = GetConversationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [conv] = await db
    .select({
      id: conversationsTable.id,
      productId: conversationsTable.productId,
      productName: productsTable.name,
      fbUserId: conversationsTable.fbUserId,
      fbUserName: conversationsTable.fbUserName,
      mode: conversationsTable.mode,
      status: conversationsTable.status,
      createdAt: conversationsTable.createdAt,
      updatedAt: conversationsTable.updatedAt,
    })
    .from(conversationsTable)
    .leftJoin(productsTable, eq(conversationsTable.productId, productsTable.id))
    .where(eq(conversationsTable.id, params.data.id));

  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, conv.productId));

  const messages = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, conv.id))
    .orderBy(messagesTable.createdAt);

  const countRow = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, conv.id));

  res.json({
    ...conv,
    productName: conv.productName ?? "Unknown",
    messageCount: countRow[0]?.count ?? 0,
    product,
    messages,
  });
});

router.patch("/conversations/:id", async (req, res): Promise<void> => {
  const params = UpdateConversationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [conv] = await db
    .update(conversationsTable)
    .set(parsed.data)
    .where(eq(conversationsTable.id, params.data.id))
    .returning();

  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, conv.productId));

  res.json({
    ...conv,
    productName: product?.name ?? "Unknown",
    lastMessage: null,
    messageCount: 0,
  });
});

router.post("/conversations/:id/messages", async (req, res): Promise<void> => {
  const params = SendMessageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = SendMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, params.data.id));
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  const [message] = await db.insert(messagesTable).values({
    conversationId: conv.id,
    role: "assistant",
    content: parsed.data.content,
    source: "manual",
  }).returning();

  await db.update(conversationsTable).set({ updatedAt: new Date() }).where(eq(conversationsTable.id, conv.id));

  res.status(201).json(message);
});

router.post("/conversations/:id/ai-reply", async (req, res): Promise<void> => {
  const params = TriggerAiReplyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, params.data.id));
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, conv.productId));
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

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

  const [message] = await db.insert(messagesTable).values({
    conversationId: conv.id,
    role: "assistant",
    content,
    source: "ai",
  }).returning();

  if (shouldEscalate && conv.mode === "ai") {
    await db.update(conversationsTable)
      .set({ mode: "manual", status: "manual_intervention", updatedAt: new Date() })
      .where(eq(conversationsTable.id, conv.id));
  } else {
    await db.update(conversationsTable).set({ updatedAt: new Date() }).where(eq(conversationsTable.id, conv.id));
  }

  res.status(201).json(message);
});

export default router;
