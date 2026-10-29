import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Alert, Autocomplete, Box, Button, Chip, Container, Dialog, DialogActions, DialogContent, DialogTitle, Grid, IconButton,
  MenuItem, Paper, Stack, Tab, Tabs, TextField, Typography
} from '@mui/material';
import AddRounded from '@mui/icons-material/AddRounded';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import PrintRounded from '@mui/icons-material/PrintRounded';
import SendRounded from '@mui/icons-material/SendRounded';
import { useSnackbar } from 'notistack';
import Layout from '../../components/Layout';
import DataTable from '../../components/common/DataTable';
import RowActionsMenu from '../../components/common/RowActionsMenu';
import DocumentSheet from '../../components/documents/DocumentSheet';
import { api, superAdminService, type BusinessSummary } from '../../services/api';
import { billingApi, STATUS_LABEL, totalsOf, type BillingDoc, type BillingLine, type DocKind, type DocStatus } from '../../services/billing';
import { formatCurrency } from '../../utils/formatters';
import { getApiErrorMessage } from '../../utils/apiError';
import { printElement } from '../../utils/printElement';

const STATUS_COLOR: Record<DocStatus, 'default' | 'info' | 'success' | 'warning' | 'error' | 'secondary'> = {
  DRAFT: 'default', SENT: 'info', ACCEPTED: 'success', DECLINED: 'error', CONVERTED: 'secondary', PARTIALLY_PAID: 'warning', PAID: 'success', VOID: 'error'
};

type BillingSettings = Partial<Record<'bankName' | 'accountName' | 'accountNumber' | 'signatoryName' | 'signatoryTitle' | 'defaultTerms' | 'defaultNotes' | 'vatNumber' | 'tin' | 'rcNumber', string>>;

const HOTELOPX = {
  name: 'HotelOpX',
  logoUrl: '/logo.png',
  tagline: 'A product of Polynovex Limited',
  address: '20 Samera St, Ketu, Lagos',
  phone: '+234 813 439 3554',
  email: 'info@hotelopx.com',
  website: 'www.hotelopx.com'
};

const fmtDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

/** The printable view of a quote or invoice. */
export const BillingSheet = ({ doc, settings }: { doc: BillingDoc; settings: BillingSettings }) => (
  <DocumentSheet
    id="billing-document"
    title={doc.kind === 'QUOTE' ? 'QUOTATION' : 'INVOICE'}
    stamp={doc.status === 'PAID' ? 'PAID' : doc.status === 'VOID' ? 'VOID' : null}
    brand={HOTELOPX}
    meta={[
      ...(settings.rcNumber ? [['Comp Reg No', settings.rcNumber] as [string, string]] : []),
      ['Date', fmtDate(doc.issueDate)],
      [doc.kind === 'QUOTE' ? 'Quotation No' : 'Invoice No', doc.number],
      ...(doc.dueDate ? [[doc.kind === 'QUOTE' ? 'Valid until' : 'Due date', fmtDate(doc.dueDate)] as [string, string]] : []),
      ...(settings.vatNumber ? [['VAT Number', settings.vatNumber] as [string, string]] : []),
      ...(settings.tin ? [['TIN', settings.tin] as [string, string]] : [])
    ]}
    billTo={{
      heading: doc.kind === 'QUOTE' ? 'Quotation to' : 'Invoice to',
      name: doc.customerName,
      lines: [doc.customerPhone ? `Phone: ${doc.customerPhone}` : null, doc.customerEmail ? `Email: ${doc.customerEmail}` : null, doc.customerAddress ? `Address: ${doc.customerAddress}` : null]
    }}
    payment={settings.accountNumber ? ([['Account No', settings.accountNumber], ['Account Name', settings.accountName ?? ''], ['Bank Name', settings.bankName ?? '']] as Array<[string, string]>).filter(([, v]) => v) : null}
    rows={doc.lines.map((line) => ({
      description: line.description,
      details: [line.details, line.discountPct ? `${line.discountPct}% off` : null, line.taxRate ? `VAT ${line.taxRate}%` : null].filter(Boolean).join(' · ') || null,
      price: line.unitPrice,
      qty: line.quantity,
      amount: line.amount ?? 0
    }))}
    totals={[
      { label: 'Sub-total', value: doc.subtotal },
      ...(doc.discountTotal ? [{ label: 'Discount', value: -doc.discountTotal }] : []),
      ...(doc.taxTotal ? [{ label: 'VAT', value: doc.taxTotal }] : []),
      { label: 'Total', value: doc.total },
      ...(doc.kind === 'INVOICE' ? [{ label: 'Amt Paid', value: doc.amountPaid }] : [])
    ]}
    due={doc.kind === 'INVOICE' ? { label: 'Balance', value: doc.balance } : { label: 'Total', value: doc.total }}
    notes={doc.notes}
    terms={doc.terms}
    signature={settings.signatoryName ? { name: settings.signatoryName, title: settings.signatoryTitle } : null}
    poweredBy={false}
  />
);

