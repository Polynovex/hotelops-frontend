import React, { useState } from 'react';
import {
  Button,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  useTheme
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  ArticleRounded,
  GridOnRounded,
  PictureAsPdfRounded
} from '@mui/icons-material';

/**
 * Generic, brand-aware "Download report" button.
 *
 * Usage (anywhere — works for any table-shaped report):
 *
 *   <ReportDownloadButton
 *     title="Trial Balance"
 *     subtitle="Period: 1 Apr – 30 Apr 2026"
 *     columns={[
 *       { key: 'accountCode', label: 'Code' },
 *       { key: 'accountName', label: 'Name' },
 *       { key: 'closingBalance', label: 'Closing Balance', format: (v) => fmtNGN(v) }
 *     ]}
 *     rows={report?.rows || []}
 *     totals={[{ label: 'Total Debit', value: report?.totals.totalDebit }]}
 *   />
 *
 * Exports:
 *   - PDF (via browser print-to-PDF, fully styled with brand)
 *   - CSV
 *   - JSON (for downstream tooling)
 *
 * The download icon is a brand SVG (gold) so we don't ship raster icons.
 */

export interface ReportColumn<T = any> {
  key: string;
  label: string;
  format?: (value: any, row: T) => string;
  align?: 'left' | 'right' | 'center';
}

export interface ReportTotalRow {
  label: string;
  value: number | string | undefined | null;
  format?: (value: any) => string;
}

interface ReportDownloadButtonProps<T = any> {
  title: string;
  subtitle?: string;
  columns: ReportColumn<T>[];
  rows: T[];
  totals?: ReportTotalRow[];
  filename?: string;
  disabled?: boolean;
}

const DownloadSvgIcon: React.FC<{ color: string; accent: string }> = ({ color, accent }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <path
      d="M12 3v11.5m0 0L7.5 10m4.5 4.5L16.5 10"
      stroke={accent}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const fmtNumberOrText = (v: any): string => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return v.toString();
  return String(v);
};

const escapeCsv = (v: string): string => {
  if (v.includes(',') || v.includes('"') || v.includes('\n')) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
};

const triggerDownload = (filename: string, content: string, mime: string) => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

