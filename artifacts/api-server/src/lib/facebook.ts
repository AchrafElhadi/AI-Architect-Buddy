const FB_API_VERSION = "v19.0";
const FB_GRAPH_BASE = `https://graph.facebook.com/${FB_API_VERSION}`;
const PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;

function isConfigured(): boolean {
  return !!PAGE_ACCESS_TOKEN;
}

/**
 * Reply publicly to a Facebook comment.
 * Typically used to say "I answered you in private, check your Messenger."
 */
export async function replyToComment(commentId: string, text: string): Promise<void> {
  if (!isConfigured()) {
    console.warn("[Facebook] FB_PAGE_ACCESS_TOKEN not set — skipping comment reply");
    return;
  }

  const url = `${FB_GRAPH_BASE}/${commentId}/comments`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: text,
      access_token: PAGE_ACCESS_TOKEN,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[Facebook] Failed to reply to comment ${commentId}: ${response.status} ${errorBody}`);
  } else {
    const data = await response.json() as { id?: string };
    console.log(`[Facebook] Replied to comment ${commentId} → reply id: ${data.id}`);
  }
}

/**
 * Send a private message to a user via Facebook Messenger.
 * recipientId is the user's PSID (Page-Scoped ID).
 */
export async function sendMessengerMessage(recipientId: string, text: string): Promise<void> {
  if (!isConfigured()) {
    console.warn("[Facebook] FB_PAGE_ACCESS_TOKEN not set — skipping Messenger message");
    return;
  }

  const url = `${FB_GRAPH_BASE}/me/messages?access_token=${PAGE_ACCESS_TOKEN}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
      messaging_type: "RESPONSE",
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[Facebook] Failed to send Messenger message to ${recipientId}: ${response.status} ${errorBody}`);
  } else {
    const data = await response.json() as { message_id?: string };
    console.log(`[Facebook] Sent Messenger message to ${recipientId} → message_id: ${data.message_id}`);
  }
}

/**
 * Build the public comment reply text acknowledging the private message.
 * Uses the user's original message to detect language (more reliable than checking AI output).
 */
export function buildCommentAckText(aiReplyContent: string, userMessage: string = ""): string {
  const userText = userMessage.toLowerCase();
  const aiText = aiReplyContent.toLowerCase();

  const hasArabicScript = /[\u0600-\u06FF]/.test(userMessage) || /[\u0600-\u06FF]/.test(aiReplyContent);
  const hasDarija = /\b(salam|ch7al|bghit|wach|kayn|dyal|fin|chno|kifash|bslama|labas|taman|chhal)\b/i.test(userText);
  const hasFrench = /\b(bonjour|salut|prix|couleur|disponible|merci|svp|combien|qu.elle|comment)\b/i.test(userText)
    || /\b(bonjour|merci|oui|non|disponible|couleur|livraison)\b/.test(aiText);

  if (hasDarija) {
    return "Salam! Jwbtk f message privé f Messenger, chuf les messages dyalek 📩";
  }
  if (hasArabicScript) {
    return "مرحباً! لقد أجبتك في رسالة خاصة على Messenger. تحقق من صندوق الوارد الخاص بك 📩";
  }
  if (hasFrench) {
    return "Bonjour ! Je vous ai répondu en message privé sur Messenger. Consultez votre boîte de réception 📩";
  }
  return "Hi! I've sent you a private message on Messenger with all the details 📩";
}
