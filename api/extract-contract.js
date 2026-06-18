// api/extract-contract.js — Closing Desk (Phase 5.1)
// Reads a purchase/sale/refi contract (PDF base64) OR pasted order text and returns
// the fields used to pre-fill a new matter. Extraction only — never writes to the DB.
//
// Request (POST JSON), exactly one of:
//   { "pdf": "<base64>", "filename": "contract.pdf" }
//   { "text": "<pasted order text>" }
// Response: { ok:true, data:{...} } | { ok:false, error:"..." }
//
// REQUIRED ENV VAR: ANTHROPIC_API_KEY = sk-ant-...  (Production + Preview, then redeploy)

export const config = { maxDuration: 60 };

const MODEL = "claude-sonnet-4-6";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MAX_PDF_B64 = 4_300_000; // ~3 MB file; Vercel body limit is ~4.5 MB

const SCHEMA = `{
  "buyer": "",
  "seller": "",
  "lender": "",
  "property_address": "",
  "town": "",
  "state": "",
  "transaction_type": "",
  "contract_date": "",
  "closing_date": ""
}`;

const SYSTEM_PROMPT = `You are reading an incoming real-estate closing order. The source is EITHER a purchase/sale/refinance contract OR a short order email/intake note. Extract the fields below and return ONLY a JSON object matching the schema — no prose, no markdown, no code fences.

GENERAL RULES
- Extract only what is actually present. If a field is not stated, leave it "". NEVER invent, infer, or guess a name, place, or date.
- Capture names exactly as written (do not normalize case). For a party with multiple people, join with " and " (e.g. "John Smith and Mary Smith").
- A name field is the PERSON or COMPANY, not a label. Strip role words ("Esq.", "Buyer:", "Lender:") so only the actual name/firm remains.

FIELD DEFINITIONS
- "buyer": the buyer / purchaser. On a REFINANCE there is no buyer/seller — put the borrower / current owner here and leave "seller" "".
- "seller": the seller. Leave "" on a refinance.
- "lender": the mortgage lender / bank / mortgagee, if named. Leave "" if none.
- "property_address": the subject property STREET line only (include unit if given). Do not put town/state/zip here.
- "town": the municipality / city of the property, if stated.
- "state": the 2-letter US state abbreviation of the property (e.g. "NJ"), if stated.
- "transaction_type": choose exactly one of "Purchase", "Sale", "Refinance", "Commercial", "Other" based on the order. Use "Commercial" only if it is clearly a commercial property/transaction.
- "contract_date": the date the contract was signed/dated, if stated. Format YYYY-MM-DD. If not clearly stated, "".
- "closing_date": the scheduled closing / settlement date, if stated. Format YYYY-MM-DD. If only "on or about" with a specific date, use it; otherwise "".

Output a SINGLE JSON object matching:
${SCHEMA}`;

function safeParseJson(text) {
  if (!text) return null;
  let t = String(text).trim();
  t = t.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first >= 0 && last > first) t = t.slice(first, last + 1);
  try { return JSON.parse(t); } catch (e) { return null; }
}

async function anthropic(apiKey, userContent) {
  const r = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: 1500, system: SYSTEM_PROMPT, messages: [{ role: "user", content: userContent }] })
  });
  const data = await r.json();
  if (!r.ok) {
    const msg = (data && data.error && data.error.message) || JSON.stringify(data).slice(0, 300);
    throw new Error(`Claude API error: ${msg}`);
  }
  return (data.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n").trim();
}

const VALID_TX = ["Purchase", "Sale", "Refinance", "Commercial", "Other"];
function normalize(parsed) {
  const keys = ["buyer", "seller", "lender", "property_address", "town", "state", "transaction_type", "contract_date", "closing_date"];
  const out = {};
  for (const k of keys) {
    const v = parsed && parsed[k];
    out[k] = (v === undefined || v === null) ? "" : String(v).trim();
  }
  if (out.state) out.state = out.state.toUpperCase().slice(0, 2);
  if (out.transaction_type && !VALID_TX.includes(out.transaction_type)) out.transaction_type = "";
  // keep only well-formed ISO dates
  for (const k of ["contract_date", "closing_date"]) {
    if (out[k] && !/^\d{4}-\d{2}-\d{2}$/.test(out[k])) out[k] = "";
  }
  return out;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ ok: false, error: "ANTHROPIC_API_KEY is not set in Vercel for this project." });

  try {
    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    body = body || {};

    const pdf = typeof body.pdf === "string" ? body.pdf.trim() : "";
    const text = typeof body.text === "string" ? body.text.trim() : "";

    let userContent;
    if (pdf) {
      if (pdf.length > MAX_PDF_B64) {
        return res.status(413).json({ ok: false, error: "That PDF is too large to send directly (over ~3 MB). For a big or scanned contract, paste the order text instead." });
      }
      userContent = [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf } },
        { type: "text", text: "Extract the matter fields from this contract and return ONLY the JSON object." }
      ];
    } else if (text) {
      userContent = [
        { type: "text", text: `Extract the matter fields from this order text and return ONLY the JSON object.\n\n--- ORDER TEXT ---\n${text}` }
      ];
    } else {
      return res.status(400).json({ ok: false, error: "Send either a PDF (base64) or pasted order text." });
    }

    const raw = await anthropic(apiKey, userContent);
    const parsed = safeParseJson(raw);
    if (!parsed) return res.status(502).json({ ok: false, error: "Couldn't read a clean result — try pasting the text instead, or enter the fields manually." });

    return res.status(200).json({ ok: true, data: normalize(parsed) });
  } catch (e) {
    return res.status(500).json({ ok: false, error: (e && e.message) || String(e) });
  }
}
