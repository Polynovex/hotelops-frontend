import { api } from '../services/api';
import { desktopBridge } from '../services/desktopBridge';
import type { PosOrderRow } from '../services/posFlow';

/**
 * Receipts, one layout for all of them: POS, room folio, event and plain
 * payments. The server builds the receipt (receipt.service), so the web, the
 * desktop app, the mobile app and the emailed copy all show the same content;
 * only the paper differs, 58mm or 80mm thermal rolls set per business.
 *
 * In the desktop app it goes straight to the till printer; in a browser it
 * opens the print dialog sized for the roll (or "Save as PDF").
 */

export type ReceiptLine = { description: string; detail?: string | null; quantity: number; unitPrice: number; amount: number };

export type Receipt = {
  kind: 'POS' | 'FOLIO' | 'EVENT' | 'PAYMENT' | 'SUBSCRIPTION';
  receiptNumber: string;
  issuedAt: string;
  issuer: { name: string; logoUrl: string | null; address: string | null; phone: string | null; email: string | null; website: string | null };
  title: string;
  reference: string | null;
  context: Array<[string, string]>;
  customer: string | null;
  lines: ReceiptLine[];
  subtotal: number;
  discount: number;
  serviceCharge: number;
  tax: number;
  total: number;
  paid: number;
  totalPaid: number;
  balance: number;
  method: string;
  paymentReference: string | null;
  cashier: string | null;
  thankYou: string;
  poweredBy: boolean;
};

export type ReceiptBusiness = { name: string; address?: string | null; phone?: string | null; email?: string | null; website?: string | null; logoUrl?: string | null; receiptWidth?: 58 | 80 } | null;

