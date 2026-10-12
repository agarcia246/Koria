import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type InvoicePdfInput = {
  number: string;
  dueDate: string;
  currency: string;
  lineItems: { description: string; amount: number }[];
  amountDue: number;
  bankDetails: Record<string, unknown>;
};

function money(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(amount);
}

function plain(text: string): string {
  return text.replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim();
}

function bankLines(details: Record<string, unknown>): string[] {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(details)) {
    if (value == null) continue;
    const text = typeof value === "string" ? value : JSON.stringify(value);
    const label = key.replaceAll("_", " ");
    lines.push(`${label}: ${text}`);
  }
  return lines;
}

/** Pure-JS PDF. No headless browser. The email attaches these bytes. */
export async function renderInvoicePdf(input: InvoicePdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const ink = rgb(0.1, 0.1, 0.1);
  let y = 740;

  const draw = (text: string, size = 12, face = font) => {
    const line = plain(text).slice(0, 90);
    if (!line) return;
    page.drawText(line, { x: 56, y, size, font: face, color: ink });
    y -= size + 8;
  };

  draw("KORIA", 18, bold);
  draw("Wire invoice", 14, bold);
  y -= 8;
  draw(`Invoice ${input.number}`);
  draw(`Due ${input.dueDate}`);
  draw(`Currency ${input.currency}`);
  y -= 8;
  draw("Charges", 13, bold);
  for (const item of input.lineItems) {
    draw(`${item.description}    ${money(item.amount, input.currency)}`);
  }
  y -= 4;
  draw(`Amount due    ${money(input.amountDue, input.currency)}`, 13, bold);
  y -= 8;
  draw("Pay by wire", 13, bold);
  for (const line of bankLines(input.bankDetails)) {
    draw(line, 11);
  }
  y -= 8;
  draw("Use the invoice number as the wire reference.", 11);

  return doc.save();
}
