import { Box, Typography } from '@mui/material';
import type { ReactNode } from 'react';

/**
 * A printable business document (quotation, proforma, invoice, receipt) laid
 * out like a professional invoice: brand and title across the top, who it is
 * for and how to pay, an items table under a coloured header bar, totals with
 * the amount due highlighted, notes, contacts and a signature line. Always
 * light, whatever the app theme, because it is what gets printed and sent.
 */

export type SheetRow = { description: string; details?: string | null; price: number | null; qty: string | number; amount: number; section?: string };

const ACCENT = '#0B4AA8';
const INK = '#1C2333';
const MUTED = '#5B6475';

const naira = (n: number) => `₦${(Number(n) || 0).toLocaleString('en-NG', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

const Label = ({ children }: { children: ReactNode }) => (
  <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: INK, mb: 0.5 }}>{children}</Typography>
);

const Pair = ({ label, value }: { label: string; value: ReactNode }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, fontSize: 13, color: INK, lineHeight: 1.7 }}>
    <span style={{ color: MUTED }}>{label}</span>
    <span style={{ textAlign: 'right', fontWeight: 600 }}>{value}</span>
  </Box>
);

export const DocumentSheet = ({
  id,
  title,
  subtitle,
  stamp,
  brand,
  meta,
  billTo,
  extra,
  payment,
  rows,
  totals,
  due,
  notes,
  terms,
  signature,
  poweredBy = true
}: {
  id: string;
  /** e.g. PROFORMA, QUOTATION, INVOICE, RECEIPT */
  title: string;
  subtitle?: string;
  /** A large status mark such as PAID or VOID. */
  stamp?: string | null;
  brand: { name: string; logoUrl?: string | null; tagline?: string | null; address?: string | null; phone?: string | null; email?: string | null; website?: string | null };
  meta: Array<[string, ReactNode]>;
  billTo: { heading?: string; name: string; lines: Array<string | null | undefined> };
  /** A second block beside "invoice to", e.g. the event. */
  extra?: { heading: string; lines: Array<string | null | undefined> };
  payment?: Array<[string, string]> | null;
  rows: SheetRow[];
  totals: Array<{ label: string; value: number }>;
  due: { label: string; value: number };
  notes?: string | null;
  terms?: string | null;
  signature?: { name: string; title?: string | null } | null;
  poweredBy?: boolean;
}) => (
  <Box
    id={id}
    sx={{
      position: 'relative',
      bgcolor: '#fff',
      color: INK,
      borderRadius: 2,
      overflow: 'hidden',
      border: '1px solid #E3E7EF',
      fontFamily: '"Inter", "Segoe UI", Arial, sans-serif',
      WebkitPrintColorAdjust: 'exact',
      printColorAdjust: 'exact'
    }}
  >
    {/* Accent band */}
    <Box sx={{ height: 10, background: `linear-gradient(90deg, ${ACCENT} 0%, #2E6FD8 60%, #9AA3B2 100%)` }} />

    <Box sx={{ p: { xs: 2.5, sm: 4 } }}>
      {/* Brand and title */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', gap: 3 }}>
        <Box sx={{ minWidth: 0 }}>
          {brand.logoUrl ? (
            <Box sx={{ width: 220, height: 72, display: 'flex', alignItems: 'center', mb: 1 }}>
              <Box component="img" src={brand.logoUrl} alt={brand.name} sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            </Box>
          ) : (
            <Typography sx={{ fontSize: 26, fontWeight: 900, color: ACCENT, letterSpacing: '0.04em', mb: 0.5 }}>{brand.name}</Typography>
          )}
          {brand.logoUrl && <Typography sx={{ fontWeight: 800, fontSize: 15 }}>{brand.name}</Typography>}
          {brand.tagline && <Typography sx={{ fontSize: 12, color: MUTED }}>{brand.tagline}</Typography>}
        </Box>
        <Box sx={{ textAlign: { sm: 'right' }, minWidth: { sm: 260 } }}>
          <Typography sx={{ fontSize: { xs: 30, sm: 40 }, fontWeight: 900, lineHeight: 1, letterSpacing: '0.02em', color: INK }}>{title}</Typography>
          {subtitle && <Typography sx={{ fontSize: { xs: 20, sm: 24 }, fontWeight: 800, color: '#3A4253', letterSpacing: '0.06em' }}>{subtitle}</Typography>}
          <Box sx={{ mt: 1.5 }}>
            {meta.map(([label, value]) => <Pair key={label} label={label} value={value} />)}
          </Box>
        </Box>
      </Box>

      {/* Who it is for, and how to pay */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: payment?.length || extra ? '1fr 1fr' : '1fr' }, gap: 3, mt: 3.5 }}>
        <Box>
          <Label>{billTo.heading ?? 'Invoice to'}</Label>
          <Typography sx={{ fontWeight: 800, fontSize: 15 }}>{billTo.name}</Typography>
          {billTo.lines.filter(Boolean).map((line) => (
            <Typography key={line} sx={{ fontSize: 13, color: INK }}>{line}</Typography>
          ))}
        </Box>
        {(extra || payment?.length) && (
          <Box>
            {extra && (
              <Box sx={{ mb: payment?.length ? 2 : 0 }}>
                <Label>{extra.heading}</Label>
                {extra.lines.filter(Boolean).map((line, i) => (
                  <Typography key={`${line}-${i}`} sx={{ fontSize: 13, fontWeight: i === 0 ? 800 : 400 }}>{line}</Typography>
                ))}
              </Box>
            )}
            {payment?.length ? (
              <Box>
                <Label>Payment method</Label>
                {payment.map(([label, value]) => <Pair key={label} label={label} value={value} />)}
              </Box>
            ) : null}
          </Box>
        )}
      </Box>

      {/* Items */}
      <Box sx={{ mt: 3.5, overflowX: 'auto' }}>
        <Box component="table" sx={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 520 }}>
          <Box component="thead">
            <Box component="tr" sx={{ '& th': { bgcolor: ACCENT, color: '#fff', fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', py: 1.25, px: 1.5 } }}>
              <Box component="th" sx={{ textAlign: 'left', borderRadius: '6px 0 0 6px' }}>Description</Box>
              <Box component="th" sx={{ textAlign: 'right' }}>Price</Box>
              <Box component="th" sx={{ textAlign: 'center' }}>Qty</Box>
              <Box component="th" sx={{ textAlign: 'right', borderRadius: '0 6px 6px 0' }}>Subtotal</Box>
            </Box>
          </Box>
          <Box component="tbody">
            {rows.map((row, i) =>
              row.section ? (
                <Box component="tr" key={`s-${i}`}>
                  <Box component="td" colSpan={4} sx={{ pt: 2, pb: 0.5, px: 1.5, fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: ACCENT }}>{row.section}</Box>
                </Box>
              ) : (
                <Box component="tr" key={i} sx={{ '& td': { py: 1.5, px: 1.5, borderBottom: `1.5px solid ${ACCENT}22`, fontSize: 13.5, verticalAlign: 'top' } }}>
                  <Box component="td">
                    <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>{row.description}</Typography>
                    {row.details && <Typography sx={{ fontSize: 12, color: MUTED }}>{row.details}</Typography>}
                  </Box>
                  <Box component="td" sx={{ textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 700 }}>{row.price == null ? '' : naira(row.price)}</Box>
                  <Box component="td" sx={{ textAlign: 'center', whiteSpace: 'nowrap' }}>{row.qty}</Box>
                  <Box component="td" sx={{ textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 700 }}>{naira(row.amount)}</Box>
                </Box>
              )
            )}
          </Box>
        </Box>
      </Box>

      {/* Notes and totals */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1.2fr 1fr' }, gap: 3, mt: 3, alignItems: 'start' }}>
        <Box sx={{ order: { xs: 2, sm: 1 } }}>
          {notes && (
            <>
              <Label>NB</Label>
              <Typography sx={{ fontSize: 13, whiteSpace: 'pre-wrap', mb: 1.5 }}>{notes}</Typography>
            </>
          )}
          {terms && (
            <>
              <Label>Terms and conditions</Label>
              <Typography sx={{ fontSize: 12, color: MUTED, whiteSpace: 'pre-wrap' }}>{terms}</Typography>
            </>
          )}
        </Box>
        <Box sx={{ order: { xs: 1, sm: 2 } }}>
          {totals.map((t) => (
            <Box key={t.label} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.6, fontSize: 14, fontWeight: 700 }}>
              <span>{t.label} :</span>
              <span>{t.value < 0 ? `−${naira(-t.value)}` : naira(t.value)}</span>
            </Box>
          ))}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, px: 2, py: 1.1, bgcolor: ACCENT, color: '#fff', borderRadius: 1.5, fontWeight: 900, fontSize: 16 }}>
            <span>{due.label} :</span>
            <span>{naira(due.value)}</span>
          </Box>
        </Box>
      </Box>

      {/* Contacts and signature */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1.2fr 1fr' }, gap: 3, mt: 4, alignItems: 'end' }}>
        <Box>
          <Typography sx={{ fontWeight: 900, fontSize: 14, letterSpacing: '0.04em', mb: 1 }}>THANK YOU FOR YOUR BUSINESS</Typography>
          {[brand.phone, brand.email, brand.website, brand.address].filter(Boolean).map((line) => (
            <Typography key={line} sx={{ fontSize: 13 }}>{line}</Typography>
          ))}
        </Box>
        {signature && (
          <Box sx={{ textAlign: 'center' }}>
            <Box sx={{ borderTop: `1.5px solid ${INK}`, mx: 'auto', width: '80%', mb: 0.75 }} />
            <Typography sx={{ fontWeight: 900, fontSize: 14, letterSpacing: '0.04em' }}>{signature.name}</Typography>
            {signature.title && <Typography sx={{ fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: MUTED }}>{signature.title}</Typography>}
          </Box>
        )}
      </Box>

      {poweredBy && (
        <Typography sx={{ textAlign: 'center', fontSize: 11, color: MUTED, letterSpacing: '0.06em', mt: 4 }}>
          Powered by <strong style={{ color: INK }}>HotelOpX</strong>
        </Typography>
      )}
    </Box>

    {/* Status stamp */}
    {stamp && (
      <Box sx={{ position: 'absolute', top: '42%', left: '50%', transform: 'translate(-50%, -50%) rotate(-18deg)', border: `4px solid ${stamp === 'VOID' ? '#B42318' : '#1F8A4C'}`, color: stamp === 'VOID' ? '#B42318' : '#1F8A4C', px: 3, py: 0.5, fontSize: 44, fontWeight: 900, letterSpacing: '0.12em', opacity: 0.22, borderRadius: 2, pointerEvents: 'none' }}>
        {stamp}
      </Box>
    )}

    <Box sx={{ height: 10, background: `linear-gradient(90deg, #9AA3B2 0%, #2E6FD8 40%, ${ACCENT} 100%)` }} />
  </Box>
);

export default DocumentSheet;