function ReportDownloadButton<T extends Record<string, any>>({
  title,
  subtitle,
  columns,
  rows,
  totals,
  filename,
  disabled
}: ReportDownloadButtonProps<T>) {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const baseName = (filename || title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '');
  const stamp = new Date().toISOString().slice(0, 10);

  const exportCSV = () => {
    const lines: string[] = [];
    lines.push(columns.map((c) => escapeCsv(c.label)).join(','));
    for (const row of rows) {
      lines.push(
        columns
          .map((c) => {
            const raw = (row as any)[c.key];
            const formatted = c.format ? c.format(raw, row as T) : fmtNumberOrText(raw);
            return escapeCsv(formatted);
          })
          .join(',')
      );
    }
    if (totals?.length) {
      lines.push('');
      for (const total of totals) {
        const v = total.format ? total.format(total.value) : fmtNumberOrText(total.value);
        lines.push(`${escapeCsv(total.label)},${escapeCsv(v)}`);
      }
    }
    triggerDownload(`${baseName}-${stamp}.csv`, lines.join('\n'), 'text/csv;charset=utf-8');
    setAnchorEl(null);
  };

  const exportJSON = () => {
    const payload = {
      title,
      subtitle,
      generatedAt: new Date().toISOString(),
      columns: columns.map(({ key, label }) => ({ key, label })),
      rows,
      ...(totals && totals.length ? { totals } : {})
    };
    triggerDownload(`${baseName}-${stamp}.json`, JSON.stringify(payload, null, 2), 'application/json');
    setAnchorEl(null);
  };

  const exportPDF = () => {
    setAnchorEl(null);
    const win = window.open('', '_blank', 'noopener,noreferrer');
    if (!win) {
      window.alert('Pop-up was blocked. Please allow pop-ups to download the PDF.');
      return;
    }
    const navy = theme.palette.primary.main;
    const gold = theme.palette.secondary.main;
    const ink = theme.palette.text.primary;

    const escape = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const tableHtml = `
      <table>
        <thead>
          <tr>${columns
            .map((c) => `<th style="text-align:${c.align || 'left'}">${escape(c.label)}</th>`)
            .join('')}</tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `<tr>${columns
                .map((c) => {
                  const raw = (row as any)[c.key];
                  const formatted = c.format
                    ? c.format(raw, row as T)
                    : fmtNumberOrText(raw);
                  return `<td style="text-align:${c.align || 'left'}">${escape(formatted)}</td>`;
                })
                .join('')}</tr>`
            )
            .join('')}
          ${
            totals?.length
              ? `<tr class="totals-row"><td colspan="${columns.length - 1}"><b>Totals</b></td>
                 <td style="text-align:right"><b>${escape(
                   totals
                     .map((t) => `${t.label}: ${t.format ? t.format(t.value) : fmtNumberOrText(t.value)}`)
                     .join(' · ')
                 )}</b></td></tr>`
              : ''
          }
        </tbody>
      </table>
    `;

    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escape(title)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 32px 40px;
      font-family: 'Inter', sans-serif;
      color: ${ink};
      background: #fff;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      padding-bottom: 18px;
      border-bottom: 1px solid #E6E6E6;
    }
    .brand .mark {
      width: 36px; height: 36px; border-radius: 9px;
      background: linear-gradient(135deg, ${navy}, ${theme.palette.primary.light});
      color: ${gold};
      display: grid; place-items: center;
      font-weight: 700;
      font-family: 'Cormorant Garamond', serif;
    }
    .brand .name {
      font-family: 'Cormorant Garamond', serif;
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.01em;
    }
    h1 {
      font-family: 'Cormorant Garamond', serif;
      font-weight: 700;
      letter-spacing: -0.01em;
      margin: 24px 0 6px;
      font-size: 32px;
    }
    .subtitle { color: #5A6A73; font-size: 14px; margin-bottom: 24px; }
    .meta {
      display: flex; gap: 16px;
      font-size: 12px; color: #5A6A73;
      margin-bottom: 24px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th {
      text-align: left; padding: 10px 12px;
      background: ${alpha(navy, 0.04)}; color: #5A6A73;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-size: 11px;
      border-bottom: 1px solid #E6E6E6;
    }
    td {
      padding: 10px 12px;
      border-bottom: 1px solid #F0F0F0;
      font-family: 'JetBrains Mono', monospace;
    }
    .totals-row td {
      border-top: 2px solid ${navy};
      background: ${alpha(navy, 0.04)};
      font-family: 'Inter', sans-serif;
    }
    footer {
      margin-top: 32px;
      padding-top: 14px;
      border-top: 1px solid #E6E6E6;
      font-size: 11px;
      color: #94A1A8;
      display: flex; justify-content: space-between;
    }
    @media print {
      body { padding: 18px 22px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="brand">
    <div class="mark">H</div>
    <div class="name">HotelOpX</div>
  </div>
  <h1>${escape(title)}</h1>
  ${subtitle ? `<div class="subtitle">${escape(subtitle)}</div>` : ''}
  <div class="meta">
    <span>Generated · ${new Date().toLocaleString()}</span>
    <span>Rows · ${rows.length}</span>
  </div>
  ${tableHtml}
  <footer>
    <span>HotelOpX · Hotel Operations Platform</span>
    <span>${new Date().toLocaleDateString()}</span>
  </footer>
  <script>
    window.addEventListener('load', function() {
      setTimeout(function() { window.print(); }, 200);
    });
  </script>
</body>
</html>`);
    win.document.close();
  };

  const navy = theme.palette.primary.main;
  const gold = theme.palette.secondary.main;

  return (
    <>
      <Tooltip title="Download report">
        <span>
          <Button
            variant="outlined"
            color="secondary"
            disabled={disabled || rows.length === 0}
            onClick={(e) => setAnchorEl(e.currentTarget)}
            startIcon={<DownloadSvgIcon color={navy} accent={gold} />}
            sx={{
              fontWeight: 700,
              borderColor: alpha(gold, 0.48),
              color: navy,
              bgcolor: alpha(gold, 0.06),
              '&:hover': {
                bgcolor: alpha(gold, 0.12),
                borderColor: gold
              }
            }}
          >
            Download
          </Button>
        </span>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={!!anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={exportPDF}>
          <ListItemIcon>
            <PictureAsPdfRounded fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Download PDF" secondary="Print-ready, brand-styled" />
        </MenuItem>
        <MenuItem onClick={exportCSV}>
          <ListItemIcon>
            <GridOnRounded fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Download CSV" secondary="Open in Excel / Sheets" />
        </MenuItem>
        <MenuItem onClick={exportJSON}>
          <ListItemIcon>
            <ArticleRounded fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Download JSON" secondary="For BI / accounting integrations" />
        </MenuItem>
      </Menu>
    </>
  );
}

export default ReportDownloadButton;
