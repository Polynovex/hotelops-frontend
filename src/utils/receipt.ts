import { desktopBridge } from '../services/desktopBridge';
import type { PosOrderRow } from '../services/posFlow';

/**
 * POS receipts, laid out for an 80mm thermal roll: the business's name and
 * contacts, the order, items with their add-ons, totals, how it was paid, and
 * a "Powered by HotelOpX" line. In the desktop app it goes straight to the
 * till printer; in a browser it opens the print dialog sized for a roll (or
 * "Save as PDF" for a digital copy).
 */

export type ReceiptBusiness = { name: string; address?: string | null; phone?: string | null; email?: string | null; website?: string | null } | null;
export type ReceiptPayment = { method?: string | null; amount?: number | null; change?: number | null } | null;

const esc = (value: unknown) => String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
const naira = (n: number) => `₦${(Number(n) || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const buildReceiptHtml = (order: PosOrderRow, business: ReceiptBusiness, payment?: ReceiptPayment) => {
  const lines = order.items
    .map((item) => {
      const addOns = (item.addOns ?? []).map((a) => `<div class="sub">+ ${esc(a.name)} ${naira(a.price)}</div>`).join('');
      return `<div class="row"><span>${item.quantity} × ${esc(item.name)}</span><span>${naira(item.lineTotal)}</span></div>${addOns}${item.notes ? `<div class="sub">${esc(item.notes)}</div>` : ''}`;
    })
    .join('');
  const discount = Math.max(0, Math.round((order.subtotal + order.serviceCharge + order.tax - order.total) * 100) / 100);
  const paid = payment?.amount ?? (order.paymentStatus === 'COMPLETED' ? order.total : null);
  const where = order.tableNumber ? `Table ${esc(order.tableNumber)}` : order.metadata?.roomNumber ? `Room ${esc(order.metadata.roomNumber)}` : esc(order.orderType.replace(/_/g, ' ').toLowerCase());

  return `<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${esc(order.orderNumber)}</title>
<style>
  @page { size: 80mm auto; margin: 3mm; }
  * { box-sizing: border-box; }
  body { margin: 0; width: 74mm; font-family: "Helvetica Neue", Arial, sans-serif; font-size: 12px; color: #000; }
  .c { text-align: center; }
  .name { font-size: 16px; font-weight: 800; letter-spacing: .02em; }
  .muted { font-size: 11px; }
  .rule { border-top: 1px dashed #000; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; gap: 8px; margin: 2px 0; }
  .row span:last-child { white-space: nowrap; }
  .sub { font-size: 11px; padding-left: 12px; }
  .total { font-size: 15px; font-weight: 800; }
  .title { font-weight: 800; letter-spacing: .12em; margin: 4px 0; }
</style></head><body>
  <div class="c name">${esc(business?.name ?? 'Receipt')}</div>
  ${business?.address ? `<div class="c muted">${esc(business.address)}</div>` : ''}
  ${business?.phone ? `<div class="c muted">Tel: ${esc(business.phone)}</div>` : ''}
  ${business?.email ? `<div class="c muted">${esc(business.email)}</div>` : ''}
  <div class="rule"></div>
  <div class="c title">${order.paymentStatus === 'COMPLETED' || paid ? 'RECEIPT' : 'BILL'}</div>
  <div class="row"><span>Order</span><span>${esc(order.orderNumber)}</span></div>
  <div class="row"><span>${esc(order.outlet?.name ?? 'Outlet')}</span><span>${where}</span></div>
  <div class="row"><span>Date</span><span>${esc(new Date(order.createdAt).toLocaleString('en-GB'))}</span></div>
  ${order.customerName ? `<div class="row"><span>Guest</span><span>${esc(order.customerName)}</span></div>` : ''}
  <div class="rule"></div>
  ${lines}
  <div class="rule"></div>
  <div class="row"><span>Subtotal</span><span>${naira(order.subtotal)}</span></div>
  ${discount ? `<div class="row"><span>Discount</span><span>−${naira(discount)}</span></div>` : ''}
  ${order.serviceCharge ? `<div class="row"><span>Service charge</span><span>${naira(order.serviceCharge)}</span></div>` : ''}
  ${order.tax ? `<div class="row"><span>VAT</span><span>${naira(order.tax)}</span></div>` : ''}
  <div class="row total"><span>TOTAL</span><span>${naira(order.total)}</span></div>
  ${paid != null ? `<div class="rule"></div><div class="row"><span>Paid${payment?.method || order.paymentMethod ? ` (${esc((payment?.method || order.paymentMethod || '').replace(/_/g, ' ').toLowerCase())})` : ''}</span><span>${naira(paid)}</span></div>` : ''}
  ${payment?.change ? `<div class="row"><span>Change</span><span>${naira(payment.change)}</span></div>` : ''}
  <div class="rule"></div>
  <div class="c">Thank you for your patronage.</div>
  ${business?.website ? `<div class="c muted">${esc(business.website)}</div>` : ''}
  <div class="c muted" style="margin-top:6px">Powered by HotelOpX</div>
</body></html>`;
};

/** Prints a receipt: to the till printer in the desktop app, otherwise via the browser. */
export const printReceipt = async (order: PosOrderRow, business: ReceiptBusiness, payment?: ReceiptPayment) => {
  const html = buildReceiptHtml(order, business, payment);
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
  setTimeout(() => {
    win.focus();
    win.print();
    setTimeout(() => frame.remove(), 1000);
  }, 200);
  return true;
};
