// OjaSnap: snap a product photo, get a ready-to-post listing.
// Zero dependencies. Node 18+ (uses global fetch).
const http = require("http");
const fs = require("fs");
const path = require("path");

loadDotEnv();

const PORT = Number(process.env.PORT) || 3000;
const API_KEY = process.env.GEMINI_API_KEY || "";
const MODEL = process.env.GEMMA_MODEL || "gemma-4-26b-a4b-it";
const DEMO = process.env.DEMO === "1" || !API_KEY;
const PUBLIC_DIR = path.join(__dirname, "public");
const MAX_BODY = 8 * 1024 * 1024; // 8 MB

const LISTING_PROMPT = ({ price, location, seller, notes }) => `You are OjaSnap, a sales assistant for small sellers in Lagos, Nigeria who sell on WhatsApp and Instagram.
Look carefully at the product photo and write a listing the seller can post right now.

Seller details (may be empty):
- Price: ${price || "not given"}
- Location: ${location || "Lagos"}
- Seller / shop name: ${seller || "not given"}
- Extra notes from seller: ${notes || "none"}

Rules:
- Describe only what you can actually see, plus the seller's notes. Never invent brand names, sizes or specs you cannot see.
- If the seller gave a price, use it exactly, in Naira (₦). If not, write "DM for price" in captions and give a cautious price_hint.
- Keep captions short, warm and natural for Nigerian buyers. Do not use emojis.
- The Pidgin caption must be natural Nigerian Pidgin, not a word-for-word translation.
- The Yoruba caption must be natural, everyday Lagos Yoruba with correct tone marks where you are confident; keep prices and brand words as-is.

Reply with ONLY one JSON object, no markdown fences, with exactly these keys:
{
  "product_name": "short name",
  "category": "e.g. Fashion, Food, Electronics, Beauty, Books, Home",
  "condition": "New / Fairly used / Unclear",
  "selling_points": ["3 to 5 short bullet points"],
  "whatsapp_status": "caption for WhatsApp Status, max 300 characters, ends with a call to action",
  "instagram_caption": "caption for Instagram, 2 to 4 short lines, then 6 to 10 hashtags including Lagos ones",
  "pidgin_caption": "same idea in Nigerian Pidgin, max 300 characters",
  "yoruba_caption": "same idea in Yoruba, max 300 characters",
  "price_hint": "if no price was given, a cautious Naira range with the word 'estimate'; otherwise repeat the seller's price",
  "photo_tip": "one concrete tip to make this photo sell better",
  "faq": [{"q": "a question buyers will likely ask", "a": "a short answer the seller can send"}]
}`;

const REPLY_PROMPT = ({ listing, catalog, message, tone }) => `You are OjaSnap, helping a small Lagos seller reply to a customer on WhatsApp.

The product the customer is most likely asking about (JSON):
${JSON.stringify(listing || {}, null, 2)}

The seller's full catalog (name, price, condition). Use it if the customer asks about other items or what else is available:
${catalogText(catalog)}

The customer wrote:
"""${message}"""

Write ONE reply the seller can send as-is.
- Tone: ${tone || "friendly and professional"}.
- If the customer is bargaining ("last price", "reduce am"), stay polite, hold value, and you may offer a small gesture (e.g. free delivery within an area) only if it fits; never invent a new price the seller didn't give.
- If they ask something the listing doesn't answer, say you'll confirm and ask a short follow-up question.
- Only quote prices that appear above. Never invent a price.
- Match the customer's language: reply in Pidgin if they wrote in Pidgin, Yoruba if they wrote in Yoruba, otherwise English.
- Max 3 short sentences. No markdown.

Reply with ONLY the message text.`;

function catalogText(catalog) {
  if (!Array.isArray(catalog) || !catalog.length) return "(empty)";
  return catalog
    .slice(0, 50)
    .map((c) => `- ${String(c.product_name || "Item").slice(0, 80)} | ${String(c.price || "DM for price").slice(0, 30)} | ${String(c.condition || "").slice(0, 20)}`)
    .join("\n");
}

