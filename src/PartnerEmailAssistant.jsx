import React, { useEffect, useState } from "react";
import PizZip from "pizzip";
import { getEmailAssistantProfile, saveEmailAssistantProfile } from "./partnerDb.js";

const NV = "#1e3a5f", BL = "#1B91FE", MUTED = "#64748b", LINE = "#e6eaf0";

const ROLES = ["Attorney", "Paralegal", "Closer / Processor", "Other"];
const FOCUS = ["Residential purchases", "Refinances", "Commercial", "Short sales", "Cash deals", "Construction"];
const VOLUME = ["Under 50 / day", "50–150 / day", "150–300 / day", "300+ / day"];
const URGENTS = ["Updated / changed wire instructions", "Payoff letters", "Clear-to-close (CTC)", "Title defects or liens", "Opposing-counsel deadlines", "Court / filing deadlines", "Earnest-money issues", "Lender conditions", "CPL / survey requests", "Judgment & lien search results"];
const DOWNPLAY = ["Newsletters", "CLE / marketing", "Vendor pitches", "Mass cc / FYI", "Internal updates", "Automated notifications"];
const WINDOW = ["Within 48 hours", "This week", "Next 2 weeks"];
const FORMAT = ["Prioritized list", "Grouped by category", "Short digest"];
const LENGTH = ["One-liners", "Short summaries"];
const TONE = ["Brief & neutral", "Plain-English", "Formal"];
const USAGE = ["Morning review", "On-demand through the day", "Both"];

const DEFAULTS = {
  role: "Attorney", focus: [], states: "", volume: "50–150 / day",
  urgents: ["Updated / changed wire instructions", "Payoff letters", "Clear-to-close (CTC)"], urgentsOther: "",
  vips: "", deprioritize: "", downplay: ["Newsletters", "CLE / marketing", "Vendor pitches"],
  wireFraud: true, redFlagsOther: "",
  extractDates: true, urgentWindow: "This week",
  format: "Prioritized list", length: "Short summaries", needsTodayTop: true, draftReplies: false, tone: "Brief & neutral",
  usage: "Both", fileFormat: "", houseRules: ""
};

function lc(arr) { return arr.map((x) => x.toLowerCase()).join(", "); }
function bullets(text) { return text.split(/\n+/).map((s) => s.trim()).filter(Boolean).map((s) => "- " + s).join("\n"); }

function buildPrompt(a) {
  const L = [];
  L.push(`You are my email assistant inside Outlook. I am ${a.role === "Attorney" ? "an attorney" : "a " + a.role.toLowerCase()} at a real-estate title and closing practice${a.focus.length ? `, focused on ${lc(a.focus)}` : ""}${a.states.trim() ? `, closing in ${a.states.trim()}` : ""}.`);
  L.push("");
  L.push("When I ask you to triage my inbox, read my unread mail and sort it by what needs me, following these rules:");
  L.push("");
  const urg = [...a.urgents]; if (a.urgentsOther.trim()) urg.push(a.urgentsOther.trim());
  if (urg.length) L.push(`ALWAYS treat as top priority and surface first: ${urg.join("; ")}.`);
  if (a.wireFraud) L.push(`Watch for wire fraud: flag any email that sets, changes, or "updates" wiring or payment instructions — especially from look-alike domains, free email accounts, or senders who don't match the party on file. Call these out loudly and tell me to verify by phone before acting.`);
  if (a.redFlagsOther.trim()) L.push(`Also flag: ${a.redFlagsOther.trim()}.`);
  if (a.vips.trim()) L.push(`These senders always matter — never bury their email:\n${bullets(a.vips)}`);
  if (a.deprioritize.trim()) L.push(`You can deprioritize email from:\n${bullets(a.deprioritize)}`);
  if (a.downplay.length) L.push(`Treat as low-priority noise (group at the bottom, don't make me read each one): ${lc(a.downplay)}.`);
  if (a.extractDates) L.push(`Pull out any dates and deadlines mentioned, and flag anything due ${a.urgentWindow.toLowerCase()} as time-sensitive.`);
  if (a.fileFormat.trim()) L.push(`When an email references one of my existing files (my file numbers look like: ${a.fileFormat.trim()}), note which file it belongs to and group related emails together.`);
  L.push("");
  let d = `Present the result as a ${a.format.toLowerCase()} using ${a.length.toLowerCase()}`;
  if (a.needsTodayTop) d += `, with a "Needs you today" section at the very top`;
  d += `. Keep the tone ${a.tone.toLowerCase()}.`;
  L.push(d);
  if (a.draftReplies) L.push(`For routine messages you can handle (acknowledgements, scheduling, simple confirmations), draft a reply into Outlook's compose pane in my voice — but never send; leave every draft for me to review and send.`);
  if (a.houseRules.trim()) { L.push(""); L.push(`Additional house rules:\n${a.houseRules.trim()}`); }
  L.push("");
  L.push("Never send email, archive, move, or take any irreversible action without my explicit go-ahead.");
  return L.join("\n");
}

