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
    `- Always respond in the same language the customer uses (Arabic, French, English, etc.)`,
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

  const content = response.choices[0]?.message?.content ?? "I will get back to you shortly.";

  const escalationKeywords = [
    "negotiate", "discount", "reduce", "lower price", "less than", "pas cher", "moins cher",
    "réduction", "remise", "نقص", "تخفيض", "أرخص", "سعر أقل"
  ];
  const lowerContent = content.toLowerCase();
  const shouldEscalate = escalationKeywords.some((k) => lowerContent.includes(k));

  return { content, shouldEscalate };
}