// ---------- Gemma via Gemini API ----------
async function callGemma(parts, { thinking = "minimal" } = {}) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const body = {
    contents: [{ role: "user", parts }],
    generationConfig: { temperature: 0.7, thinkingConfig: { thinkingLevel: thinking } },
  };
  let res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": API_KEY },
    body: JSON.stringify(body),
  });
  // Some model versions reject thinkingConfig; retry once without it.
  if (res.status === 400) {
    const errText = await res.text();
    if (/thinking/i.test(errText)) {
      delete body.generationConfig.thinkingConfig;
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": API_KEY },
        body: JSON.stringify(body),
      });
    } else {
      throw new Error(`Gemini API 400: ${errText.slice(0, 300)}`);
    }
  }
  if (!res.ok) throw new Error(`Gemini API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text = (data.candidates?.[0]?.content?.parts || [])
    .filter((p) => !p.thought && typeof p.text === "string")
    .map((p) => p.text)
    .join("")
    .trim();
  if (!text) throw new Error("Gemma returned an empty response");
  return text;
}

function extractJson(text) {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON found in model output");
  return JSON.parse(cleaned.slice(start, end + 1));
}

// ---------- Demo mode (no API key) ----------
const DEMO_LISTING = {
  product_name: "Ankara Print Tote Bag",
  category: "Fashion",
  condition: "New",
  selling_points: [
    "Bold Ankara print that stands out",
    "Roomy enough for laptop and books",
    "Strong double-stitched handles",
    "Handmade in Lagos",
  ],
  whatsapp_status:
    "New drop! Handmade Ankara tote, roomy enough for your laptop and books. ₦8,500 only. Delivery anywhere in Lagos. Send DM to order before e finish!",
  instagram_caption:
    "Your everyday bag, but make it Ankara.\nRoomy, strong, and handmade in Lagos.\n₦8,500 · Lagos delivery available.\n#AnkaraBag #LagosVendor #ToteBag #MadeInNigeria #UnilagVendor #LagosFashion #ShopLagos #NaijaBrand",
  pidgin_caption:
    "Ankara tote don land! E big well well, laptop and books go enter. Na ₦8,500 only. We dey deliver anywhere for Lagos. DM sharp sharp!",
  yoruba_caption:
    "Àpò Ankara tuntun ti dé! Ó tóbi, laptop àti ìwé yóò wọ̀ ọ́. ₦8,500 péré. A ń fi ránṣẹ́ sí gbogbo Èkó. Ẹ DM wa kíákíá!",
  price_hint: "₦8,500",
  photo_tip: "Shoot it near a window in daylight, and add one photo of someone carrying it so buyers see the size.",
  faq: [
    { q: "Is delivery free?", a: "Delivery within Yaba and Unilag is free. Other parts of Lagos are ₦1,500." },
    { q: "Do you have other prints?", a: "Yes! Send me a DM and I'll share the other prints available today." },
  ],
};

// ---------- HTTP ----------
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon" };

function send(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error("Image too large (max ~6 MB)"));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString() || "{}")); }
      catch { reject(new Error("Invalid JSON body")); }
    });
    req.on("error", reject);
  });
}

async function handleListing(req, res) {
  const { image, mimeType, price, location, seller, notes } = await readBody(req);
  if (!image) return send(res, 400, { error: "Please add a product photo." });
  if (DEMO) return send(res, 200, { listing: DEMO_LISTING, model: "demo-mode" });
  const parts = [
    { inline_data: { mime_type: mimeType || "image/jpeg", data: image } },
    { text: LISTING_PROMPT({ price, location, seller, notes }) },
  ];
  const raw = await callGemma(parts);
  let listing;
  try { listing = extractJson(raw); }
  catch {
    // One repair attempt: ask Gemma to fix its own JSON.
    const fixed = await callGemma([{ text: `Turn this into ONE valid JSON object with the same keys. Output only JSON.\n\n${raw}` }]);
    listing = extractJson(fixed);
  }
  send(res, 200, { listing, model: MODEL });
}

async function handleReply(req, res) {
  const { listing, catalog, message, tone } = await readBody(req);
  if (!message) return send(res, 400, { error: "Paste the customer's message first." });
  if (DEMO) {
    const pidgin = /\b(abeg|how much|wetin|dey|last price|reduce|na)\b/i.test(message);
    const reply = pidgin
      ? "Thank you o. Na ₦8,500 be the price and e dey quality. I fit do free delivery if you dey Yaba or Unilag. Make I package am for you?"
      : "Thanks for reaching out! It's ₦8,500 and it's handmade with strong stitching. I can do free delivery within Yaba/Unilag. Shall I reserve one for you?";
    return send(res, 200, { reply, model: "demo-mode" });
  }
  const reply = await callGemma([{ text: REPLY_PROMPT({ listing, catalog, message, tone }) }]);
  send(res, 200, { reply: reply.replace(/^"|"$/g, ""), model: MODEL });
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = path.normalize(path.join(PUBLIC_DIR, urlPath === "/" ? "index.html" : urlPath));
  if (!file.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/api/health") return send(res, 200, { ok: true, model: DEMO ? "demo-mode" : MODEL, demo: DEMO });
    if (req.method === "POST" && req.url === "/api/listing") return await handleListing(req, res);
    if (req.method === "POST" && req.url === "/api/reply") return await handleReply(req, res);
    if (req.method === "GET") return serveStatic(req, res);
    res.writeHead(405); res.end();
  } catch (e) {
    console.error(e);
    send(res, 500, { error: e.message || "Something went wrong" });
  }
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`OjaSnap running on http://localhost:${PORT}`);
    console.log(DEMO ? "Demo mode: no GEMINI_API_KEY set, returning sample output." : `Using ${MODEL} via the Gemini API.`);
  });
}

function loadDotEnv() {
  try {
    const txt = fs.readFileSync(path.join(__dirname, ".env"), "utf8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch { /* no .env file */ }
}

module.exports = { extractJson, catalogText, server };
