import Layout from '../../components/Layout';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Container, Dialog, DialogActions,
  DialogContent, DialogTitle, FormControlLabel, Grid, IconButton, MenuItem,
  Paper, Snackbar, Stack, Switch, TextField, Tooltip, Typography
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ArticleIcon from '@mui/icons-material/Article';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { api } from '../../services/api';
import { EmptyState, MetricCard, PageHeader } from '../../components/premium';
import { getApiErrorMessage } from '../../utils/apiError';

type Block =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; text: string }
  | { type: 'callout'; text: string }
  | { type: 'list'; items: string[] };

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body: Block[];
  category: string;
  readMinutes: number;
  isPublished: boolean;
  publishedAt: string | null;
  sortOrder: number;
}

const CATEGORIES = ['Getting started', 'Operations', 'Revenue', 'Staff', 'Compliance'];

const BLANK = {
  title: '', summary: '', category: 'Operations', readMinutes: 5,
  bodyText: '', isPublished: false, sortOrder: 0
};

/**
 * Turns the plain-text editor into the block structure the API stores.
 *
 * The body is deliberately not HTML. Authors write plain paragraphs separated
 * by blank lines, with two lightweight conventions, and the website renders
 * each block itself — so nothing anybody types here can put markup, or a
 * script, onto a public page.
 *
 *   ## A line starting with two hashes  → heading
 *   - lines starting with a dash        → a bulleted list
 *   > a line starting with an angle     → a callout
 *   anything else                       → a paragraph
 */
export const textToBlocks = (text: string): Block[] => {
  const blocks: Block[] = [];

  for (const chunk of text.split(/\n\s*\n/)) {
    const lines = chunk.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    // A run of dashed lines is one list, however many lines it holds.
    if (lines.every((l) => l.startsWith('- '))) {
      blocks.push({ type: 'list', items: lines.map((l) => l.slice(2).trim()).filter(Boolean) });
      continue;
    }

    for (const line of lines) {
      if (line.startsWith('## ')) blocks.push({ type: 'heading', text: line.slice(3).trim() });
      else if (line.startsWith('> ')) blocks.push({ type: 'callout', text: line.slice(2).trim() });
      else blocks.push({ type: 'paragraph', text: line });
    }
  }

  return blocks;
};

/** The inverse, so editing an existing post shows what was written. */
export const blocksToText = (blocks: Block[] | undefined): string => {
  if (!Array.isArray(blocks)) return '';
  return blocks
    .map((block) => {
      if (block.type === 'heading') return `## ${block.text}`;
      if (block.type === 'callout') return `> ${block.text}`;
      if (block.type === 'list') return block.items.map((i) => `- ${i}`).join('\n');
      return block.text;
    })
    .join('\n\n');
};

/**
 * Blog management for the super admin.
 *
 * Mirrors the testimonials screen: draft here, publish when ready, and only
 * published posts reach the marketing site. Publishing is a switch rather than
 * a separate action so the state is always visible in the list.
 */
