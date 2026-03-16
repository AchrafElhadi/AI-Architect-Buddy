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

