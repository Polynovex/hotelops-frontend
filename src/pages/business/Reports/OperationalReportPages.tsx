import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Container,
  Grid,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import { Pie, PieChart, Cell, Tooltip, ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Bar } from 'recharts';
import Layout from '../../../components/Layout';
import LogoLoader from '../../../components/LogoLoader';
import ReportDownloadButton from '../../../components/ReportDownloadButton';
import { DashboardMetrics, dashboardService, PosOrder, posService } from '../../../services/api';
import { housekeepingOpsService, roomOpsService } from '../../../services/operations';

const fmtNGN = (v: number | string) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(Number(v || 0));

const todayDate = () => new Date().toISOString().slice(0, 10);

const SectionHeading = ({ title, subtitle }: { title: string; subtitle: string }) => (
  <Box sx={{ mb: 3 }}>
    <Typography variant="h4" sx={{ fontWeight: 700 }}>{title}</Typography>
    <Typography variant="body2" color="text.secondary">{subtitle}</Typography>
  </Box>
);

const ReportFilters = ({
  startDate,
  endDate,
  onStart,
  onEnd,
  onRefresh
}: {
  startDate: string;
  endDate: string;
  onStart: (value: string) => void;
  onEnd: (value: string) => void;
  onRefresh: () => void;
}) => (
  <Paper sx={{ p: 2, mb: 2 }}>
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
      <TextField type="date" label="Start Date" InputLabelProps={{ shrink: true }} value={startDate} onChange={(event) => onStart(event.target.value)} />
      <TextField type="date" label="End Date" InputLabelProps={{ shrink: true }} value={endDate} onChange={(event) => onEnd(event.target.value)} />
      <Button variant="contained" onClick={onRefresh}>Refresh</Button>
    </Stack>
  </Paper>
);

export const OccupancyReportPage = () => {
  const [startDate, setStartDate] = useState(todayDate());
  const [endDate, setEndDate] = useState(todayDate());
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<{ totalRooms: number; occupiedRooms: number; occupancyRate: string | number; bookings?: unknown[] } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setReport(await dashboardService.getOccupancyReport(startDate, endDate));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const data = useMemo(() => {
    if (!report) {
      return [];
    }

    return [
      { name: 'Occupied', value: report.occupiedRooms },
      { name: 'Vacant', value: Math.max(report.totalRooms - report.occupiedRooms, 0) }
    ];
  }, [report]);

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} mb={2}>
          <SectionHeading title="Occupancy Report" subtitle="Occupancy distribution across selected date window." />
          <ReportDownloadButton
            title="Occupancy Report"
            subtitle={`${startDate} → ${endDate}`}
            columns={[
              { key: 'name', label: 'Status' },
              { key: 'value', label: 'Rooms', align: 'right' }
            ]}
            rows={data}
            totals={
              report
                ? [
                    { label: 'Total Rooms', value: report.totalRooms },
                    { label: 'Occupancy', value: `${report.occupancyRate || 0}%` }
                  ]
                : []
            }
            disabled={loading}
          />
        </Stack>
        <ReportFilters startDate={startDate} endDate={endDate} onStart={setStartDate} onEnd={setEndDate} onRefresh={() => void load()} />

        {loading ? (
          <Paper><LogoLoader label="Crunching occupancy" inline minHeight={260} /></Paper>
        ) : (
          <>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}><Paper sx={{ p: 2 }}><Typography color="textSecondary">Total Rooms</Typography><Typography variant="h5" sx={{ fontWeight: 700 }}>{report?.totalRooms || 0}</Typography></Paper></Grid>
              <Grid item xs={12} md={4}><Paper sx={{ p: 2 }}><Typography color="textSecondary">Occupied Rooms</Typography><Typography variant="h5" sx={{ fontWeight: 700 }}>{report?.occupiedRooms || 0}</Typography></Paper></Grid>
              <Grid item xs={12} md={4}><Paper sx={{ p: 2 }}><Typography color="textSecondary">Occupancy %</Typography><Typography variant="h5" sx={{ fontWeight: 700 }}>{report?.occupancyRate || 0}%</Typography></Paper></Grid>
            </Grid>

            <Paper sx={{ mt: 2, p: 2, height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data} dataKey="value" nameKey="name" outerRadius={95} label>
                    <Cell fill="#16876A" />
                    <Cell fill="#C49355" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </Paper>
          </>
        )}
      </Container>
    </Layout>
  );
};