const BlogPosts = () => {
  const [items, setItems] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...BLANK });
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<BlogPost | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/blog');
      setItems(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load posts.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(
    () => ({
      total: items.length,
      published: items.filter((p) => p.isPublished).length,
      draft: items.filter((p) => !p.isPublished).length
    }),
    [items]
  );

  const openNew = () => {
    setEditingId(null);
    setForm({ ...BLANK });
    setOpen(true);
  };

  const openEdit = (post: BlogPost) => {
    setEditingId(post.id);
    setForm({
      title: post.title,
      summary: post.summary,
      category: post.category,
      readMinutes: post.readMinutes,
      bodyText: blocksToText(post.body),
      isPublished: post.isPublished,
      sortOrder: post.sortOrder
    });
    setOpen(true);
  };

  const save = async () => {
    const blocks = textToBlocks(form.bodyText);

    if (!form.title.trim() || !form.summary.trim()) {
      setError('A title and a summary are required.');
      return;
    }
    if (blocks.length === 0) {
      setError('Write the article body before saving.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        summary: form.summary.trim(),
        category: form.category,
        readMinutes: Number(form.readMinutes) || 5,
        sortOrder: Number(form.sortOrder) || 0,
        isPublished: form.isPublished,
        body: blocks
      };

      if (editingId) await api.put(`/admin/blog/${editingId}`, payload);
      else await api.post('/admin/blog', payload);

      setToast(editingId ? 'Post updated' : 'Post created');
      setOpen(false);
      setError('');
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save the post.'));
    } finally {
      setSaving(false);
    }
  };

  /** Publishing is the one action with an immediate public effect. */
  const togglePublished = async (post: BlogPost) => {
    try {
      await api.put(`/admin/blog/${post.id}`, { isPublished: !post.isPublished });
      setToast(post.isPublished ? 'Post withdrawn from the website' : 'Post published to the website');
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not change the published state.'));
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await api.delete(`/admin/blog/${pendingDelete.id}`);
      setToast('Post deleted');
      setPendingDelete(null);
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not delete the post.'));
    }
  };

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <PageHeader
          title="Blog"
          subtitle="Articles for the marketing site. Only published posts appear publicly."
          actions={
            <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>
              New post
            </Button>
          }
        />

        {error ? (
          <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : null}

        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={4}>
            <MetricCard label="Total posts" value={counts.total} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <MetricCard label="Live on the site" value={counts.published} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <MetricCard label="Drafts" value={counts.draft} />
          </Grid>
        </Grid>

        {loading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 240 }}>
            <CircularProgress />
          </Box>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<ArticleIcon />}
            title="No posts yet"
            description="Write the first article. It stays a draft until you publish it."
            action={
              <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>
                New post
              </Button>
            }
          />
        ) : (
          <Stack spacing={1.5}>
            {items.map((post) => (
              <Paper key={post.id} variant="outlined" sx={{ p: 2.25, borderRadius: 2 }}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={2}
                  alignItems={{ xs: 'flex-start', md: 'center' }}
                  justifyContent="space-between"
                >
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                      <Chip size="small" label={post.category} />
                      <Chip
                        size="small"
                        color={post.isPublished ? 'success' : 'default'}
                        label={post.isPublished ? 'Live' : 'Draft'}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {post.readMinutes} min read
                      </Typography>
                    </Stack>
                    <Typography sx={{ fontWeight: 700 }}>{post.title}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                      {post.summary}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontFamily: 'monospace', display: 'block', mt: 0.75 }}
                    >
                      /{post.slug}
                    </Typography>
                  </Box>

                  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0 }}>
                    <Tooltip title={post.isPublished ? 'Withdraw from the website' : 'Publish to the website'}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={post.isPublished}
                            onChange={() => void togglePublished(post)}
                          />
                        }
                        label={post.isPublished ? 'Published' : 'Publish'}
                        sx={{ mr: 0.5 }}
                      />
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton onClick={() => openEdit(post)}>
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton color="error" onClick={() => setPendingDelete(post)}>
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}

        {/* ── Editor ───────────────────────────────────────────────────── */}
        <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>{editingId ? 'Edit post' : 'New post'}</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  helperText="The URL is built from this the first time you save."
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Summary"
                  value={form.summary}
                  onChange={(e) => setForm({ ...form, summary: e.target.value })}
                  helperText="One sentence. Shown on the card and used as the search description."
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  select
                  fullWidth
                  label="Category"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  {CATEGORIES.map((c) => (
                    <MenuItem key={c} value={c}>
                      {c}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={6} sm={4}>
                <TextField
                  fullWidth
                  type="number"
                  label="Read time (minutes)"
                  value={form.readMinutes}
                  onChange={(e) => setForm({ ...form, readMinutes: Number(e.target.value) })}
                />
              </Grid>
              <Grid item xs={6} sm={4}>
                <TextField
                  fullWidth
                  type="number"
                  label="Sort order"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
                  helperText="Lower shows first."
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  minRows={14}
                  label="Article"
                  value={form.bodyText}
                  onChange={(e) => setForm({ ...form, bodyText: e.target.value })}
                  helperText={
                    'Blank line between paragraphs. Start a line with ## for a heading, ' +
                    '- for a bullet, or > for a highlighted note. No HTML — the site renders ' +
                    'the structure itself.'
                  }
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.isPublished}
                      onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
                    />
                  }
                  label="Publish to the website when saved"
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={() => void save()} disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create post'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* ── Delete confirmation ──────────────────────────────────────── */}
        <Dialog open={Boolean(pendingDelete)} onClose={() => setPendingDelete(null)}>
          <DialogTitle>Delete this post?</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary">
              “{pendingDelete?.title}” will be removed permanently. If it is live, it
              disappears from the website immediately.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setPendingDelete(null)}>Cancel</Button>
            <Button color="error" variant="contained" onClick={() => void confirmDelete()}>
              Delete
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={Boolean(toast)}
          autoHideDuration={3500}
          onClose={() => setToast('')}
          message={toast}
          action={
            toast.includes('published') ? (
              <Button
                size="small"
                color="inherit"
                endIcon={<OpenInNewIcon />}
                href="https://hotelopx.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                View site
              </Button>
            ) : undefined
          }
        />
      </Container>
    </Layout>
  );
};

export default BlogPosts;
