// partnerDocs.js — Closing Desk document generation (Phase 3.2b)
// Merges a firm template (editor or uploaded .docx) with matter data and
// exports Word + PDF. All client-side.

import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import mammoth from "mammoth/mammoth.browser.js";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

// Available merge fields. Also drives the authoring palette in the workspace.
export const DOC_TOKENS = [
  "firm_name", "buyer", "seller", "lender",
  "property_address", "town", "state",
  "file_number", "lakeland_file_number", "transaction_type",
  "contract_date", "closing_date", "title_company", "today"
];

// Friendly labels for the fill-in step.
export const TOKEN_LABELS = {
  firm_name: "Firm name",
  buyer: "Buyer / borrower",
  seller: "Seller",
  lender: "Lender",
  property_address: "Property address",
  town: "Town",
  state: "State",
  file_number: "File number",
  lakeland_file_number: "Lakeland file number",
  transaction_type: "Transaction type",
  contract_date: "Contract date",
  closing_date: "Closing date",
  title_company: "Title company",
  today: "Today's date"
};

function fmtDate(v) {
  if (!v) return "";
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return "";
    const mm = String(v.getMonth() + 1).padStart(2, "0");
    const dd = String(v.getDate()).padStart(2, "0");
    return `${mm}/${dd}/${v.getFullYear()}`;
  }
  const s = String(v);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); // ISO date — avoid timezone shift
  if (m) return `${m[2]}/${m[3]}/${m[1]}`;
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
}

// Assemble default merge values from a matter + firm.
export function buildMergeData(matter, firm) {
  const m = matter || {}, f = firm || {};
  return {
    firm_name: f.name || "",
    buyer: m.buyer_name || "",
    seller: m.seller_name || "",
    lender: m.lender_name || "",
    property_address: m.property_address || "",
    town: m.town || "",
    state: m.state || "",
    file_number: m.file_number || "",
    lakeland_file_number: m.lakeland_file_number || "",
    transaction_type: m.transaction_type || "",
    contract_date: fmtDate(m.contract_date),
    closing_date: fmtDate(m.closing_date),
    title_company: m.title_provider === "lakeland" ? "Lakeland Abstract" : (m.title_company_name || ""),
    today: fmtDate(new Date())
  };
}

// Replace {{token}} in plain text. Unknown tokens -> "".
function fillText(body, data) {
  return String(body || "").replace(/\{\{\s*([\w]+)\s*\}\}/g, (_, k) => (data[k] != null ? String(data[k]) : ""));
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Editor body -> simple HTML (paragraphs on blank lines, <br> on single newlines).
function textToHtml(text) {
  const blocks = String(text || "").split(/\n{2,}/);
  return blocks.map((b) => `<p style="margin:0 0 11pt;line-height:1.5;">${escapeHtml(b).replace(/\n/g, "<br/>")}</p>`).join("");
}

function safeBase(base) {
  const s = String(base || "document").replace(/[^\w.\-]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  return s || "document";
}

// ---- Word output ----
// Editor templates: a Word-openable file built from HTML (MSO wrapper). We control the
// content, so this opens cleanly in Word and Google Docs without the heavy docx library.
function editorToDocBlob(filledText) {
  const html =
    `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" ` +
    `xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">` +
    `<head><meta charset="utf-8"><title>Document</title></head>` +
    `<body style="font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#000;">` +
    `${textToHtml(filledText)}</body></html>`;
  return new Blob(["\ufeff", html], { type: "application/msword" });
}

// Uploaded templates: real .docx merge via docxtemplater using {{ }} delimiters.
function docxMerge(arrayBuffer, data) {
  const zip = new PizZip(arrayBuffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "{{", end: "}}" },
    nullGetter: () => ""
  });
  doc.render(data);
  return doc.getZip().generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  });
}

// ---- PDF output ----
// Editor templates: clean, selectable text PDF via jsPDF.
function editorToPdfBlob(filledText) {
  const pdf = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 72;
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const maxW = pageW - margin * 2, lineH = 16;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  let y = margin;
  const paras = String(filledText || "").split(/\n/);
  for (const para of paras) {
    if (para.trim() === "") {
      y += lineH;
      if (y > pageH - margin) { pdf.addPage(); y = margin; }
      continue;
    }
    const lines = pdf.splitTextToSize(para, maxW);
    for (const ln of lines) {
      if (y > pageH - margin) { pdf.addPage(); y = margin; }
      pdf.text(ln, margin, y);
      y += lineH;
    }
  }
  return pdf.output("blob");
}

// Uploaded templates: render merged content to HTML (mammoth) then rasterize to PDF.
// Good-enough fidelity — preserves structure/most formatting, not pixel-perfect.
async function docxToPdfBlob(mergedDocxBlob) {
  const ab = await mergedDocxBlob.arrayBuffer();
  const res = await mammoth.convertToHtml({ arrayBuffer: ab });
  const holder = document.createElement("div");
  holder.style.cssText =
    "position:fixed;left:-99999px;top:0;width:816px;padding:72px;box-sizing:border-box;" +
    "background:#fff;font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#000;line-height:1.5;";
  holder.innerHTML = (res && res.value) || "<p></p>";
  document.body.appendChild(holder);
  try {
    const canvas = await html2canvas(holder, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
    const pdf = new jsPDF({ unit: "pt", format: "letter" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;
    const img = canvas.toDataURL("image/jpeg", 0.92);
    let heightLeft = imgH, position = 0;
    pdf.addImage(img, "JPEG", 0, position, imgW, imgH);
    heightLeft -= pageH;
    while (heightLeft > 0) {
      position -= pageH;
      pdf.addPage();
      pdf.addImage(img, "JPEG", 0, position, imgW, imgH);
      heightLeft -= pageH;
    }
    return pdf.output("blob");
  } finally {
    document.body.removeChild(holder);
  }
}

// ---- Public API ----
// generate({ template, data, baseName, wantDocx, wantPdf, fetchDocxBuffer })
// -> { files: [{ blob, name, type }] }
export async function generateDocs(opts) {
  const { template, data, baseName, wantDocx = true, wantPdf = true, fetchDocxBuffer } = opts || {};
  if (!template) throw new Error("No template selected.");
  const base = safeBase(baseName || template.name || "document");
  const files = [];

  if (template.source_type === "docx") {
    if (!template.storage_path) throw new Error("This template has no file attached.");
    if (!fetchDocxBuffer) throw new Error("Missing template loader.");
    const ab = await fetchDocxBuffer(template.storage_path);
    const merged = docxMerge(ab, data);
    if (wantDocx) files.push({ blob: merged, name: `${base}.docx`, type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    if (wantPdf) files.push({ blob: await docxToPdfBlob(merged), name: `${base}.pdf`, type: "application/pdf" });
  } else {
    const filled = fillText(template.body, data);
    if (wantDocx) { const b = editorToDocBlob(filled); files.push({ blob: b, name: `${base}.doc`, type: "application/msword" }); }
    if (wantPdf) { const b = editorToPdfBlob(filled); files.push({ blob: b, name: `${base}.pdf`, type: "application/pdf" }); }
  }
  return { files };
}

// Trigger a browser download of a blob.
export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
