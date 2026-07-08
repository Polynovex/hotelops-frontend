import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,

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
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../../../components/Layout';
import LogoLoader from '../../../components/LogoLoader';
import DataTable from '../../../components/common/DataTable';
import { useAuthStore } from '../../../store/authStore';
import {
  ProfileCategory,
  ProfileDocumentRecord,
  ProfileNoteRecord,
  ProfileQuery,
  ProfileRecord,
  profileOpsService
} from '../../../services/operations';

type ProfileListVariant = ProfileCategory | 'ALL';

const typeOptions: Array<{ value: ProfileListVariant; label: string }> = [
  { value: 'ALL', label: 'All Profiles' },
  { value: 'INDIVIDUAL', label: 'Individual' },
  { value: 'COMPANY', label: 'Company' },
  { value: 'TRAVEL_AGENT', label: 'Travel Agent' },
  { value: 'SOURCE', label: 'Source' },
  { value: 'GROUP', label: 'Group' }
];

const tagColor = (type: ProfileCategory) => {
  if (type === 'INDIVIDUAL') return 'info';
  if (type === 'COMPANY') return 'primary';
  if (type === 'TRAVEL_AGENT') return 'success';
  if (type === 'SOURCE') return 'warning';
  return 'secondary';
};

const ProfileListCore = ({
  title,
  subtitle,
  fixedType
}: {
  title: string;
  subtitle: string;
  fixedType?: ProfileCategory;
}) => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isReceptionist = String(user?.role || '').toUpperCase() === 'RECEPTIONIST';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profiles, setProfiles] = useState<ProfileRecord[]>([]);
  const [query, setQuery] = useState('');
  const [type, setType] = useState<ProfileListVariant>(fixedType || 'ALL');
  const [onlyBlacklisted, setOnlyBlacklisted] = useState(false);

  const loadProfiles = async () => {
    setLoading(true);
    setError('');

    try {
      const payload: ProfileQuery = {
        type: fixedType || type,
        query: query.trim() || undefined,
        onlyBlacklisted
      };
      setProfiles(await profileOpsService.listProfiles(payload));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load profiles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProfiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, fixedType, onlyBlacklisted]);

  const visibleProfiles = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return profiles;
    }

    return profiles.filter((profile) => {
      const raw = `${profile.name} ${profile.email || ''} ${profile.phone || ''}`.toLowerCase();
      return raw.includes(q);
    });
  }, [profiles, query]);

  const blacklistProfile = async (profile: ProfileRecord) => {
    const reason = window.prompt('Enter blacklist reason', profile.blacklistReason || 'Policy violation');
    if (!reason) {
      return;
    }

    await profileOpsService.blacklistProfile(profile.id, reason);
    await loadProfiles();
  };

  const mergeProfiles = async () => {
    const sourceId = window.prompt('Source profile ID');
    const targetId = window.prompt('Target profile ID');
    if (!sourceId || !targetId || sourceId === targetId) {
      return;
    }

    await profileOpsService.mergeProfiles(sourceId, targetId);
    await loadProfiles();
  };

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} spacing={2} sx={{ mb: 3 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>{title}</Typography>
            <Typography variant="body2" color="text.secondary">{subtitle}</Typography>
          </Box>
          <Stack direction="row" spacing={1.5}>
            <Button variant="outlined" onClick={() => void loadProfiles()} disabled={loading}>Refresh</Button>
            {isReceptionist && (
              <>
                <Button variant="outlined" color="warning" onClick={() => void mergeProfiles()}>Merge Profiles</Button>
                <Button variant="contained" onClick={() => navigate('/business/profiles/individual/create')}>New Profile</Button>
              </>
            )}
          </Stack>
        </Stack>

        {loading && <LogoLoader inline minHeight={160} />}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Paper sx={{ p: 2, mb: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              label="Search"
              placeholder="Name, email, phone"
              fullWidth
            />
            {!fixedType && (
              <TextField
                select
                label="Type"
                value={type}
                onChange={(event) => setType(event.target.value as ProfileListVariant)}
                sx={{ minWidth: 220 }}
              >
                {typeOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                ))}
              </TextField>
            )}
            <TextField
              select
              label="Blacklist"
              value={onlyBlacklisted ? 'YES' : 'ALL'}
              onChange={(event) => setOnlyBlacklisted(event.target.value === 'YES')}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="ALL">All</MenuItem>
              <MenuItem value="YES">Blacklisted Only</MenuItem>
            </TextField>
            <Button variant="contained" onClick={() => void loadProfiles()}>Apply</Button>
          </Stack>
        </Paper>

        <DataTable
          rows={visibleProfiles}
          rowKey={(profile) => profile.id}
          defaultRowsPerPage={10}
          emptyText={loading ? 'Loading profiles...' : 'No profiles found for current filters.'}
          columns={[
            { key: 'name', label: 'Name', minWidth: 200 },
            {
              key: 'type',
              label: 'Type',
              minWidth: 140,
              render: (profile) => (
                <Chip size="small" label={profile.type} color={tagColor(profile.type) as 'default'} />
              )
            },
            {
              key: 'contact',
              label: 'Contact',
              minWidth: 220,
              render: (profile) => (
                <Box>
                  <Typography variant="body2">{profile.email || '—'}</Typography>
                  <Typography variant="caption" color="text.secondary">{profile.phone || '—'}</Typography>
                </Box>
              )
            },
            {
              key: 'vipLevel',
              label: 'VIP',
              minWidth: 100,
              render: (profile) => profile.vipLevel || 'NONE'
            },
            { key: 'totalStays', label: 'Stays', minWidth: 90 },
            {
              key: 'lastVisit',
              label: 'Last Visit',
              minWidth: 130,
              render: (profile) => (profile.lastVisit ? new Date(profile.lastVisit).toLocaleDateString() : '—')
            },
            {
              key: 'action',
              label: 'Action',
              minWidth: 210,
              render: (profile) => (
                <Stack direction="row" spacing={1}>
                  <Button size="small" onClick={() => navigate(`/business/profiles/${profile.id}`)}>View</Button>
                  {isReceptionist && (
                    <Button size="small" color="warning" onClick={() => void blacklistProfile(profile)}>Blacklist</Button>
                  )}
                </Stack>
              )
            }
          ]}
        />
      </Container>
    </Layout>
  );
};