const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
const money = (n: number) => (Number(n) || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** The receipt as a self-contained page for a 58mm or 80mm roll. */
export const renderReceiptHtml = (receipt: Receipt, width: 58 | 80 = 80) => {
  const narrow = width === 58;
  const content = width - 6;
  const when = new Date(receipt.issuedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const isBill = receipt.title.toLowerCase() === 'bill';
  const meta: Array<[string, string]> = [
    [isBill ? 'Bill' : 'Receipt no.', receipt.receiptNumber],
    ['Date', when],
    ...(receipt.reference && receipt.reference !== receipt.receiptNumber ? [['Ref', receipt.reference] as [string, string]] : []),
    ...receipt.context,
    ...(receipt.customer ? [['Customer', receipt.customer] as [string, string]] : [])
  ];
  const totals: Array<[string, number, boolean?]> = [
    ['Subtotal', receipt.subtotal],
    ...(receipt.discount ? [['Discount', -receipt.discount] as [string, number]] : []),
    ...(receipt.serviceCharge ? [['Service charge', receipt.serviceCharge] as [string, number]] : []),
    ...(receipt.tax ? [['VAT', receipt.tax] as [string, number]] : []),
    ['TOTAL', receipt.total, true]
  ];
  const paidRows: Array<[string, number, boolean?]> = isBill
    ? []
    : [
        [`Paid (${receipt.method})`, receipt.paid],
        ...(receipt.totalPaid > receipt.paid + 0.005 ? [['Paid to date', receipt.totalPaid] as [string, number]] : []),
        ...(receipt.balance > 0.005 ? [['Balance due', receipt.balance, true] as [string, number, boolean]] : [])
      ];
  const amountRow = ([label, value, strong]: [string, number, boolean?]) =>
    `<tr class="${strong ? 'strong' : ''}"><td class="label" colspan="2">${esc(label)}</td><td class="amt">${value < 0 ? '−' : ''}${money(Math.abs(value))}</td></tr>`;

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(receipt.title)} ${esc(receipt.receiptNumber)}</title>
<style>
  @page { size: ${width}mm auto; margin: 3mm; }
  * { box-sizing: border-box; }
  body { margin: 0; width: ${content}mm; font-family: "Helvetica Neue", Arial, sans-serif; font-size: ${narrow ? 10.5 : 12}px; line-height: 1.35; color: #000; }
  .c { text-align: center; }
  .logo { display: block; margin: 0 auto 4px; max-width: ${narrow ? 36 : 48}mm; max-height: 16mm; object-fit: contain; }
  .name { font-size: ${narrow ? 14 : 16}px; font-weight: 800; }
  .muted { font-size: ${narrow ? 9.5 : 11}px; }
  .rule { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
  .title { font-weight: 800; letter-spacing: .14em; margin: 2px 0; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  td, th { padding: 1px 0; vertical-align: top; }
  .meta td:first-child { width: 38%; }
  .meta td:last-child { text-align: right; word-break: break-word; }
  th { font-size: ${narrow ? 9.5 : 10.5}px; text-align: left; border-bottom: 1px solid #000; padding-bottom: 2px; }
  .qty { width: ${narrow ? 7 : 9}mm; text-align: right; padding-right: 2mm; }
  .amt { width: ${narrow ? 18 : 22}mm; text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  th.amt, th.qty { text-align: right; }
  .desc { word-break: break-word; }
  .sub { font-size: ${narrow ? 9 : 10.5}px; }
  .label { text-align: right; padding-right: 2mm; }
  .strong td { font-weight: 800; font-size: ${narrow ? 12 : 14}px; padding-top: 2px; }
</style></head><body>
  ${receipt.issuer.logoUrl && /^https?:\/\//.test(receipt.issuer.logoUrl) ? `<img class="logo" src="${esc(receipt.issuer.logoUrl)}" alt="">` : ''}
  <div class="c name">${esc(receipt.issuer.name)}</div>
  ${receipt.issuer.address ? `<div class="c muted">${esc(receipt.issuer.address)}</div>` : ''}
  ${receipt.issuer.phone || receipt.issuer.email ? `<div class="c muted">${[receipt.issuer.phone, receipt.issuer.email].filter(Boolean).map(esc).join(' · ')}</div>` : ''}
  <hr class="rule">
  <div class="c title">${esc(receipt.title)}</div>
  <table class="meta">${meta.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table>
  <hr class="rule">
  <table>
    <thead><tr><th class="qty">Qty</th><th>Item</th><th class="amt">₦</th></tr></thead>
    <tbody>${receipt.lines
      .map(
        (line) => `<tr><td class="qty">${esc(line.quantity)}</td><td class="desc">${esc(line.description)}${line.detail ? `<div class="sub">${esc(line.detail)}</div>` : ''}${line.quantity !== 1 ? `<div class="sub">@ ${money(line.unitPrice)}</div>` : ''}</td><td class="amt">${money(line.amount)}</td></tr>`
      )
      .join('')}</tbody>
  </table>
  <hr class="rule">
  <table>${totals.map(amountRow).join('')}</table>
  ${paidRows.length ? `<hr class="rule"><table>${paidRows.map(amountRow).join('')}</table>` : ''}
  ${receipt.paymentReference ? `<div class="muted">Payment ref: ${esc(receipt.paymentReference)}</div>` : ''}
  ${receipt.cashier ? `<div class="muted">Served by: ${esc(receipt.cashier)}</div>` : ''}
  <hr class="rule">
  <div class="c">${esc(receipt.thankYou)}</div>
  ${receipt.issuer.website ? `<div class="c muted">${esc(receipt.issuer.website)}</div>` : ''}
  ${receipt.poweredBy ? '<div class="c muted" style="margin-top:6px">Powered by HotelOpX</div>' : ''}
</body></html>`;
};

/** An unpaid POS order as a bill, in the same layout as a receipt. */
export const billFromOrder = (order: PosOrderRow, business: ReceiptBusiness): Receipt => {
  const discount = Math.max(0, Math.round((order.subtotal + order.serviceCharge + order.tax - order.total) * 100) / 100);
  const roomNumber = order.metadata?.roomNumber;
  return {
    kind: 'POS',
    receiptNumber: order.orderNumber,
    issuedAt: order.createdAt,
    issuer: { name: business?.name ?? 'Bill', logoUrl: business?.logoUrl ?? null, address: business?.address ?? null, phone: business?.phone ?? null, email: business?.email ?? null, website: business?.website ?? null },
    title: 'Bill',
    reference: null,
    context: [
      ['Outlet', order.outlet?.name ?? 'Outlet'],
      ...(order.tableNumber ? [['Table', order.tableNumber] as [string, string]] : []),
      ...(roomNumber ? [['Room', String(roomNumber)] as [string, string]] : [])
    ],
    customer: order.customerName ?? null,
    lines: order.items.map((item) => ({
      description: item.name,
      detail: [(item.addOns ?? []).map((a) => a.name).join(', '), item.notes ?? ''].filter(Boolean).join(' · ') || null,
      quantity: item.quantity,
      unitPrice: item.quantity ? item.lineTotal / item.quantity : item.lineTotal,
      amount: item.lineTotal
    })),
    subtotal: order.subtotal,
    discount,
    serviceCharge: order.serviceCharge,
    tax: order.tax,
    total: order.total,
    paid: 0,
    totalPaid: 0,
    balance: order.total,
    method: '',
    paymentReference: null,
    cashier: null,
    thankYou: 'Please pay at the counter or ask for the card machine.',
    poweredBy: true
  };
};

/** Prints a page: to the till printer in the desktop app, otherwise via the browser. */
export const printHtml = async (html: string) => {
  if (desktopBridge) {
    const ok = await desktopBridge.printReceipt(html).catch(() => false);
    if (ok) return true;
  }
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) {
    frame.remove();
    return false;
  }
  doc.open();
  doc.write(html);
  doc.close();
  // Wait for the logo, if any, so it is on the paper.
  const images = Array.from(doc.images);
  await Promise.race([
    Promise.all(images.map((img) => (img.complete ? Promise.resolve() : new Promise((resolve) => { img.onload = img.onerror = resolve; })))),
    new Promise((resolve) => setTimeout(resolve, 1500))
  ]);
  win.focus();
  win.print();
  setTimeout(() => frame.remove(), 1000);
  return true;
};

const widthOf = async () => {
  const { usePlanStore } = await import('../store/planStore');
  return (usePlanStore.getState().business as ReceiptBusiness)?.receiptWidth === 58 ? 58 : 80;
};

export const printReceipt = async (receipt: Receipt, width?: 58 | 80) => printHtml(renderReceiptHtml(receipt, width ?? (await widthOf())));

/** Fetches a receipt from the server and prints it. */
export const receiptApi = {
  forTransaction: async (id: string) => (await api.get(`/receipts/${id}`)).data as Receipt,
  forPosOrder: async (orderId: string) => (await api.get(`/receipts/pos-order/${orderId}`)).data as Receipt,
  forEventPayment: async (paymentId: string) => (await api.get(`/receipts/event-payment/${paymentId}`)).data as Receipt,
  forBooking: async (bookingId: string) =>
    (await api.get(`/receipts/booking/${bookingId}`)).data as Array<{ id: string; receiptNumber: string; amount: number; paymentMethod: string; createdAt: string }>,
  email: async (transactionId: string, to: string) => (await api.post(`/receipts/${transactionId}/email`, { to })).data as { sent: boolean }
};
