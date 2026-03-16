import OpenAI from "openai";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

    if (baseURL && apiKey) {
      client = new OpenAI({ baseURL, apiKey });
    } else if (process.env.OPENAI_API_KEY) {
      client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    } else {
      throw new Error("No OpenAI credentials configured. Set AI_INTEGRATIONS_OPENAI_BASE_URL/AI_INTEGRATIONS_OPENAI_API_KEY or OPENAI_API_KEY.");
    }
  }
  return client;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ProductContext {
  name: string;
  price: number | string;
  colors?: string | null;
  stock?: number | null;
  description?: string | null;
  attributes?: string | null;
}

function buildSystemPrompt(product: ProductContext): string {
  const parts = [
    `You are a friendly and professional sales assistant for an online Facebook shop. Your goal is to help customers learn about products and guide them toward making a purchase.`,
    ``,
    `Product you are selling:`,
    `- Name: ${product.name}`,
    `- Price: ${product.price} MAD`,
  ];

  if (product.colors) parts.push(`- Available colors: ${product.colors}`);
  if (product.stock != null) parts.push(`- Stock: ${product.stock} units available`);
  if (product.description) parts.push(`- Description: ${product.description}`);
  if (product.attributes) parts.push(`- Additional details: ${product.attributes}`);

  parts.push(
    ``,
    `Rules:`,
    `- Always respond in the same language the customer uses. Supported languages include:`,
    `  * Moroccan Darija (dialect written in Latin letters + numbers, e.g. "ch7al taman", "bghit", "wach kayn", "salam") — respond in the same Darija style`,
    `  * Arabic (Modern Standard or dialectal) — respond in Arabic script`,
    `  * French — respond in French`,
    `  * English — respond in English`,
    `  * Any other language the customer writes in`,
    `- IMPORTANT: you MUST always produce a response. Never return an empty reply.`,
    `- Be warm, helpful, and conversational — like a real human sales agent`,
    `- If the customer asks about price, tell them clearly`,
    `- Guide the customer step by step: first ask which color they want, then how many, then their phone number for delivery`,
    `- If the customer seems ready to buy, ask for: phone number, delivery address, and quantity`,
    `- If asked to negotiate on price, gently decline but emphasize the quality`,
    `- Keep responses concise and to the point`,
    `- If you cannot answer a question confidently, say you will check and get back to them`,
    `- Never make up information not in the product details`,
  );

  return parts.join("\n");
}

/**
 * Detects the language of the user's message and returns the comment acknowledgement
 * ("I've sent you a private message") translated into that exact language/dialect.
 * Falls back to English if the AI call fails.
 */
export async function generateCommentAck(userMessage: string): Promise<string> {
  const FALLBACK = "Hi! I've sent you a private message on Messenger with all the details 📩";
  try {
    const openai = getClient();
    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a translator. The user will send you a short message in any language or dialect " +
            "(including Moroccan Darija written in Latin letters + numbers, Arabic, French, English, etc.). " +
            "Detect the language/dialect of that message and translate the following sentence into the SAME language and style:\n\n" +
            '"Hi! I\'ve sent you a private message on Messenger with all the details 📩"\n\n' +
            "Return ONLY the translated sentence. No explanations, no quotes, no extra text.",
        },
        { role: "user", content: userMessage },
      ],
      max_completion_tokens: 1000,
    });

    const text = response.choices[0]?.message?.content?.trim();
    return text && text.length > 0 ? text : FALLBACK;
  } catch (err) {
    console.error("[AI] generateCommentAck failed, using fallback:", err);
    return FALLBACK;
  }
}

export async function generateAiReply(
  product: ProductContext,
  conversationHistory: ChatMessage[],
): Promise<{ content: string; shouldEscalate: boolean }> {
  const openai = getClient();

  const systemPrompt = buildSystemPrompt(product);

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...conversationHistory.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  const response = await openai.chat.completions.create({
    model: "gpt-5-mini",
    messages,
    max_completion_tokens: 500,
  });

  const raw = response.choices[0]?.message?.content;

  // If the model returned empty (can happen for Darija or unsupported dialects),
  // extract the user's last message and produce a language-aware fallback
  let content: string;
  if (raw && raw.trim().length > 0) {
    content = raw.trim();
  } else {
    const lastUserMsg = conversationHistory.filter((m) => m.role === "user").at(-1)?.content ?? "";
    console.warn(`[AI] Empty response from model. Last user message: "${lastUserMsg}". Using informative fallback.`);
    const hasArabicScript = /[\u0600-\u06FF]/.test(lastUserMsg);
    const hasDarija = /\b(salam|ch7al|bghit|wach|kayn|dyal|fin|chno|kifash|bslama|labas|taman|chhal)\b/i.test(lastUserMsg);
    const hasFrench = /\b(bonjour|salut|prix|couleur|disponible|merci|svp|combien|qu.elle|comment)\b/i.test(lastUserMsg);

    const price = typeof product.price === "string" ? parseFloat(product.price).toFixed(2) : Number(product.price).toFixed(2);
    const colors = product.colors ?? "";
    const stock = product.stock != null ? String(product.stock) : null;

    if (hasDarija) {
      const stockInfo = stock ? `, ${stock} unités disponibles` : "";
      content = `Salam! ${product.name} taman dyal ${price} MAD${stockInfo}.${colors ? ` Lwan: ${colors}.` : ""} Chmen lwan bghiti? 😊`;
    } else if (hasArabicScript) {
      const stockInfo = stock ? `، المخزون ${stock} وحدة` : "";
      content = `مرحباً! سعر ${product.name} هو ${price} درهم${stockInfo}.${colors ? ` الألوان المتاحة: ${colors}.` : ""} أي لون تفضل؟ 😊`;
    } else if (hasFrench) {
      const stockInfo = stock ? `, ${stock} unités disponibles` : "";
      content = `Bonjour ! Le prix de ${product.name} est ${price} MAD${stockInfo}.${colors ? ` Couleurs disponibles : ${colors}.` : ""} Quelle couleur vous intéresse ? 😊`;
    } else {
      const stockInfo = stock ? `, ${stock} units in stock` : "";
      content = `Hi! The ${product.name} costs ${price} MAD${stockInfo}.${colors ? ` Available colors: ${colors}.` : ""} Which color would you like? 😊`;
    }
  }

  const escalationKeywords = [
    "negotiate", "discount", "reduce", "lower price", "less than", "pas cher", "moins cher",
    "réduction", "remise", "نقص", "تخفيض", "أرخص", "سعر أقل"
  ];
  const lowerContent = content.toLowerCase();
  const shouldEscalate = escalationKeywords.some((k) => lowerContent.includes(k));

  return { content, shouldEscalate };
}
