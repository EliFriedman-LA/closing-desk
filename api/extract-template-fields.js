// =============================================================================
// Vercel Serverless Function — Closing Desk template field detector (AI)
// Repo location: api/extract-template-fields.js  (Closing Desk project)
// =============================================================================
// Takes the plain text of a firm's Word document (a letter / form) plus the list
// of available merge tokens, and returns the SAME text with {{token}} placeholders
// inserted where a real value would go (names, addresses, dates, file numbers).
// The result becomes an editable "editor" doc template the firm can fine-tune.
//
// REQUIRED ENV VAR: ANTHROPIC_API_KEY = sk-ant-...  (then redeploy)
// INPUT : POST { text, tokens: ["firm_name","buyer",...] }
// OUTPUT: { ok, data: { body } }
// =============================================================================

export const config = { maxDuration: 60 };

const MODEL = "claude-sonnet-4-6";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

function systemPrompt(tokens) {
  return `You convert a law/title firm's existing document into a reusable MERGE TEMPLATE.

You are given the plain text of a document and a fixed list of ALLOWED merge tokens. Return the SAME text, word for word, EXCEPT: wherever a piece of text is clearly a value that should be filled per-matter, replace it with the matching token written as {{token}}.

ALLOWED TOKENS (use ONLY these, exactly as written):
${tokens.map((t) => "{{" + t + "}}").join("  ")}

MAPPING GUIDE
- firm's own name / signature block -> {{firm_name}}
- buyer / borrower name -> {{buyer}} ; seller name -> {{seller}} ; lender / bank -> {{lender}}
- street / property address -> {{property_address}} ; town or city -> {{town}} ; state -> {{state}}
- the firm's internal file/matter number -> {{file_number}} ; a Lakeland file number -> {{lakeland_file_number}}
- purchase / refinance / sale wording naming the deal type -> {{transaction_type}}
- contract date -> {{contract_date}} ; closing / settlement date -> {{closing_date}}
- title company / underwriter -> {{title_company}} ; the letter's own date -> {{today}}

RULES
- Keep ALL other wording, punctuation, and line breaks EXACTLY as in the source.
- Only replace a span when you are confident it is a fill-in value. When unsure, leave the original text.
- Do NOT invent tokens outside the allowed list. Do NOT add commentary.
- If a value already looks like a blank line, underscores, or "____", replace that blank with the best-fitting token.

OUTPUT: a SINGLE JSON object, no markdown, no code fences:
{ "body": "the full templated text with {{tokens}} inserted" }`;
}

function safeParseJson(text) {
  if (!text) return null;
  let t = String(text).trim();
  t = t.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first >= 0 && last > first) t = t.slice(first, last + 1);
  try { return JSON.parse(t); } catch { return null; }
}

async function anthropic(apiKey, payload) {
  const r = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify(payload)
  });
  const data = await r.json();
  if (!r.ok) {
    const msg = (data && data.error && data.error.message) || JSON.stringify(data).slice(0, 300);
    throw new Error(`Claude API error: ${msg}`);
  }
  return (data.content || []).filter(c => c.type === "text").map(c => c.text).join("\n").trim();
}

const DEFAULT_TOKENS = [
  "firm_name", "buyer", "seller", "lender", "property_address", "town", "state",
  "file_number", "lakeland_file_number", "transaction_type",
  "contract_date", "closing_date", "title_company", "today"
];

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ ok: false, error: "ANTHROPIC_API_KEY is not set. Add it in Vercel -> Settings -> Environment Variables, then redeploy." });

  try {
    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
    const text = body && body.text;
    if (!text || !String(text).trim()) return res.status(400).json({ ok: false, error: "No document text to convert." });
    if (String(text).length > 60000) return res.status(400).json({ ok: false, error: "That document is very long — try a shorter form or split it." });
    const tokens = Array.isArray(body.tokens) && body.tokens.length ? body.tokens.map(String) : DEFAULT_TOKENS;

    const out = await anthropic(apiKey, {
      model: MODEL, max_tokens: 8000, system: systemPrompt(tokens),
      messages: [{ role: "user", content: `Document text:\n\n${text}\n\nReturn ONLY the JSON object with the templated body.` }]
    });

    const data = safeParseJson(out);
    if (!data || typeof data.body !== "string") return res.status(502).json({ ok: false, error: "The conversion came back unreadable. Try again." });
    return res.status(200).json({ ok: true, data: { body: data.body } });
  } catch (e) {
    return res.status(500).json({ ok: false, error: (e && e.message) || String(e) });
  }
}
