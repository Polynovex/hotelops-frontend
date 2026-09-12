import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Fuse from 'fuse.js';
import {
  Alert, Box, Button, Chip, Container, Divider, InputAdornment, Paper, Stack,
  Tab, Tabs, TextField, Typography, Accordion, AccordionSummary, AccordionDetails
} from '@mui/material';
import SearchRounded from '@mui/icons-material/SearchRounded';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import WarningAmberRounded from '@mui/icons-material/WarningAmberRounded';
import LaunchRounded from '@mui/icons-material/LaunchRounded';
import Layout from '../../components/Layout';
import { PageHeader } from '../../components/premium';
import { CATEGORIES, DIAGNOSTICS, Diagnostic, Severity } from '../../data/diagnostics';
import { PROCESS_FLOWS } from '../../data/processFlows';
import { MermaidDiagram } from '../../components/support/MermaidDiagram';

/**
 * The support desk's first screen.
 *
 * Built around one assumption: the agent is on a call, the hotel is waiting,
 * and they have somewhere between ten and sixty seconds. So the search box is
 * the page — it takes a pasted error code, a log fragment, or the words the
 * caller actually used, and it searches all three at once.
 *
 * The content is bundled rather than fetched. An agent diagnosing an outage
 * should not be blocked by the API they are diagnosing.
 */

const SEVERITY_COLOUR: Record<Severity, 'error' | 'warning' | 'info' | 'default'> = {
  P1: 'error', P2: 'warning', P3: 'info', P4: 'default'
};

const SEVERITY_MEANING: Record<Severity, string> = {
  P1: 'Page engineering now',
  P2: 'Engineering within the hour',
  P3: 'Raise a ticket',
  P4: 'Cosmetic or a question'
};

export default function SupportPortal() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('All');
  const [tab, setTab] = useState(0);
  const navigate = useNavigate();

  /*
   * Weighted so a pasted error code wins outright.
   *
   * `codes` is the highest-signal field by a distance: an agent who has one is
   * holding the answer already. Symptom and tags are weighted next because
   * that is how a caller describes the problem. Resolution text is searchable
   * but weakest — matching there usually means the query was vague.
   *
   * threshold 0.4 is deliberately loose: agents mistype error codes under
   * pressure, and a near miss should still surface the row.
   */
  const fuse = useMemo(
    () =>
      new Fuse(DIAGNOSTICS, {
        keys: [
          { name: 'codes', weight: 3 },
          { name: 'symptom', weight: 2 },
          { name: 'tags', weight: 2 },
          { name: 'cause', weight: 1 },
          { name: 'category', weight: 1 },
          { name: 'resolution', weight: 0.5 }
        ],
        threshold: 0.4,
        ignoreLocation: true,
        minMatchCharLength: 2
      }),
    []
  );

  const results = useMemo(() => {
    const base = query.trim()
      ? fuse.search(query.trim()).map((hit) => hit.item)
      : DIAGNOSTICS;
    return category === 'All' ? base : base.filter((d) => d.category === category);
  }, [query, category, fuse]);

  const flowResults = useMemo(() => {
    if (!query.trim()) return PROCESS_FLOWS;
    const needle = query.trim().toLowerCase();
    return PROCESS_FLOWS.filter(
      (flow) =>
        flow.title.toLowerCase().includes(needle) ||
        flow.summary.toLowerCase().includes(needle) ||
        flow.tags.some((tag) => tag.includes(needle))
    );
  }, [query]);

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <PageHeader
          title="Support desk"
          subtitle="Paste an error code, or describe what the caller is seeing."
        />

        <TextField
          fullWidth
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="JWT_EXPIRED · paid but shows unpaid · 429 · room stuck · P2024"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRounded />
              </InputAdornment>
            )
          }}
          sx={{ mb: 2, '& .MuiInputBase-root': { fontSize: 18, py: 0.5 } }}
        />

        <Tabs value={tab} onChange={(_e, value) => setTab(value)} sx={{ mb: 2 }}>
          <Tab label={`Diagnostics (${results.length})`} />
          <Tab label={`Process flows (${flowResults.length})`} />
        </Tabs>

        {tab === 0 && (
          <>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
              {['All', ...CATEGORIES].map((name) => (
                <Chip
                  key={name}
                  label={name}
                  size="small"
                  color={category === name ? 'primary' : 'default'}
                  variant={category === name ? 'filled' : 'outlined'}
                  onClick={() => setCategory(name)}
                />
              ))}
            </Stack>

            {results.length === 0 && (
              <Alert severity="info">
                Nothing matches “{query}”. Try the raw error code, the HTTP status,
                or a few words from what the caller said. If this is genuinely new,
                add it to <code>src/data/diagnostics.ts</code> once it is solved —
                the next person will be looking for it.
              </Alert>
            )}

            {results.map((item) => (
              <DiagnosticCard key={item.id} item={item} onNavigate={navigate} />
            ))}
          </>
        )}

        {tab === 1 &&
          flowResults.map((flow) => (
            <Paper key={flow.id} variant="outlined" sx={{ p: { xs: 2, sm: 3 }, mb: 2 }}>
              <Typography variant="h6" fontWeight={700}>{flow.title}</Typography>
              <Typography color="text.secondary" sx={{ mb: 2 }}>{flow.summary}</Typography>

              <MermaidDiagram chart={flow.diagram} id={`flow-${flow.id}`} />

              <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                Where this usually stops
              </Typography>
              <Stack spacing={1}>
                {flow.failurePoints.map((point) => (
                  <Box key={point.step} sx={{ pl: 1.5, borderLeft: 3, borderColor: 'warning.main' }}>
                    <Typography variant="body2" fontWeight={600}>{point.step}</Typography>
                    <Typography variant="body2" color="text.secondary">{point.note}</Typography>
                    {point.diagnosticId && (
                      <Button
                        size="small"
                        onClick={() => {
                          const match = DIAGNOSTICS.find((d) => d.id === point.diagnosticId);
                          if (match) {
                            setQuery(match.codes[0] ?? match.symptom);
                            setTab(0);
                          }
                        }}
                      >
                        Show the fix
                      </Button>
                    )}
                  </Box>
                ))}
              </Stack>
            </Paper>
          ))}
      </Container>
    </Layout>
  );
}