/** Quotes and invoices, with what is owed. */
export const BillingListPage = () => {
  const navigate = useNavigate();
  const [kind, setKind] = useState<DocKind>('INVOICE');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [data, setData] = useState<Awaited<ReturnType<typeof billingApi.list>> | null>(null);
  const [error, setError] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await billingApi.list({ kind, status: status || undefined, search: search || undefined }));
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load documents'));
    }
  }, [kind, status, search]);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(t);
  }, [load]);

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h4" fontWeight={700}>Quotes & Invoices</Typography>
            <Typography variant="body2" color="text.secondary">HotelOpX&apos;s own billing to its customers.</Typography>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ alignSelf: { md: 'center' } }}>
            <Button onClick={() => setSettingsOpen(true)}>Billing settings</Button>
            <Button variant="outlined" startIcon={<AddRounded />} onClick={() => navigate('/super-admin/billing/new?kind=QUOTE')}>New quote</Button>
            <Button variant="contained" startIcon={<AddRounded />} onClick={() => navigate('/super-admin/billing/new?kind=INVOICE')}>New invoice</Button>
          </Stack>
        </Stack>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {data && (
          <Grid container spacing={1.5} sx={{ mb: 2 }}>
            {[
              ['Outstanding', formatCurrency(data.summary.outstanding)],
              ['Overdue', formatCurrency(data.summary.overdue)],
              ['Paid this month', formatCurrency(data.summary.paidThisMonth)],
              ['Open quotes', String(data.summary.openQuotes)]
            ].map(([label, value]) => (
              <Grid item xs={6} md={3} key={label}>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary">{label}</Typography>
                  <Typography variant="h5" fontWeight={800} color={label === 'Overdue' && data.summary.overdue > 0 ? 'error.main' : undefined}>{value}</Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        )}

        <Tabs value={kind} onChange={(_e, v) => { setKind(v); setStatus(''); }} sx={{ mb: 1.5 }}>
          <Tab value="INVOICE" label="Invoices" />
          <Tab value="QUOTE" label="Quotes" />
        </Tabs>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 1.5 }}>
          <TextField size="small" label="Search number, customer or email" value={search} onChange={(e) => setSearch(e.target.value)} sx={{ minWidth: 280 }} />
          <TextField size="small" select label="Status" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ minWidth: 180 }}>
            <MenuItem value="">All</MenuItem>
            {(kind === 'QUOTE' ? ['DRAFT', 'SENT', 'ACCEPTED', 'DECLINED', 'CONVERTED', 'VOID'] : ['DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'VOID']).map((s) => (
              <MenuItem key={s} value={s}>{STATUS_LABEL[s as DocStatus]}</MenuItem>
            ))}
          </TextField>
        </Stack>

        <DataTable
          rows={data?.documents ?? []}
          rowKey={(row) => row.id}
          emptyText={kind === 'QUOTE' ? 'No quotes yet.' : 'No invoices yet.'}
          columns={[
            { key: 'number', label: 'Number', minWidth: 140, render: (row) => <Button size="small" sx={{ fontWeight: 800, px: 0 }} onClick={() => navigate(`/super-admin/billing/${row.id}`)}>{row.number}</Button> },
            { key: 'customer', label: 'Customer', minWidth: 200, render: (row) => row.customerName },
            { key: 'date', label: 'Date', minWidth: 120, render: (row) => fmtDate(row.issueDate) },
            { key: 'due', label: kind === 'QUOTE' ? 'Valid until' : 'Due', minWidth: 120, render: (row) => fmtDate(row.dueDate) },
            { key: 'total', label: 'Total', minWidth: 120, render: (row) => formatCurrency(row.total) },
            ...(kind === 'INVOICE' ? [{ key: 'balance', label: 'Balance', minWidth: 120, render: (row: BillingDoc) => formatCurrency(row.balance) }] : []),
            {
              key: 'status',
              label: 'Status',
              minWidth: 130,
              render: (row) => (
                <Stack direction="row" spacing={0.5}>
                  <Chip size="small" color={STATUS_COLOR[row.status]} label={STATUS_LABEL[row.status]} />
                  {row.overdue && <Chip size="small" color="error" variant="outlined" label="Overdue" />}
                </Stack>
              )
            }
          ]}
        />
        <BillingSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </Container>
    </Layout>
  );
};

