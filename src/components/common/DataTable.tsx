import { Key, ReactNode, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { TableRowsRounded } from '@mui/icons-material';

export interface DataTableColumn<T> {
  key: keyof T | string;
  label: string;
  align?: 'left' | 'right' | 'center';
  minWidth?: number;
  render?: (row: T) => ReactNode;
}

interface DataTableProps<T extends object> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey?: (row: T) => Key;
  emptyText?: string;
  rowsPerPageOptions?: number[];
  defaultRowsPerPage?: number;
  minWidth?: number;
  maxHeight?: number | string;
  stickyHeader?: boolean;
}

const DataTable = <T extends object>({
  columns,
  rows,
  rowKey,
  emptyText = 'No data found.',
  rowsPerPageOptions = [10, 25, 50],
  defaultRowsPerPage,
  minWidth,
  maxHeight = 560,
  stickyHeader = true
}: DataTableProps<T>) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const initialRowsPerPage = defaultRowsPerPage || (isMobile ? 5 : 10);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(initialRowsPerPage);

  useEffect(() => {
    setRowsPerPage(initialRowsPerPage);
    setPage(0);
  }, [initialRowsPerPage]);

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(rows.length / rowsPerPage) - 1);
    if (page > maxPage) {
      setPage(maxPage);
    }
  }, [rows.length, rowsPerPage, page]);

  const paginatedRows = useMemo(() => {
    const start = page * rowsPerPage;
    return rows.slice(start, start + rowsPerPage);
  }, [page, rows, rowsPerPage]);

  const tableMinWidth =
    minWidth || columns.reduce((acc, column) => acc + (column.minWidth || 160), 0);

  const getCellValue = (row: T, key: DataTableColumn<T>['key']) => {
    return (row as Record<string, unknown>)[String(key)];
  };

  return (
    <Paper
      sx={{
        borderRadius: '10px',
        overflow: 'hidden',
        border: `1px solid ${alpha(theme.palette.primary.main, 0.08)}`,
        background: isDark ? theme.palette.background.paper : '#FFFFFF',
        boxShadow: isDark ? '0 22px 58px rgba(0, 0, 0, 0.28)' : '0 12px 32px rgba(15, 27, 35, 0.04)'
      }}
    >
      <Box
        sx={{
          px: { xs: 2, md: 3 },
          py: 2.25,
          borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.08)}`,
          background: isDark ? theme.palette.background.paper : '#FFFFFF'
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: '10px',
                display: 'grid',
                placeItems: 'center',
                bgcolor: alpha(theme.palette.secondary.main, 0.14),
                color: theme.palette.secondary.dark
              }}
            >
              <TableRowsRounded />
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ letterSpacing: '0.12em', color: 'text.secondary' }}>
                DATA GRID
              </Typography>
              <Typography variant="h6">Showing {rows.length.toLocaleString()} records</Typography>
            </Box>
          </Stack>
          <Chip
            label={`${columns.length} columns`}
            sx={{
              bgcolor: alpha(theme.palette.primary.main, 0.06),
              color: 'text.secondary'
            }}
          />
        </Stack>
      </Box>

      <TableContainer sx={{ overflowX: 'auto', maxHeight, px: 1.5, pt: 1.5 }}>
        <Table
          stickyHeader={stickyHeader}
          size={isMobile ? 'small' : 'medium'}
          sx={{
            minWidth: tableMinWidth,
            borderCollapse: 'separate',
            borderSpacing: '0 10px'
          }}
        >
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell
                  key={String(column.key)}
                  align={column.align || 'left'}
                  sx={{
                    fontWeight: 700,
                    minWidth: column.minWidth,
                    border: 'none',
                    background: 'transparent',
                    color: 'text.secondary',
                    fontSize: '0.72rem',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    pb: 0.75
                  }}
                >
                  {column.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedRows.map((row, index) => (
              <TableRow
                key={rowKey?.(row) || `${page}-${index}`}
                hover
                sx={{
                  '& td': {
                    borderTop: `1px solid ${alpha(theme.palette.primary.main, 0.08)}`,
                    borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.08)}`,
                    backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.82 : 0.92)
                  },
                  '& td:first-of-type': {
                    borderLeft: `1px solid ${alpha(theme.palette.primary.main, 0.08)}`,
                    borderTopLeftRadius: '10px',
                    borderBottomLeftRadius: '10px',
                    pl: { xs: 2, md: 2.5 }
                  },
                  '& td:last-of-type': {
                    borderRight: `1px solid ${alpha(theme.palette.primary.main, 0.08)}`,
                    borderTopRightRadius: '10px',
                    borderBottomRightRadius: '10px',
                    pr: { xs: 2, md: 2.5 }
                  },
                  '&:hover td': {
                    backgroundColor: alpha(theme.palette.secondary.main, 0.08)
                  }
                }}
              >
                {columns.map((column) => (
                  <TableCell
                    key={String(column.key)}
                    align={column.align || 'left'}
                    sx={{
                      py: 1.75,
                      borderBottom: 'none',
                      color: 'text.primary'
                    }}
                  >
                    {column.render ? column.render(row) : String(getCellValue(row, column.key) ?? '')}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} sx={{ border: 'none', py: 6 }}>
                  <Stack alignItems="center" spacing={1.25}>
                    <Box
                      sx={{
                        width: 52,
                        height: 52,
                        borderRadius: '10px',
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: alpha(theme.palette.primary.main, 0.05),
                        color: 'text.secondary'
                      }}
                    >
                      <TableRowsRounded />
                    </Box>
                    <Typography variant="subtitle1">No rows to display</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {emptyText}
                    </Typography>
                  </Stack>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={rows.length}
        page={page}
        onPageChange={(_event, nextPage) => setPage(nextPage)}
        rowsPerPage={rowsPerPage}
        rowsPerPageOptions={isMobile ? [5, 10, 25] : rowsPerPageOptions}
        onRowsPerPageChange={(event) => {
          setRowsPerPage(Number(event.target.value));
          setPage(0);
        }}
        sx={{
          px: { xs: 1, md: 2 },
          borderTop: `1px solid ${alpha(theme.palette.primary.main, 0.08)}`,
          backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.72 : 0.55)
        }}
      />
    </Paper>
  );
};

export default DataTable;