function DiagnosticCard({
  item,
  onNavigate
}: {
  item: Diagnostic;
  onNavigate: (to: string) => void;
}) {
  return (
    <Accordion defaultExpanded={false} sx={{ mb: 1 }}>
      <AccordionSummary expandIcon={<ExpandMoreRounded />}>
        <Box sx={{ width: '100%' }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Chip size="small" label={item.category} variant="outlined" />
            <Chip
              size="small"
              label={item.severity}
              color={SEVERITY_COLOUR[item.severity]}
              title={SEVERITY_MEANING[item.severity]}
            />
            <Typography fontWeight={600}>{item.symptom}</Typography>
          </Stack>
          <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }} flexWrap="wrap" useFlexGap>
            {item.codes.map((code) => (
              <Chip
                key={code}
                size="small"
                label={code}
                sx={{ fontFamily: 'monospace', fontSize: 11 }}
              />
            ))}
          </Stack>
        </Box>
      </AccordionSummary>

      <AccordionDetails>
        <Typography variant="subtitle2">Why it happens</Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>{item.cause}</Typography>

        {item.caution && (
          <Alert severity="warning" icon={<WarningAmberRounded />} sx={{ mb: 2 }}>
            {item.caution}
          </Alert>
        )}

        <Typography variant="subtitle2">What to do</Typography>
        <Box component="ol" sx={{ pl: 2.5, mt: 0.5, mb: 2 }}>
          {item.resolution.map((step) => (
            <Typography component="li" key={step} sx={{ mb: 0.5 }}>{step}</Typography>
          ))}
        </Box>

        {item.actions?.length ? (
          <>
            <Divider sx={{ mb: 1.5 }} />
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {item.actions.map((action) => (
                <Button
                  key={action.to}
                  size="small"
                  variant="outlined"
                  endIcon={<LaunchRounded />}
                  onClick={() => onNavigate(action.to)}
                >
                  {action.label}
                </Button>
              ))}
            </Stack>
          </>
        ) : null}
      </AccordionDetails>
    </Accordion>
  );
}