const BillingSettingsDialog = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const { enqueueSnackbar } = useSnackbar();
  const [form, setForm] = useState<BillingSettings>({});
  useEffect(() => {
    if (open) api.get('/admin/billing/settings').then(({ data }) => setForm(data ?? {})).catch(() => setForm({}));
  }, [open]);
  const save = async () => {
    try {
      await api.put('/admin/billing/settings', form);
      enqueueSnackbar('Billing settings saved', { variant: 'success' });
      onClose();
    } catch (err) {
      enqueueSnackbar(getApiErrorMessage(err, 'Could not save'), { variant: 'error' });
    }
  };
  const field = (key: keyof BillingSettings, label: string, props: Record<string, unknown> = {}) => (
    <TextField label={label} value={form[key] ?? ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} fullWidth {...props} />
  );
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Billing settings</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Printed on every quote and invoice.</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>{field('bankName', 'Bank name')}</Grid>
          <Grid item xs={12} sm={6}>{field('accountNumber', 'Account number')}</Grid>
          <Grid item xs={12}>{field('accountName', 'Account name')}</Grid>
          <Grid item xs={12} sm={4}>{field('rcNumber', 'Company reg. no')}</Grid>
          <Grid item xs={12} sm={4}>{field('vatNumber', 'VAT number')}</Grid>
          <Grid item xs={12} sm={4}>{field('tin', 'TIN')}</Grid>
          <Grid item xs={12} sm={6}>{field('signatoryName', 'Signed by')}</Grid>
          <Grid item xs={12} sm={6}>{field('signatoryTitle', 'Their title')}</Grid>
          <Grid item xs={12}>{field('defaultNotes', 'Default note', { multiline: true, minRows: 2 })}</Grid>
          <Grid item xs={12}>{field('defaultTerms', 'Default terms', { multiline: true, minRows: 3 })}</Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => void save()}>Save</Button>
      </DialogActions>
    </Dialog>
  );
};

const blankLine = (): BillingLine => ({ description: '', details: '', quantity: 1, unitPrice: 0, discountPct: 0, taxRate: 0 });
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/**
 * One quote or invoice: edit it while it is a draft (or sent and unpaid),
 * see it exactly as it prints, send it, take payments, convert a quote.
 */
