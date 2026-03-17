const FB_API_VERSION = "v19.0";
const FB_GRAPH_BASE = `https://graph.facebook.com/${FB_API_VERSION}`;
const PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;

function isConfigured(): boolean {
  return !!PAGE_ACCESS_TOKEN;
}

interface PageInfo {
  id: string;
  name: string;
  username?: string;
}

let cachedPageInfo: PageInfo | null = null;

/**
 * Fetch the Facebook Page's id, name, and username from the Graph API.
 * Result is cached in memory for the lifetime of the process.
 */
export async function getPageInfo(): Promise<PageInfo | null> {
  if (cachedPageInfo) return cachedPageInfo;
  if (!isConfigured()) return null;

  try {
    const url = `${FB_GRAPH_BASE}/me?fields=id,name,username&access_token=${PAGE_ACCESS_TOKEN}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      console.error(`[Facebook] Failed to fetch page info: ${resp.status}`);
      return null;
    }
    const data = await resp.json() as PageInfo;
    cachedPageInfo = data;
    return data;
  } catch (err) {
    console.error("[Facebook] Error fetching page info:", err);
    return null;
  }
}

/**
 * Build the m.me link for a product.
 * Format: https://m.me/{page_username_or_id}?ref=product_{productId}
 */
export async function buildMeLink(productId: number): Promise<string> {
  const info = await getPageInfo();
  const handle = info?.username ?? info?.id ?? "yourpage";
  return `https://m.me/${handle}?ref=product_${productId}`;
}

/**
 * Parse a m.me ref string and extract the product ID.
 * Returns null if the ref is not a product ref.
 */
export function parseProductRef(ref: string): number | null {
  const match = ref.match(/^product_(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
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

