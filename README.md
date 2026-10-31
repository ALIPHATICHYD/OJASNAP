# OjaSnap 🛍️

**Snap it. Post it. Sell it.** Take a photo of what you're selling and **Gemma 4** writes a listing you can post right away: a WhatsApp Status, an Instagram caption with Lagos hashtags, and a natural **Nigerian Pidgin** version. It also drafts replies to customers' DMs ("abeg how much last price?").

Built at **Hacktoberfest Hack Day Yaba x AWS Student Builder Group Unilag** · Track: **E-Commerce** · MIT licensed.

---

## How to test (2 minutes)

You need **Node.js 18+**. Nothing to install: the project has no dependencies.

```bash
git clone https://github.com/ALIPHATICHYD/ojasnap.git
cd ojasnap
```

**Option A: with Gemma 4 (real AI)**

1. Get a free Gemini API key at <https://aistudio.google.com/apikey>.
2. Run it:
   ```bash
   cp .env.example .env        # then paste your key after GEMINI_API_KEY=
   npm start
   ```
3. Open <http://localhost:3000>. The badge at the top right should say **"Gemma 4 · gemma-4-26b-a4b-it"**.

**Option B: demo mode (no key)**

```bash
npm run demo
```
This returns a sample listing so you can click through the whole flow. The badge says **"Demo mode"**.

**Then try this:**

1. Tap **"Tap to snap or upload"** and pick any product photo (shoes, a bag, food, a phone, a book).
2. Optionally type a price (e.g. `8500`) and a location (e.g. `Yaba`), then press **✨ Write my listing**.
3. You'll get a product name, selling points, a WhatsApp Status, an Instagram caption, a Pidgin caption, a photo tip, and buyer FAQs. Press **Copy** or **Send on WhatsApp** on any of them.
4. Scroll to **📥 Reply to a customer**, paste `Abeg how much last price? I dey Akoka`, and press **Draft reply**. Gemma answers in Pidgin, stays polite, and doesn't invent a new price.

Run the tests with `npm test`.

---

## The problem

In Lagos, most small businesses sell through **WhatsApp Status and Instagram**. That includes the thousands of student vendors at Unilag and in Yaba. Every day they:

- write a new caption for each product, often late at night between lectures,
- try to sound good in both English and Pidgin for different audiences,
- answer the same DMs again and again ("how much?", "last price?", "do you deliver to Akoka?").

It's slow, repetitive, and a weak caption costs sales.

## What OjaSnap does

| Step | What Gemma 4 does |
|---|---|
| 📸 Photo in | Looks at the image (multimodal) to work out what the product is, its condition and its visible selling points |
| ✍️ Listing out | Writes a WhatsApp Status, Instagram caption + hashtags, Pidgin caption, and a price hint |
| 💡 Coaching | Gives one concrete tip to make the photo sell better |
| ❓ Buyer FAQ | Predicts the questions buyers will ask, with ready answers |
| 📥 DM replies | Drafts a polite reply to a customer's message, matches their language (Pidgin or English), and never invents a price |

Guardrails in the prompt: Gemma describes only what it can see plus the seller's notes, uses the seller's price exactly, and marks any price guess as an "estimate".

## How Gemma 4 is used

- **Model:** `gemma-4-26b-a4b-it` (an open-weights MoE model, fast enough for live use) through the **Gemini API** `generateContent` endpoint. You can switch to `gemma-4-31b-it` with `GEMMA_MODEL`.
- **Multimodal:** the product photo is sent as `inline_data` next to the text prompt. The browser shrinks it to 1024px JPEG first, so it uploads quickly on mobile data.
- **Structured output:** Gemma returns one JSON object. The server pulls the JSON out of the text and, if it is malformed, asks Gemma once to repair it.
- **Thinking:** set to `minimal` for speed. The server falls back cleanly if the model rejects that setting.

## Architecture

```
public/index.html   one mobile-first page (vanilla JS, no build step)
server.js           Node http server, zero dependencies
  GET  /api/health   which model is active / demo mode
  POST /api/listing  photo + seller details -> Gemma 4 -> listing JSON
  POST /api/reply    listing + customer DM -> Gemma 4 -> reply text
test/               node:test tests (run in demo mode)
```

The API key stays on the server and is never sent to the browser.

## Roadmap

- WhatsApp Business bot: send a photo to a number and get the listing back
- Catalog memory: keep your products and prices so DM replies get them right every time
- Yoruba, Igbo and Hausa captions
- Run fully offline with Gemma on-device via Ollama for sellers with poor data

## License

[MIT](LICENSE)