export const BillingDocumentPage = () => {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const isNew = !id || id === 'new';
  const [doc, setDoc] = useState<BillingDoc | null>(null);
  const [settings, setSettings] = useState<BillingSettings>({});
  const [businesses, setBusinesses] = useState<BusinessSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [payOpen, setPayOpen] = useState(false);
  const [pay, setPay] = useState({ amount: '', method: 'TRANSFER', reference: '' });
  const [form, setForm] = useState({
    kind: (params.get('kind') === 'QUOTE' ? 'QUOTE' : 'INVOICE') as DocKind,
    hotelId: null as string | null,
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    customerAddress: '',
    issueDate: isoDate(new Date()),
    dueDate: isoDate(new Date(Date.now() + 14 * 86_400_000)),
    lines: [blankLine()],
    notes: '',
    terms: ''
  });

  const load = useCallback(async () => {
    if (isNew) return;
    try {
      const d = await billingApi.get(id!);
      setDoc(d);
      setForm({
        kind: d.kind,
        hotelId: d.hotelId,
        customerName: d.customerName,
        customerEmail: d.customerEmail ?? '',
        customerPhone: d.customerPhone ?? '',
        customerAddress: d.customerAddress ?? '',
        issueDate: d.issueDate.slice(0, 10),
        dueDate: d.dueDate ? d.dueDate.slice(0, 10) : '',
        lines: d.lines.map((l) => ({ ...l, details: l.details ?? '' })),
        notes: d.notes ?? '',
        terms: d.terms ?? ''
      });
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load the document'));
    }
  }, [id, isNew]);

  useEffect(() => {
    void load();
    api.get('/admin/billing/settings').then(({ data }) => {
      setSettings(data ?? {});
      if (isNew) setForm((f) => ({ ...f, notes: f.notes || data?.defaultNotes || '', terms: f.terms || data?.defaultTerms || '' }));
    }).catch(() => undefined);
    superAdminService.getBusinesses().then(setBusinesses).catch(() => setBusinesses([]));
  }, [load, isNew]);

  const editable = isNew || ((doc?.status === 'DRAFT' || doc?.status === 'SENT') && (doc?.amountPaid ?? 0) === 0);
  const totals = useMemo(() => totalsOf(form.lines), [form.lines]);

  /** What the preview shows: the saved document, or the form as it stands. */
  const preview: BillingDoc = useMemo(() => {
    const base = doc ?? ({ id: '', number: isNew ? '(on save)' : '', status: 'DRAFT', amountPaid: 0, payments: null, convertedFromId: null, sentAt: null, paidAt: null, createdAt: '' } as unknown as BillingDoc);
    if (!editable) return base;
    return {
      ...base,
      ...form,
      dueDate: form.dueDate || null,
      lines: form.lines.map((l) => {
        const gross = (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0);
        const net = gross - gross * ((Number(l.discountPct) || 0) / 100);
        return { ...l, amount: Math.round((net + net * ((Number(l.taxRate) || 0) / 100)) * 100) / 100 };
      }),
      subtotal: totals.subtotal,
      discountTotal: totals.discount,
      taxTotal: totals.tax,
      total: totals.total,
      balance: Math.max(0, totals.total - (base.amountPaid ?? 0)),
      overdue: false
    } as BillingDoc;
  }, [doc, form, totals, editable, isNew]);

  const payload = () => ({
    hotelId: form.hotelId,
    customerName: form.customerName.trim(),
    customerEmail: form.customerEmail.trim() || null,
    customerPhone: form.customerPhone.trim() || null,
    customerAddress: form.customerAddress.trim() || null,
    issueDate: form.issueDate,
    dueDate: form.dueDate || null,
    lines: form.lines.filter((l) => l.description.trim()).map((l) => ({ ...l, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), discountPct: Number(l.discountPct) || 0, taxRate: Number(l.taxRate) || 0 })),
    notes: form.notes.trim() || null,
    terms: form.terms.trim() || null
  });

  const run = async (action: () => Promise<BillingDoc | unknown>, message: string) => {
    setBusy(true);
    setError('');
    try {
      const result = await action();
      enqueueSnackbar(message, { variant: 'success' });
      return result;
    } catch (err) {
      setError(getApiErrorMessage(err, 'That did not work'));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const save = async (andSend = false) => {
    const saved = (await run(
      () => (isNew ? billingApi.create({ kind: form.kind, ...payload() } as never) : billingApi.update(id!, payload() as never)),
      isNew ? `${form.kind === 'QUOTE' ? 'Quote' : 'Invoice'} saved` : 'Saved'
    )) as BillingDoc | null;
    if (!saved) return;
    if (andSend) {
      const sent = (await run(() => billingApi.send(saved.id), `Sent to ${saved.customerEmail}`)) as BillingDoc | null;
      if (sent) setDoc(sent);
    }
    if (isNew) navigate(`/super-admin/billing/${saved.id}`, { replace: true });
    else await load();
  };

  const setLine = (index: number, patch: Partial<BillingLine>) => setForm((f) => ({ ...f, lines: f.lines.map((l, i) => (i === index ? { ...l, ...patch } : l)) }));
  const label = form.kind === 'QUOTE' ? 'quote' : 'invoice';

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
          <Box>
            <Button size="small" onClick={() => navigate('/super-admin/billing')}>← Quotes & Invoices</Button>
            <Typography variant="h4" fontWeight={700}>{isNew ? `New ${label}` : doc?.number}</Typography>
            {doc && (
              <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                <Chip size="small" color={STATUS_COLOR[doc.status]} label={STATUS_LABEL[doc.status]} />
                {doc.overdue && <Chip size="small" color="error" variant="outlined" label="Overdue" />}
                {doc.sentAt && <Chip size="small" variant="outlined" label={`Sent ${fmtDate(doc.sentAt)}`} />}
              </Stack>
            )}
          </Box>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            {editable && <Button variant="outlined" onClick={() => void save(false)} disabled={busy || !form.customerName.trim()}>Save</Button>}
            {editable && <Button variant="contained" startIcon={<SendRounded />} onClick={() => void save(true)} disabled={busy || !form.customerName.trim() || !form.customerEmail.trim()}>Save & send</Button>}
            {!editable && doc && doc.status !== 'VOID' && <Button variant="outlined" startIcon={<SendRounded />} onClick={() => void run(() => billingApi.send(doc.id).then(setDoc), 'Sent again')} disabled={busy || !doc.customerEmail}>Send again</Button>}
            {doc?.kind === 'INVOICE' && doc.balance > 0 && doc.status !== 'VOID' && (
              <Button variant="contained" color="success" onClick={() => { setPay({ amount: String(doc.balance), method: 'TRANSFER', reference: '' }); setPayOpen(true); }}>Record payment</Button>
            )}
            {doc?.kind === 'QUOTE' && !['CONVERTED', 'VOID', 'DECLINED'].includes(doc.status) && (
              <Button variant="contained" onClick={async () => { const inv = (await run(() => billingApi.convert(doc.id), 'Invoice created')) as BillingDoc | null; if (inv) navigate(`/super-admin/billing/${inv.id}`); }} disabled={busy}>Convert to invoice</Button>
            )}
            {doc && (
              <Button startIcon={<PrintRounded />} onClick={() => printElement('billing-document', doc.number, { keepColors: true })}>PDF / Print</Button>
            )}
            {doc && (
              <RowActionsMenu
                subject={doc.number}
                actions={[
                  { key: 'accept', label: 'Mark accepted', hidden: doc.kind !== 'QUOTE' || !['DRAFT', 'SENT'].includes(doc.status), onClick: () => void run(() => billingApi.setStatus(doc.id, 'ACCEPTED').then(setDoc), 'Quote accepted') },
                  { key: 'decline', label: 'Mark declined', hidden: doc.kind !== 'QUOTE' || !['DRAFT', 'SENT'].includes(doc.status), onClick: () => void run(() => billingApi.setStatus(doc.id, 'DECLINED').then(setDoc), 'Quote declined') },
                  { key: 'sent', label: 'Mark as sent', hidden: doc.status !== 'DRAFT', onClick: () => void run(() => billingApi.setStatus(doc.id, 'SENT').then(setDoc), 'Marked as sent') },
                  { key: 'delete', label: 'Delete draft', destructive: true, hidden: doc.status !== 'DRAFT', onClick: async () => { if (await run(() => billingApi.remove(doc.id), 'Draft deleted')) navigate('/super-admin/billing'); } },
                  { key: 'void', label: 'Void', destructive: true, hidden: doc.status === 'DRAFT' || doc.status === 'VOID' || doc.status === 'CONVERTED' || doc.amountPaid > 0, onClick: () => void run(() => billingApi.setStatus(doc.id, 'VOID').then(setDoc), 'Voided') }
                ]}
              />
            )}
          </Stack>
        </Stack>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Grid container spacing={2.5}>
          {editable && (
            <Grid item xs={12} lg={5}>
              <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                <Stack spacing={2}>
                  <Typography fontWeight={800}>Customer</Typography>
                  <Autocomplete
                    options={businesses}
                    getOptionLabel={(b) => `${b.businessName || b.name}`}
                    value={businesses.find((b) => b.id === form.hotelId) ?? null}
                    onChange={(_e, b) =>
                      setForm((f) => ({
                        ...f,
                        hotelId: b?.id ?? null,
                        ...(b ? { customerName: b.businessName || b.name, customerEmail: (b as { email?: string }).email ?? f.customerEmail, customerPhone: (b as { phone?: string }).phone ?? f.customerPhone, customerAddress: (b as { address?: string }).address ?? f.customerAddress } : {})
                      }))
                    }
                    renderInput={(p) => <TextField {...p} label="Business on HotelOpX (optional)" placeholder="Search businesses" />}
                  />
                  <TextField label="Customer name" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} required fullWidth />
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                    <TextField label="Email" type="email" value={form.customerEmail} onChange={(e) => setForm({ ...form, customerEmail: e.target.value })} fullWidth />
                    <TextField label="Phone" value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} fullWidth />
                  </Stack>
                  <TextField label="Address" value={form.customerAddress} onChange={(e) => setForm({ ...form, customerAddress: e.target.value })} fullWidth />
                  <Stack direction="row" spacing={1.5}>
                    <TextField type="date" label="Date" InputLabelProps={{ shrink: true }} value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} fullWidth />
                    <TextField type="date" label={form.kind === 'QUOTE' ? 'Valid until' : 'Due date'} InputLabelProps={{ shrink: true }} value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} fullWidth />
                  </Stack>

                  <Typography fontWeight={800} sx={{ pt: 1 }}>Items</Typography>
                  {form.lines.map((line, index) => (
                    <Paper key={index} variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
                      <Stack spacing={1}>
                        <Stack direction="row" spacing={1} alignItems="flex-start">
                          <TextField size="small" label="Item" value={line.description} onChange={(e) => setLine(index, { description: e.target.value })} fullWidth />
                          <IconButton aria-label="Remove line" onClick={() => setForm((f) => ({ ...f, lines: f.lines.length > 1 ? f.lines.filter((_, i) => i !== index) : [blankLine()] }))}>
                            <DeleteOutlineRounded />
                          </IconButton>
                        </Stack>
                        <TextField size="small" label="Details (optional)" value={line.details ?? ''} onChange={(e) => setLine(index, { details: e.target.value })} fullWidth />
                        <Box sx={{ display: 'grid', gridTemplateColumns: '0.8fr 1.6fr 0.8fr 0.8fr', gap: 1 }}>
                          <TextField size="small" type="number" label="Qty" value={line.quantity} onChange={(e) => setLine(index, { quantity: e.target.value as unknown as number })} />
                          <TextField size="small" type="number" label="Rate (₦)" value={line.unitPrice} onChange={(e) => setLine(index, { unitPrice: e.target.value as unknown as number })} />
                          <TextField size="small" type="number" label="Disc %" value={line.discountPct} onChange={(e) => setLine(index, { discountPct: e.target.value as unknown as number })} />
                          <TextField size="small" type="number" label="VAT %" value={line.taxRate} onChange={(e) => setLine(index, { taxRate: e.target.value as unknown as number })} />
                        </Box>
                      </Stack>
                    </Paper>
                  ))}
                  <Stack direction="row" spacing={1}>
                    <Button startIcon={<AddRounded />} onClick={() => setForm((f) => ({ ...f, lines: [...f.lines, blankLine()] }))}>Add line</Button>
                    <Button onClick={() => setForm((f) => ({ ...f, lines: f.lines.map((l) => ({ ...l, taxRate: 7.5 })) }))}>Apply VAT 7.5% to all</Button>
                  </Stack>
                  <Stack spacing={0.25} sx={{ ml: 'auto', minWidth: 240 }}>
                    {[['Sub-total', totals.subtotal], ['Discount', -totals.discount], ['VAT', totals.tax]].map(([l, v]) => (
                      <Stack key={l as string} direction="row" justifyContent="space-between"><Typography variant="body2">{l}</Typography><Typography variant="body2">{formatCurrency(v as number)}</Typography></Stack>
                    ))}
                    <Stack direction="row" justifyContent="space-between"><Typography fontWeight={800}>Total</Typography><Typography fontWeight={800}>{formatCurrency(totals.total)}</Typography></Stack>
                  </Stack>
                  <TextField label="Note" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} fullWidth multiline minRows={2} />
                  <TextField label="Terms" value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} fullWidth multiline minRows={3} />
                </Stack>
              </Paper>
            </Grid>
          )}
          <Grid item xs={12} lg={editable ? 7 : 9} sx={{ mx: editable ? 0 : 'auto' }}>
            {(isNew || doc) && <BillingSheet doc={preview} settings={settings} />}
            {doc?.payments?.length ? (
              <Paper variant="outlined" sx={{ p: 2, mt: 2, borderRadius: 2 }}>
                <Typography fontWeight={800} sx={{ mb: 1 }}>Payments</Typography>
                {doc.payments.map((p, i) => (
                  <Stack key={i} direction="row" justifyContent="space-between">
                    <Typography variant="body2">{fmtDate(p.paidAt)} · {p.method}{p.reference ? ` · ${p.reference}` : ''}</Typography>
                    <Typography variant="body2" fontWeight={700}>{formatCurrency(p.amount)}</Typography>
                  </Stack>
                ))}
              </Paper>
            ) : null}
          </Grid>
        </Grid>

        <Dialog open={payOpen} onClose={() => !busy && setPayOpen(false)} fullWidth maxWidth="xs">
          <DialogTitle>Record payment</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField type="number" label="Amount (₦)" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} helperText={doc ? `Balance ${formatCurrency(doc.balance)}` : undefined} />
              <TextField select label="Method" value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>
                {['TRANSFER', 'CARD', 'CASH', 'PAYSTACK', 'OTHER'].map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
              </TextField>
              <TextField label="Reference (optional)" value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button variant="contained" disabled={busy || !(Number(pay.amount) > 0)} onClick={async () => {
              const updated = (await run(() => billingApi.pay(doc!.id, { amount: Number(pay.amount), method: pay.method, reference: pay.reference || undefined }), 'Payment recorded')) as BillingDoc | null;
              if (updated) { setDoc(updated); setPayOpen(false); }
            }}>Record</Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Layout>
  );
};
