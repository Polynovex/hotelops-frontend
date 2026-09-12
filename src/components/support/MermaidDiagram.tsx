import { useEffect, useRef, useState } from 'react';
import { Alert, Box, CircularProgress, useTheme } from '@mui/material';

/**
 * Renders a Mermaid diagram, loading Mermaid only when one is on screen.
 *
 * Mermaid is around half a megabyte. Importing it at the top level would put
 * that on every page of the dashboard to serve one route that support agents
 * use, so it is pulled in dynamically the first time a diagram renders and
 * cached by the bundler thereafter.
 *
 * If it fails to load or the diagram will not parse, the source is shown
 * instead. A support agent reading `flowchart TD` is inconvenienced; one
 * staring at an empty box during an incident is stuck.
 */

let mermaidReady: Promise<typeof import('mermaid').default> | null = null;

const loadMermaid = (dark: boolean) => {
  if (!mermaidReady) {
    mermaidReady = import('mermaid').then(({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        theme: dark ? 'dark' : 'default',
        securityLevel: 'strict',
        fontFamily: 'inherit'
      });
      return mermaid;
    });
  }
  return mermaidReady;
};

interface Props {
  chart: string;
  /** Must be unique on the page — Mermaid uses it for the generated SVG's id. */
  id: string;
}

export function MermaidDiagram({ chart, id }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const theme = useTheme();
  const dark = theme.palette.mode === 'dark';

  useEffect(() => {
    let cancelled = false;

    loadMermaid(dark)
      .then((mermaid) => mermaid.render(`${id}-svg`, chart))
      .then(({ svg }) => {
        if (cancelled || !container.current) return;
        container.current.innerHTML = svg;
        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('failed');
      });

    return () => {
      cancelled = true;
    };
  }, [chart, id, dark]);

  if (state === 'failed') {
    return (
      <Alert severity="info" sx={{ '& pre': { m: 0, fontSize: 12, whiteSpace: 'pre-wrap' } }}>
        The diagram could not be drawn. The steps are below in order:
        <pre>{chart}</pre>
      </Alert>
    );
  }

  return (
    <Box
      sx={{
        position: 'relative',
        minHeight: state === 'loading' ? 120 : undefined,
        overflowX: 'auto',
        p: 1,
        bgcolor: 'background.default',
        borderRadius: 1,
        '& svg': { maxWidth: '100%', height: 'auto' }
      }}
    >
      {state === 'loading' && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={22} />
        </Box>
      )}
      <div ref={container} />
    </Box>
  );
}
