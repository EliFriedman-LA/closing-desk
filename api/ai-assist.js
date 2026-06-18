// =============================================================================
// Vercel Serverless Function — AI assist (document summaries + letter drafting)
// Repo location: api/ai-assist.js
// =============================================================================
// One endpoint, two tasks:
//   { task: "summarize", pdf?: "<base64>", text?: "<pasted text>" }
//       -> plain-English summary of a contract or title commitment
//   { task: "draft_letter", context: { ...matter fields } }
//       -> a ready-to-edit NJ attorney-review letter
//
// Response: { ok: true, result: "<text>" }  OR  { ok: false, error: "..." }
//
// REQUIRED ENV VAR (already set for contract import):
//   ANTHROPIC_API_KEY = sk-ant-...   (Production + Preview)
// =============================================================================

export const config = { maxDuration: 60 };

const MODEL = "claude-sonnet-4-6";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MAX_PDF_B64 = 4_300_000;

const SUMMARY_SYSTEM = `You are a senior title and closing attorney's assistant. You are given a real-estate document — usually a purchase/sale contract or a title insurance commitment. Produce a SHORT, plain-English summary the attorney can skim in about twenty seconds.

Rules:
- Open with ONE sentence stating what the document is, the parties, and the property.
- Then give simple "- " bullets for what matters at closing: price/loan amount; key dates (contract, attorney review, inspection, mortgage commitment, closing); and — for a commitment — the Schedule B-I requirements to clear (mortgages/liens to discharge, judgments, taxes) and the Schedule B-II exceptions worth noting (easements, survey matters, restrictions).
- End with a single "Watch:" line flagging anything unusual or risky.
- Be specific and concise. NEVER invent facts. If a key item is absent from the document, say so in a few words.
- Plain text only. No markdown headers, no preamble such as "Here is".`;

const LETTER_SYSTEM = `You are a New Jersey real-estate attorney drafting an attorney-review letter under the three-day attorney-review provision of the standard NJ Realtors/Bar Association contract form. Using the matter details provided, draft a professional letter that disapproves the contract in form (not substance) and proposes standard, reasonable modifications.

Rules:
- Standard business-letter body only — no letterhead, no invented addresses or phone numbers. Begin with a "Re:" line referencing the property and the parties.
- Address it to the other side's attorney if named, otherwise use "Dear Counsel:".
- State clearly that you represent your client, that you disapprove the contract pursuant to the attorney-review clause, and that the contract is not binding until review concludes.
- Include 3 to 6 customary, reasonable proposed modifications appropriate to the transaction type (e.g., time is of the essence on stated dates, home/radon/termite inspection rights, confirmation of the mortgage contingency, conveyance by bargain-and-sale deed with covenants as to grantor's acts, risk of loss, possession at closing, prorations).
- Put [brackets] only where a specific fact is genuinely unknown.
- Output ONLY the letter text — no commentary before or after.`;

async function anthropic(apiKey, system, userContent, maxTokens) {
  const r = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens || 1500, system, messages: [{ role: "user", content: userContent }] })
  });
  const data = await r.json();
  if (!r.ok) {
    const msg = (data && data.error && data.error.message) || JSON.stringify(data).slice(0, 300);
    throw new Error(`Claude API error: ${msg}`);
  }
  return (data.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n").trim();
}

function letterContext(ctx) {
  ctx = ctx || {};
  const lines = [
    `Transaction type: ${ctx.transaction_type || "Purchase"}`,
    `Property: ${ctx.property_address || "[property address]"}${ctx.town ? ", " + ctx.town : ""}${ctx.state ? ", " + ctx.state : ""}`,
    `Buyer / borrower: ${ctx.buyer || "[buyer]"}`,
    `Seller: ${ctx.seller || "[seller]"}`,
    `Lender: ${ctx.lender || "(not stated)"}`,
    `Contract date: ${ctx.contract_date || "(not stated)"}`,
    `Closing date: ${ctx.closing_date || "(not stated)"}`,
    `Title company: ${ctx.title_company || "(not stated)"}`,
    `Drafting firm: ${ctx.firm_name || "[your firm]"}`,
    `This firm represents: ${ctx.represents || "the buyer"}`
  ];
  return `Draft the attorney-review letter from the matter details below.\n\n${lines.join("\n")}`;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ ok: false, error: "ANTHROPIC_API_KEY is not set in Vercel → Settings → Environment Variables." });

  try {
    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
    body = body || {};
    const task = body.task;

    if (task === "summarize") {
      const pdf = typeof body.pdf === "string" ? body.pdf.trim() : "";
      const text = typeof body.text === "string" ? body.text.trim() : "";
      let userContent;
      if (pdf) {
        if (pdf.length > MAX_PDF_B64) return res.status(413).json({ ok: false, error: "That PDF is too large to send directly (over ~3 MB). Paste the text instead, or send a smaller file." });
        userContent = [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf } },
          { type: "text", text: "Summarize this document per your instructions." }
        ];
      } else if (text) {
        userContent = [{ type: "text", text: `Summarize the document below per your instructions.\n\n--- DOCUMENT ---\n${text}` }];
      } else {
        return res.status(400).json({ ok: false, error: "Send either a PDF (base64) or pasted text to summarize." });
      }
      const result = await anthropic(apiKey, SUMMARY_SYSTEM, userContent, 1200);
      return res.status(200).json({ ok: true, result });
    }

    if (task === "draft_letter") {
      const userContent = [{ type: "text", text: letterContext(body.context) }];
      const result = await anthropic(apiKey, LETTER_SYSTEM, userContent, 1800);
      return res.status(200).json({ ok: true, result });
    }

    return res.status(400).json({ ok: false, error: "Unknown task." });
  } catch (e) {
    return res.status(500).json({ ok: false, error: (e && e.message) || String(e) });
  }
}