export const RevenueReportPage = () => {
  const [startDate, setStartDate] = useState(todayDate());
  const [endDate, setEndDate] = useState(todayDate());
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<{ totalRevenue: number; roomRevenue: number; posRevenue: number; transactions?: Array<{ id: string; amount: number; createdAt: string }> } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setReport(await dashboardService.getRevenueReport(startDate, endDate));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chartRows = useMemo(
    () => [
      { name: 'Room', value: report?.roomRevenue || 0 },
      { name: 'POS', value: report?.posRevenue || 0 }
    ],
    [report]
  );

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} mb={2}>
          <SectionHeading title="Revenue Report" subtitle="Revenue breakdown by operational source." />
          <ReportDownloadButton
            title="Revenue Report"
            subtitle={`${startDate} → ${endDate}`}
            columns={[
              { key: 'id', label: 'Transaction ID' },
              { key: 'amount', label: 'Amount', format: (v) => fmtNGN(v), align: 'right' },
              { key: 'createdAt', label: 'Date', format: (v) => new Date(v).toLocaleString() }
            ]}
            rows={report?.transactions || []}
            totals={
              report
                ? [
                    { label: 'Total Revenue', value: report.totalRevenue, format: (v) => fmtNGN(v) },
                    { label: 'Room Revenue', value: report.roomRevenue, format: (v) => fmtNGN(v) },
                    { label: 'POS Revenue', value: report.posRevenue, format: (v) => fmtNGN(v) }
                  ]
                : []
            }
            disabled={loading}
          />
        </Stack>
        <ReportFilters startDate={startDate} endDate={endDate} onStart={setStartDate} onEnd={setEndDate} onRefresh={() => void load()} />

        {loading ? (
          <Paper><LogoLoader label="Calculating revenue" inline minHeight={260} /></Paper>
        ) : (
          <>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} md={4}><Paper sx={{ p: 2 }}><Typography color="textSecondary">Total Revenue</Typography><Typography variant="h5" sx={{ fontWeight: 700 }} className="mono">{fmtNGN(report?.totalRevenue || 0)}</Typography></Paper></Grid>
              <Grid item xs={12} md={4}><Paper sx={{ p: 2 }}><Typography color="textSecondary">Room Revenue</Typography><Typography variant="h5" sx={{ fontWeight: 700 }} className="mono">{fmtNGN(report?.roomRevenue || 0)}</Typography></Paper></Grid>
              <Grid item xs={12} md={4}><Paper sx={{ p: 2 }}><Typography color="textSecondary">POS Revenue</Typography><Typography variant="h5" sx={{ fontWeight: 700 }} className="mono">{fmtNGN(report?.posRevenue || 0)}</Typography></Paper></Grid>
            </Grid>

            <Paper sx={{ p: 2, height: 320, mb: 2 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartRows}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#0F2A44" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Paper>

            <Paper>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Transaction ID</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Amount</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(report?.transactions || []).map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell className="mono">{row.id}</TableCell>
                      <TableCell align="right" className="mono">{fmtNGN(row.amount)}</TableCell>
                      <TableCell>{new Date(row.createdAt).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                  {(!report?.transactions || report.transactions.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={3}>
                        <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
                          No transactions in this period.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Paper>
          </>
        )}
      </Container>
    </Layout>
  );
};

export const HousekeepingReportPage = () => {
  const [loading, setLoading] = useState(true);
  const [roomStatuses, setRoomStatuses] = useState<Record<string, number>>({});
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({});

  const load = async () => {
    setLoading(true);
    try {
      const [rooms, tasks] = await Promise.all([roomOpsService.listRooms(), housekeepingOpsService.listTasks()]);

      const statusSummary = rooms.reduce<Record<string, number>>((acc, room) => {
        acc[room.status] = (acc[room.status] || 0) + 1;
        return acc;
      }, {});

      const taskSummary = tasks.reduce<Record<string, number>>((acc, task) => {
        acc[task.status] = (acc[task.status] || 0) + 1;
        return acc;
      }, {});

      setRoomStatuses(statusSummary);
      setTaskCounts(taskSummary);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const roomChart = Object.entries(roomStatuses).map(([name, value]) => ({ name, value }));
  const downloadRows = [
    ...roomChart.map((r) => ({ category: 'Room status', label: r.name, count: r.value })),
    ...Object.entries(taskCounts).map(([name, count]) => ({ category: 'Task', label: name, count }))
  ];

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} mb={2}>
          <SectionHeading title="Housekeeping Report" subtitle="Room readiness and task progression overview." />
          <ReportDownloadButton
            title="Housekeeping Report"
            subtitle={`Generated ${new Date().toLocaleDateString()}`}
            columns={[
              { key: 'category', label: 'Category' },
              { key: 'label', label: 'Status' },
              { key: 'count', label: 'Count', align: 'right' }
            ]}
            rows={downloadRows}
            disabled={loading}
          />
        </Stack>

        {loading ? (
          <Paper><LogoLoader label="Loading rooms & tasks" inline minHeight={260} /></Paper>
        ) : (
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, height: 320 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>Room Status Mix</Typography>
                <ResponsiveContainer width="100%" height="85%">
                  <PieChart>
                    <Pie data={roomChart} dataKey="value" nameKey="name" outerRadius={90} label>
                      {roomChart.map((entry, idx) => (
                        <Cell key={entry.name} fill={['#16876A', '#C49355', '#B14040', '#0F2A44', '#94A3B8'][idx % 5]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>

            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>Task Pipeline</Typography>
                <Stack spacing={1}>
                  <Typography><strong>To Do:</strong> {taskCounts.TODO || 0}</Typography>
                  <Typography><strong>In Progress:</strong> {taskCounts.IN_PROGRESS || 0}</Typography>
                  <Typography><strong>Done:</strong> {taskCounts.DONE || 0}</Typography>
                </Stack>
              </Paper>
            </Grid>
          </Grid>
        )}
      </Container>
    </Layout>
  );
};

export const PosReportPage = () => {
  const [orders, setOrders] = useState<PosOrder[]>([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setOrders(await posService.getOrders());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const visibleOrders = useMemo(() => {
    if (statusFilter === 'ALL') {
      return orders;
    }
    return orders.filter((order) => order.orderStatus === statusFilter);
  }, [orders, statusFilter]);

  const totals = useMemo(() => {
    return visibleOrders.reduce(
      (acc, order) => {
        acc.count += 1;
        acc.total += Number(order.total || 0);
        acc[order.orderStatus] = (acc[order.orderStatus] || 0) + 1;
        return acc;
      },
      { count: 0, total: 0 } as { count: number; total: number; [key: string]: number }
    );
  }, [visibleOrders]);

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} mb={2}>
          <SectionHeading title="POS Report" subtitle="Outlet orders, status split and sales totals." />
          <ReportDownloadButton
            title="POS Report"
            subtitle={statusFilter === 'ALL' ? 'All statuses' : `Status: ${statusFilter}`}
            columns={[
              { key: 'orderNumber', label: 'Order #' },
              { key: 'outlet', label: 'Outlet', format: (_, row) => (row as PosOrder).outlet?.name || (row as PosOrder).outletId },
              { key: 'tableNumber', label: 'Table', format: (v) => v || '—' },
              { key: 'orderType', label: 'Type' },
              { key: 'orderStatus', label: 'Status' },
              { key: 'total', label: 'Total', format: (v) => fmtNGN(v), align: 'right' },
              { key: 'createdAt', label: 'Created', format: (v) => new Date(v).toLocaleString() }
            ]}
            rows={visibleOrders}
            totals={[
              { label: 'Orders', value: totals.count },
              { label: 'Gross Total', value: totals.total, format: (v) => fmtNGN(v) }
            ]}
            disabled={loading}
          />
        </Stack>

        <Paper sx={{ p: 2, mb: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>
            <TextField select label="Status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} sx={{ minWidth: 200 }}>
              <MenuItem value="ALL">All</MenuItem>
              <MenuItem value="OPEN">OPEN</MenuItem>
              <MenuItem value="SENT_TO_KITCHEN">SENT_TO_KITCHEN</MenuItem>
              <MenuItem value="COMPLETED">COMPLETED</MenuItem>
              <MenuItem value="VOIDED">VOIDED</MenuItem>
            </TextField>
            <Button variant="outlined" onClick={() => void load()}>Refresh</Button>
            <Typography variant="body2"><strong>Orders:</strong> {totals.count}</Typography>
            <Typography variant="body2"><strong>Total:</strong> {fmtNGN(totals.total)}</Typography>
          </Stack>
        </Paper>

        {loading ? (
          <Paper><LogoLoader label="Loading POS orders" inline minHeight={260} /></Paper>
        ) : (
          <Paper>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Order #</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Outlet</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Table</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Total</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Created</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleOrders.map((order) => (
                  <TableRow key={order.id} hover>
                    <TableCell className="mono">{order.orderNumber}</TableCell>
                    <TableCell>{order.outlet?.name || order.outletId}</TableCell>
                    <TableCell>{order.tableNumber || '—'}</TableCell>
                    <TableCell>{order.orderType}</TableCell>
                    <TableCell>{order.orderStatus}</TableCell>
                    <TableCell align="right" className="mono">{fmtNGN(order.total)}</TableCell>
                    <TableCell>{new Date(order.createdAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
                {visibleOrders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
                        No POS orders found.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>
        )}
      </Container>
    </Layout>
  );
};

const downloadJson = (fileName: string, payload: unknown) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);
};

export const CustomReportBuilderPage = () => {
  const [module, setModule] = useState<'PMS' | 'POS' | 'HOUSEKEEPING' | 'FINANCE'>('PMS');
  const [startDate, setStartDate] = useState(todayDate());
  const [endDate, setEndDate] = useState(todayDate());
  const [preview, setPreview] = useState<unknown>(null);

  const build = async () => {
    if (module === 'PMS') {
      setPreview(await dashboardService.getOccupancyReport(startDate, endDate));
      return;
    }

    if (module === 'POS') {
      setPreview(await posService.getOrders());
      return;
    }

    if (module === 'HOUSEKEEPING') {
      const [rooms, tasks] = await Promise.all([roomOpsService.listRooms(), housekeepingOpsService.listTasks()]);
      setPreview({ rooms, tasks });
      return;
    }

    const financeSummary: DashboardMetrics = await dashboardService.getMetrics();
    setPreview(financeSummary);
  };

  useEffect(() => {
    void build();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module]);

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <SectionHeading title="Custom Report Builder" subtitle="Compose module snapshots and export JSON for downstream analysis." />

        <Paper sx={{ p: 2, mb: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField select label="Module" value={module} onChange={(event) => setModule(event.target.value as 'PMS' | 'POS' | 'HOUSEKEEPING' | 'FINANCE')} sx={{ minWidth: 180 }}>
              <MenuItem value="PMS">PMS</MenuItem>
              <MenuItem value="POS">POS</MenuItem>
              <MenuItem value="HOUSEKEEPING">Housekeeping</MenuItem>
              <MenuItem value="FINANCE">Finance</MenuItem>
            </TextField>
            <TextField type="date" label="Start" InputLabelProps={{ shrink: true }} value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            <TextField type="date" label="End" InputLabelProps={{ shrink: true }} value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            <Button variant="contained" onClick={() => void build()}>Build</Button>
            <Button variant="outlined" onClick={() => downloadJson(`custom-report-${module.toLowerCase()}.json`, preview)}>Export JSON</Button>
          </Stack>
        </Paper>

        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>Preview</Typography>
          <Typography component="pre" sx={{ whiteSpace: 'pre-wrap', m: 0, fontSize: 13 }}>
            {JSON.stringify(preview, null, 2)}
          </Typography>
        </Paper>
      </Container>
    </Layout>
  );
};