function buildSkillBlob(promptText) {
  const md = "---\n"
    + "name: inbox-triage\n"
    + "description: Triage and prioritize the user's Outlook inbox. Use whenever the user asks to triage, sort, prioritize, clean up, or review their email or inbox, or asks what needs their attention.\n"
    + "---\n\n"
    + "# Inbox triage\n\n"
    + "When the user asks you to triage, sort, or review their inbox, follow the instructions below exactly.\n\n"
    + promptText + "\n";
  const zip = new PizZip();
  zip.file("inbox-triage/SKILL.md", md);
  return zip.generate({ type: "blob" });
}
function triggerDownload(blob, filename) {
  try {
    const url = URL.createObjectURL(blob);
    const el = document.createElement("a");
    el.href = url; el.download = filename;
    document.body.appendChild(el); el.click(); document.body.removeChild(el);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (e) { alert("Download failed: " + (e.message || e)); }
}

const card = { background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: "18px 20px", marginBottom: 16 };
const h = { fontSize: 14.5, fontWeight: 700, color: NV, marginBottom: 3 };
const sub = { fontSize: 12.5, color: MUTED, marginBottom: 12 };
const lbl = { fontSize: 12.5, fontWeight: 600, color: "#334155", margin: "12px 0 6px" };
const inp = { width: "100%", padding: "9px 11px", border: `1px solid ${LINE}`, borderRadius: 9, fontSize: 13.5, background: "#f8fafc", boxSizing: "border-box", fontFamily: "inherit" };

function Pill({ on, onClick, children }) {
  return <button type="button" onClick={onClick} style={{ padding: "7px 13px", borderRadius: 20, fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: `1px solid ${on ? BL : LINE}`, background: on ? "#eff6ff" : "#fff", color: on ? BL : "#475569" }}>{children}</button>;
}
function Chips({ options, value, onToggle }) {
  return <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>{options.map((o) => <Pill key={o} on={value.includes(o)} onClick={() => onToggle(o)}>{value.includes(o) ? "✓ " : ""}{o}</Pill>)}</div>;
}
function Seg({ options, value, onPick }) {
  return <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>{options.map((o) => <Pill key={o} on={value === o} onClick={() => onPick(o)}>{o}</Pill>)}</div>;
}
function YesNo({ value, onChange }) {
  return <div style={{ display: "flex", gap: 7 }}><Pill on={value} onClick={() => onChange(true)}>Yes</Pill><Pill on={!value} onClick={() => onChange(false)}>No</Pill></div>;
}

export default function EmailAssistant({ firmId }) {
  const [a, setA] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState("form");
  const [prompt, setPrompt] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      try { const p = await getEmailAssistantProfile(); if (p && p.answers && Object.keys(p.answers).length) setA({ ...DEFAULTS, ...p.answers }); }
      catch (e) { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  const set = (k, v) => setA((p) => ({ ...p, [k]: v }));
  const toggle = (k, val) => setA((p) => { const s = new Set(p[k]); s.has(val) ? s.delete(val) : s.add(val); return { ...p, [k]: [...s] }; });

  const generate = async () => {
    const text = buildPrompt(a);
    setPrompt(text); setStep("result"); setSaving(true);
    try { await saveEmailAssistantProfile(firmId, a, text); } catch (e) { /* save best-effort */ }
    setSaving(false);
    try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch (e) { /* ignore */ }
  };
  const copy = () => { try { navigator.clipboard.writeText(prompt); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch (e) { /* ignore */ } };
  const downloadSkill = () => { try { triggerDownload(buildSkillBlob(prompt), "inbox-triage-skill.zip"); } catch (e) { alert("Could not build skill: " + (e.message || e)); } };

  if (loading) return <div style={{ color: "#9ca3af", fontSize: 13 }}>Loading…</div>;

  if (step === "result") {
    return (
      <div style={{ maxWidth: 760 }}>
        <div style={{ fontFamily: "Fraunces,serif", fontWeight: 600, fontSize: 26, lineHeight: 1.1 }}>Your email assistant is ready</div>
        <div style={{ color: MUTED, fontSize: 13.5, margin: "4px 0 16px" }}>Set this up once in Claude inside Outlook. Recommended way is below, no daily copy-paste.</div>

        <div style={{ ...card, padding: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 16px", borderBottom: `1px solid ${LINE}`, gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: NV }}>Your triage instructions</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={downloadSkill} style={{ padding: "7px 15px", background: BL, color: "#fff", border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>↓ Download skill</button>
              <button onClick={copy} style={{ padding: "7px 15px", background: "#fff", color: NV, border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>{copied ? "Copied ✓" : "Copy prompt"}</button>
            </div>
          </div>
          <pre style={{ margin: 0, padding: "14px 16px", fontSize: 12.5, lineHeight: 1.6, color: "#1f2937", whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "ui-monospace, Menlo, monospace", background: "#fbfdff", maxHeight: 320, overflowY: "auto" }}>{prompt}</pre>
        </div>

        <div style={card}>
          <div style={h}>First, add Claude to Outlook — one time</div>
          <ol style={{ margin: "8px 0 0", paddingLeft: 20, fontSize: 13.5, lineHeight: 1.7, color: "#334155" }}>
            <li>Sign in to a paid Claude plan (Pro or higher) using your work Microsoft 365 account.</li>
            <li>Install the add-in: in <a href="https://marketplace.microsoft.com/en-us/product/office/wa200010724" target="_blank" rel="noreferrer" style={{ color: BL }}>Microsoft AppSource</a> search <b>"Claude by Anthropic for Outlook"</b> and add it. If your firm controls add-ins centrally, your IT admin approves it once.</li>
            <li>In Outlook, open any email, click the <b>Claude</b> button in the ribbon, and sign in. Pin the panel so it stays open.</li>
          </ol>
        </div>

        <div style={{ ...card, border: `1.5px solid ${BL}`, background: "#f5faff" }}>
          <div style={{ ...h, color: BL }}>Recommended: make it automatic (no daily pasting)</div>
          <div style={sub}>Upload your instructions once as a skill. After that Claude uses it on its own — you just ask it to triage.</div>
          <ol style={{ margin: "4px 0 0", paddingLeft: 20, fontSize: 13.5, lineHeight: 1.7, color: "#334155" }}>
            <li>Click <b>↓ Download skill</b> above to save the file.</li>
            <li>In Claude, go to <b>Customize → Skills</b>, click <b>+ Create skill</b>, and upload that file.</li>
            <li>Make sure the new <b>inbox-triage</b> skill is toggled on.</li>
            <li>In Outlook, open the Claude panel and type <b>"triage my inbox."</b> Claude applies your skill automatically — every session, nothing to paste.</li>
          </ol>
        </div>

        <div style={card}>
          <div style={h}>Or, the quick way (no upload)</div>
          <ol style={{ margin: "8px 0 0", paddingLeft: 20, fontSize: 13.5, lineHeight: 1.7, color: "#334155" }}>
            <li>Open the Claude panel in Outlook.</li>
            <li><b>Copy prompt</b> above and paste it as your first message.</li>
            <li>Type <b>"triage my inbox."</b></li>
          </ol>
          <div style={{ fontSize: 12.5, color: MUTED, marginTop: 10, lineHeight: 1.6 }}>The panel starts fresh each session, so this way you re-paste each time. Your answers are saved here — come back anytime to adjust and regenerate.</div>
        </div>

        <button onClick={() => setStep("form")} style={{ padding: "9px 16px", background: "#fff", color: NV, border: `1px solid ${LINE}`, borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>← Edit my answers</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ fontFamily: "Fraunces,serif", fontWeight: 600, fontSize: 26, lineHeight: 1.1 }}>Email assistant</div>
      <div style={{ color: MUTED, fontSize: 13.5, margin: "4px 0 18px" }}>Answer these once. We turn it into a tuned prompt you drop into Claude inside Outlook, so your inbox gets sorted your way.</div>

      <div style={card}>
        <div style={h}>1. You & your practice</div>
        <div style={lbl}>Your role</div>
        <Seg options={ROLES} value={a.role} onPick={(v) => set("role", v)} />
        <div style={lbl}>What you handle</div>
        <Chips options={FOCUS} value={a.focus} onToggle={(v) => toggle("focus", v)} />
        <div style={lbl}>States you close in</div>
        <input style={inp} value={a.states} onChange={(e) => set("states", e.target.value)} placeholder="NJ, NY, PA…" />
        <div style={lbl}>Roughly how much email per day</div>
        <Seg options={VOLUME} value={a.volume} onPick={(v) => set("volume", v)} />
      </div>

      <div style={card}>
        <div style={h}>2. What you never want to miss</div>
        <div style={sub}>These get surfaced first, every time.</div>
        <Chips options={URGENTS} value={a.urgents} onToggle={(v) => toggle("urgents", v)} />
        <div style={lbl}>Anything else that's always urgent</div>
        <input style={inp} value={a.urgentsOther} onChange={(e) => set("urgentsOther", e.target.value)} placeholder="e.g. anything from Judge Saunders' chambers" />
      </div>

      <div style={card}>
        <div style={h}>3. Key people</div>
        <div style={lbl}>Senders whose email always matters (one per line — names or email domains)</div>
        <textarea style={{ ...inp, minHeight: 76, resize: "vertical" }} value={a.vips} onChange={(e) => set("vips", e.target.value)} placeholder={"First National Bank\njane@acostarealty.com\nyour top referral attorneys"} />
        <div style={lbl}>Anyone you can safely deprioritize</div>
        <textarea style={{ ...inp, minHeight: 60, resize: "vertical" }} value={a.deprioritize} onChange={(e) => set("deprioritize", e.target.value)} placeholder="optional" />
      </div>

      <div style={card}>
        <div style={h}>4. What to push to the bottom</div>
        <Chips options={DOWNPLAY} value={a.downplay} onToggle={(v) => toggle("downplay", v)} />
      </div>

      <div style={card}>
        <div style={h}>5. Red flags</div>
        <div style={lbl}>Flag possible wire fraud (changed wiring instructions, look-alike senders)</div>
        <YesNo value={a.wireFraud} onChange={(v) => set("wireFraud", v)} />
        <div style={lbl}>Other risk cues to call out</div>
        <input style={inp} value={a.redFlagsOther} onChange={(e) => set("redFlagsOther", e.target.value)} placeholder="e.g. rush closings, angry clients, threats to walk" />
      </div>

      <div style={card}>
        <div style={h}>6. Dates & deadlines</div>
        <div style={lbl}>Pull out dates and flag time-sensitive ones</div>
        <YesNo value={a.extractDates} onChange={(v) => set("extractDates", v)} />
        <div style={lbl}>What counts as urgent</div>
        <Seg options={WINDOW} value={a.urgentWindow} onPick={(v) => set("urgentWindow", v)} />
      </div>

      <div style={card}>
        <div style={h}>7. How you want it delivered</div>
        <div style={lbl}>Format</div>
        <Seg options={FORMAT} value={a.format} onPick={(v) => set("format", v)} />
        <div style={lbl}>Detail</div>
        <Seg options={LENGTH} value={a.length} onPick={(v) => set("length", v)} />
        <div style={lbl}>Put a "Needs you today" section at the top</div>
        <YesNo value={a.needsTodayTop} onChange={(v) => set("needsTodayTop", v)} />
        <div style={lbl}>Draft replies for routine messages (left unsent for you)</div>
        <YesNo value={a.draftReplies} onChange={(v) => set("draftReplies", v)} />
        <div style={lbl}>Tone</div>
        <Seg options={TONE} value={a.tone} onPick={(v) => set("tone", v)} />
      </div>

      <div style={card}>
        <div style={h}>8. How you'll use it</div>
        <Seg options={USAGE} value={a.usage} onPick={(v) => set("usage", v)} />
      </div>

      <div style={card}>
        <div style={h}>9. Recognizing your files</div>
        <div style={lbl}>What your file / matter numbers look like</div>
        <input style={inp} value={a.fileFormat} onChange={(e) => set("fileFormat", e.target.value)} placeholder="e.g. LA-2026-1234, or a 6-digit number" />
        <div style={lbl}>House rules — anything else Claude should know</div>
        <textarea style={{ ...inp, minHeight: 72, resize: "vertical" }} value={a.houseRules} onChange={(e) => set("houseRules", e.target.value)} placeholder="Free text — e.g. 'flag anything mentioning a 1031 exchange', 'I cover for Dana on Fridays'" />
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", margin: "4px 0 30px" }}>
        <button onClick={generate} style={{ padding: "11px 22px", background: BL, color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>✶ Generate my prompt</button>
        {saving && <span style={{ fontSize: 12.5, color: MUTED }}>Saving…</span>}
      </div>
    </div>
  );
}