const parseMetadata = (raw: string): Record<string, unknown> => {
  if (!raw.trim()) {
    return {};
  }

  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch (_error) {
    return {};
  }
};

export const CreateProfilePage = () => {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [type, setType] = useState<ProfileCategory>('INDIVIDUAL');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [metadataJson, setMetadataJson] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      if (!name.trim()) {
        throw new Error('Name is required');
      }

      const profile = await profileOpsService.createProfile({
        type,
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        metadata: parseMetadata(metadataJson)
      });

      navigate(`/business/profiles/${profile.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>Create Profile</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Unified profile creation for individual, company, travel agent, source and group records.
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Paper sx={{ p: 3 }}>
          <Box component="form" onSubmit={submit}>
            <Stack spacing={2.5}>
              <TextField select label="Profile Type" value={type} onChange={(event) => setType(event.target.value as ProfileCategory)}>
                <MenuItem value="INDIVIDUAL">Individual</MenuItem>
                <MenuItem value="COMPANY">Company</MenuItem>
                <MenuItem value="TRAVEL_AGENT">Travel Agent</MenuItem>
                <MenuItem value="SOURCE">Source</MenuItem>
                <MenuItem value="GROUP">Group</MenuItem>
              </TextField>

              <TextField label="Name" value={name} onChange={(event) => setName(event.target.value)} required />
              <TextField label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
              <TextField label="Phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
              <TextField
                label="Metadata (JSON)"
                value={metadataJson}
                onChange={(event) => setMetadataJson(event.target.value)}
                multiline
                minRows={4}
                placeholder='{"creditLimit": 2000000}'
              />

              <Stack direction="row" spacing={1.5}>
                <Button variant="outlined" onClick={() => navigate(-1)} disabled={saving}>Cancel</Button>
                <Button type="submit" variant="contained" disabled={saving}>Create Profile</Button>
              </Stack>
            </Stack>
          </Box>
        </Paper>
      </Container>
    </Layout>
  );
};

const ProfileNotesTable = ({ notes }: { notes: ProfileNoteRecord[] }) => {
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
          <TableCell sx={{ fontWeight: 700 }}>Title</TableCell>
          <TableCell sx={{ fontWeight: 700 }}>Content</TableCell>
          <TableCell sx={{ fontWeight: 700 }}>Created</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {notes.map((note) => (
          <TableRow key={note.id}>
            <TableCell>{note.type}</TableCell>
            <TableCell>{note.title}</TableCell>
            <TableCell>{note.content}</TableCell>
            <TableCell>{new Date(note.createdAt).toLocaleString()}</TableCell>
          </TableRow>
        ))}
        {notes.length === 0 && (
          <TableRow>
            <TableCell colSpan={4}>
              <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                No notes yet.
              </Typography>
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
};

export const ProfileDetailPage = () => {
  const { id } = useParams();
  const user = useAuthStore((state) => state.user);
  const isReceptionist = String(user?.role || '').toUpperCase() === 'RECEPTIONIST';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [notes, setNotes] = useState<ProfileNoteRecord[]>([]);
  const [documents, setDocuments] = useState<ProfileDocumentRecord[]>([]);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteType, setNoteType] = useState<ProfileNoteRecord['type']>('GENERAL');

  const load = async (profileId: string) => {
    setLoading(true);
    setError('');

    try {
      const [profileResponse, profileNotes, profileDocuments] = await Promise.all([
        profileOpsService.getProfile(profileId),
        profileOpsService.listNotes(profileId),
        profileOpsService.listDocuments(profileId)
      ]);
      if (!profileResponse) {
        throw new Error('Profile not found');
      }
      setProfile(profileResponse);
      setNotes(profileNotes);
      setDocuments(profileDocuments);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError('Profile ID is missing');
      return;
    }

    void load(id);
  }, [id]);

  const addNote = async () => {
    if (!id || !noteTitle.trim() || !noteContent.trim()) {
      return;
    }

    await profileOpsService.addNote(id, {
      type: noteType,
      title: noteTitle.trim(),
      content: noteContent.trim()
    });

    setShowNoteDialog(false);
    setNoteTitle('');
    setNoteContent('');
    setNotes(await profileOpsService.listNotes(id));
    setDocuments(await profileOpsService.listDocuments(id));
  };

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        {loading && <LogoLoader inline minHeight={160} />}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {profile && (
          <Stack spacing={2}>
            <Paper sx={{ p: 3 }}>
              <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} spacing={2}>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 700 }}>{profile.name}</Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    <Chip label={profile.type} color={tagColor(profile.type) as 'default'} />
                    <Chip label={profile.isBlacklisted ? 'Blacklisted' : 'Active'} color={profile.isBlacklisted ? 'error' : 'success'} />
                  </Stack>
                </Box>

                <Stack direction="row" spacing={1}>
                  {isReceptionist && (
                    <>
                      <Button variant="outlined" onClick={() => setShowNoteDialog(true)}>Add Note</Button>
                      <Button
                        variant="outlined"
                        color="warning"
                        onClick={() => void profileOpsService.blacklistProfile(profile.id, 'Manual blacklist from detail page').then(() => void load(profile.id))}
                      >
                        Blacklist
                      </Button>
                    </>
                  )}
                </Stack>
              </Stack>

              <Stack spacing={1.5} sx={{ mt: 2 }}>
                <Typography variant="body2"><strong>Email:</strong> {profile.email || '—'}</Typography>
                <Typography variant="body2"><strong>Phone:</strong> {profile.phone || '—'}</Typography>
                <Typography variant="body2"><strong>Total Stays:</strong> {profile.totalStays}</Typography>
                <Typography variant="body2"><strong>Last Visit:</strong> {profile.lastVisit ? new Date(profile.lastVisit).toLocaleString() : '—'}</Typography>
                {profile.blacklistReason && <Typography variant="body2"><strong>Blacklist Reason:</strong> {profile.blacklistReason}</Typography>}
              </Stack>
            </Paper>

            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>Profile Notes</Typography>
              <ProfileNotesTable notes={notes} />
            </Paper>

            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>Documents</Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>File</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Size</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Uploaded</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {documents.map((document) => (
                    <TableRow key={document.id}>
                      <TableCell>{document.fileName}</TableCell>
                      <TableCell>{document.fileType}</TableCell>
                      <TableCell>{document.fileSize.toLocaleString()} bytes</TableCell>
                      <TableCell>{new Date(document.uploadedAt).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                  {documents.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4}>
                        <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                          No documents uploaded yet.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Paper>
          </Stack>
        )}
      </Container>

      <Dialog open={showNoteDialog} onClose={() => setShowNoteDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Profile Note</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField select label="Type" value={noteType} onChange={(event) => setNoteType(event.target.value as ProfileNoteRecord['type'])}>
              <MenuItem value="RESERVATION">Reservation</MenuItem>
              <MenuItem value="FINANCIAL">Financial</MenuItem>
              <MenuItem value="GENERAL">General</MenuItem>
              <MenuItem value="HOUSEKEEPING">Housekeeping</MenuItem>
            </TextField>
            <TextField label="Title" value={noteTitle} onChange={(event) => setNoteTitle(event.target.value)} />
            <TextField
              label="Content"
              value={noteContent}
              onChange={(event) => setNoteContent(event.target.value)}
              multiline
              minRows={4}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowNoteDialog(false)}>Cancel</Button>
          <Button onClick={() => void addNote()} variant="contained">Save Note</Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
};

export const ProfileListPage = () => (
  <ProfileListCore
    title="Profile Management"
    subtitle="Search, view, merge and blacklist guest/company/source profiles."
  />
);

export const CompanyProfilesPage = () => (
  <ProfileListCore
    title="Company Profiles"
    subtitle="Corporate accounts with credit and billing metadata."
    fixedType="COMPANY"
  />
);

export const TravelAgentProfilesPage = () => (
  <ProfileListCore
    title="Travel Agent Profiles"
    subtitle="Agency records with commission tracking metadata."
    fixedType="TRAVEL_AGENT"
  />
);

export const SourceProfilesPage = () => (
  <ProfileListCore
    title="Source Profiles"
    subtitle="Referral source profiles for demand tracking and attribution."
    fixedType="SOURCE"
  />
);

export const GroupProfilesPage = () => (
  <ProfileListCore
    title="Group Profiles"
    subtitle="Event and block bookings grouped under one profile."
    fixedType="GROUP"
  />
);
