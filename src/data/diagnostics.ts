/**
 * The diagnostics matrix, as data.
 *
 * The same content as §8 of SYSTEM_OPERATIONS_PLAYBOOK.md, structured so it can
 * be searched rather than scrolled. Kept here rather than fetched from the API
 * on purpose: an agent diagnosing an outage should not need the API they are
 * diagnosing to be working.
 *
 * When a new failure mode is found in production, add it here *and* to the
 * playbook. An entry that exists only in someone's memory gets rediscovered
 * from scratch by the next person at 2am.
 */

export type DiagnosticCategory =
  | 'Auth'
  | 'Migration'
  | 'Payment'
  | 'Webhook'
  | 'Email'
  | 'API'
  | 'Database'
  | 'Booking';

export type Severity = 'P1' | 'P2' | 'P3' | 'P4';

export interface QuickAction {
  label: string;
  /** In-app route. External links are not offered — agents stay in the tool. */
  to: string;
}

export interface Diagnostic {
  id: string;
  category: DiagnosticCategory;
  /** Error codes, log fragments and HTTP statuses an agent might paste in. */
  codes: string[];
  /** What the person on the phone is describing. */
  symptom: string;
  cause: string;
  /** Ordered. Each step is something the agent can actually do. */
  resolution: string[];
  severity: Severity;
  /** Extra search terms — how people describe this in their own words. */
  tags: string[];
  actions?: QuickAction[];
  /** Shown as a warning box. Use for "do not do the obvious thing". */
  caution?: string;
}

export const DIAGNOSTICS: Diagnostic[] = [
  // ── Auth ────────────────────────────────────────────────────────────────
  {
    id: 'auth-jwt-expired',
    category: 'Auth',
    codes: ['JWT_EXPIRED', 'TOKEN_EXPIRED', '401'],
    symptom: 'Thrown back to the login screen in the middle of a shift.',
    cause:
      'The 15-minute access token expired and the refresh attempt failed — usually because the refresh token was revoked.',
    resolution: [
      'Sign out fully, then sign in again.',
      'If it repeats within minutes, ask whether the password was changed on another device — a password change revokes every session by design.',
      'Check Super Admin → Live Logs, filtered to ERROR, for that user around the time it happened.'
    ],
    severity: 'P3',
    tags: ['logged out', 'session expired', 'keeps signing me out', 'token'],
    actions: [{ label: 'Live Logs', to: '/super-admin/logs' }]
  },
  {
    id: 'auth-mfa-enrolment',
    category: 'Auth',
    codes: ['MFA_ENROLMENT_REQUIRED', '403'],
    symptom: 'Signs in successfully, but every page says forbidden.',
    cause:
      'The role requires two-factor authentication and the account has not enrolled. Sign-in is allowed; everything else is closed until enrolment.',
    resolution: [
      'Send them to Settings → Security → Set up authenticator.',
      'They scan the QR code with Google Authenticator and enter one code.',
      'Access opens immediately — no re-login needed.'
    ],
    severity: 'P3',
    tags: ['forbidden', 'cannot access anything', '2fa', 'authenticator', 'mfa'],
    caution:
      'This is not a permissions bug and must not be "fixed" by changing their role.'
  },
  {
    id: 'auth-mfa-cannot-disable',
    category: 'Auth',
    codes: ['MFA_REQUIRED_FOR_ROLE', '403'],
    symptom: 'A super admin or business admin cannot turn MFA off.',
    cause: 'By design. Roles that govern a whole property, or the whole platform, must keep a second factor.',
    resolution: [
      'Explain that it cannot be switched off for this role.',
      'If they have lost their phone, use recovery codes instead.',
      'If recovery codes are also gone, the account needs a super admin to reset enrolment — escalate.'
    ],
    severity: 'P3',
    tags: ['disable 2fa', 'turn off mfa', 'lost phone', 'recovery codes']
  },
  {
    id: 'auth-redis-outage',
    category: 'Auth',
    codes: ['ConnectionTimeoutError', 'ECONNREFUSED', '500'],
    symptom: 'Nobody at any hotel can sign in. Login returns 500 or hangs.',
    cause:
      'Redis unreachable. Fixed in September 2026 — the client connect never settled, so every request blocked on it and the in-memory fallback never engaged.',
    resolution: [
      'Check Super Admin → System Stats: is Cache showing down?',
      'Sign-in must still work with Redis down. If it does not, this is a regression of a known fault — escalate as P1 immediately.',
      'Confirm REDIS_URL is reachable from the deployed environment.'
    ],
    severity: 'P1',
    tags: ['nobody can login', 'redis', 'cache down', 'total outage'],
    actions: [{ label: 'System Stats', to: '/super-admin/stats' }]
  },

  // ── Migration ───────────────────────────────────────────────────────────
  {
    id: 'migration-missing-header',
    category: 'Migration',
    codes: ['INVALID_MIGRATION_HEADER', 'Required column missing'],
    symptom: 'The upload is refused straight away, before anything is sent.',
    cause: 'A required column is missing or was renamed in the spreadsheet.',
    resolution: [
      'Super Admin → Data Migration → download the template for that entity again.',
      'Compare the header row against the required columns listed on the download panel.',
      'Copy the data into a fresh template rather than renaming columns by hand.'
    ],
    severity: 'P3',
    tags: ['import rejected', 'csv', 'columns', 'header'],
    actions: [{ label: 'Data Migration', to: '/super-admin/data-import' }]
  },
  {
    id: 'migration-ambiguous-date',
    category: 'Migration',
    codes: ['is ambiguous', 'YYYY-MM-DD'],
    symptom: 'Every row with a date is rejected.',
    cause:
      'The file uses DD/MM/YYYY. 05/03/2026 could mean 5 March or 3 May, so the importer refuses it rather than guessing.',
    resolution: [
      'In Excel, select the date column → Format Cells → Custom → type yyyy-mm-dd.',
      'Save as CSV again and re-upload.',
      'Check the result: dates should read like 2026-03-05.'
    ],
    severity: 'P3',
    tags: ['dates rejected', 'dd/mm/yyyy', 'date format', 'ambiguous'],
    caution:
      'Do not ask engineering to accept DD/MM/YYYY. The refusal replaced a parser that guessed American-style and silently moved every booking in the file.'
  },
  {
    id: 'migration-sample-rows',
    category: 'Migration',
    codes: ['G-1001', 'G-1002'],
    symptom: 'Two guests nobody recognises appear after an import.',
    cause: "The template's example rows were left in the file and imported as real records.",
    resolution: [
      'Find the guests named Adaeze Okonkwo and Emeka Bello and delete them.',
      'Check for bookings B-5001 / B-5002 and rooms R-201 / R-202 from the same import.',
      'Tell them the upload screen warns about this before import.'
    ],
    severity: 'P3',
    tags: ['fake guests', 'example rows', 'test data imported']
  },
  {
    id: 'migration-orphan-bookings',
    category: 'Migration',
    codes: ['guestExternalId', 'guest not found'],
    symptom: 'Guests imported fine; every booking failed.',
    cause:
      'Bookings reference guests by externalId. If the guest file had no externalId column, there is nothing for bookings to match against.',
    resolution: [
      'Re-import guests with externalId populated — any stable ID from the old system.',
      'Then import bookings, whose guestExternalId must use the same values.',
      'Order matters: Guests, then Rooms, then Bookings.'
    ],
    severity: 'P2',
    tags: ['bookings failed', 'orphan', 'external id', 'import order']
  },

  // ── Payment ─────────────────────────────────────────────────────────────
  {
    id: 'payment-gateway-not-configured',
    category: 'Payment',
    codes: ['GATEWAY_NOT_CONFIGURED', '409'],
    symptom: '"Pay by card" opens a dialog saying no provider is switched on.',
    cause: 'The hotel has not saved its Paystack or Flutterwave keys, or saved them but left the gateway inactive.',
    resolution: [
      'Business Settings → Payment Integrations.',
      'Confirm both a public key and a secret key are present.',
      'Confirm the Active toggle is on — keys alone are not enough.',
      'Confirm the environment matches the keys: test keys with Live selected will fail.'
    ],
    severity: 'P2',
    tags: ['cannot take card payment', 'paystack', 'flutterwave', 'no provider']
  },
  {
    id: 'payment-webhook-signature',
    category: 'Webhook',
    codes: ['WEBHOOK_SIGNATURE_INVALID', 'Invalid signature', '401'],
    symptom: 'The guest paid and has a receipt from the bank, but the order still shows unpaid.',
    cause:
      'The webhook reached us but its signature did not match the key stored for that hotel — usually the webhook URL points at the wrong environment, or the secret key was rotated without updating HotelOpX.',
    resolution: [
      'In the hotel’s Paystack dashboard, check Settings → Webhooks points at the live API.',
      'Re-save the secret key in Business Settings → Payment Integrations.',
      'On the transaction, use Check payment status — this asks the provider directly and settles it without waiting for another webhook.',
      'Confirm the order flipped to paid before telling the guest anything.'
    ],
    severity: 'P1',
    tags: ['paid but unpaid', 'webhook', 'money taken', 'not marked paid'],
    caution: 'Never mark an order paid by hand before confirming it in the provider dashboard.'
  },
  {
    id: 'payment-amount-mismatch',
    category: 'Payment',
    codes: ['Amount mismatch'],
    symptom: 'A payment succeeded at the provider but was not settled here.',
    cause: 'The provider reported a different amount than the transaction asked for.',
    resolution: [
      'Compare the amount in the provider dashboard against the transaction.',
      'Do not force the settlement — find out why they differ first.',
      'Escalate with both figures and the reference.'
    ],
    severity: 'P2',
    tags: ['wrong amount', 'mismatch', 'not settled'],
    caution: 'This refusal is deliberate. Forcing it writes a figure nobody has reconciled.'
  },

  // ── Email ───────────────────────────────────────────────────────────────
  {
    id: 'email-suppressed',
    category: 'Email',
    codes: ['SuppressedRecipientError', 'RECIPIENT_SUPPRESSED', '409'],
    symptom: 'A staff invitation never arrives, and resending does nothing.',
    cause: 'The address previously hard-bounced or was reported as spam, so it is on the suppression list.',
    resolution: [
      'Super Admin → Blocked Emails, and search for the address.',
      'Read the diagnostic — it says what the receiving server actually returned.',
      'If the address was mistyped and has since been corrected, unblock it. If the mailbox genuinely does not exist, use a different address.'
    ],
    severity: 'P3',
    tags: ['email not received', 'invitation', 'bounced', 'blocked'],
    actions: [{ label: 'Blocked Emails', to: '/super-admin/email-suppressions' }]
  },
  {
    id: 'email-undeliverable-domain',
    category: 'Email',
    codes: ['UndeliverableRecipientError'],
    symptom: 'An invitation is refused the moment it is sent.',
    cause: 'The address uses a reserved test domain — example.com, .test, .invalid, .localhost — which cannot receive mail.',
    resolution: ['Use a real address. The guard exists to stop guaranteed bounces damaging sending reputation.'],
    severity: 'P4',
    tags: ['example.com', 'test email', 'cannot send']
  },

  // ── API / infrastructure ────────────────────────────────────────────────
  {
    id: 'api-rate-limited',
    category: 'API',
    codes: ['429', 'Too many requests', 'RATE_LIMITED'],
    symptom: 'Several staff at one hotel get "slow down" errors during a busy check-in.',
    cause:
      'Rate limits are counted per account and per address. A whole hotel behind one internet connection shares the address budget.',
    resolution: [
      'Confirm it is one property and one connection, not the whole platform.',
      'If legitimate, raise the relevant *_RATE_LIMIT environment variable and redeploy.',
      'Note which endpoint — guest registration and public ordering have their own, tighter budgets.'
    ],
    severity: 'P2',
    tags: ['too many requests', 'throttled', 'slow down', 'busy period'],
    caution: 'Do not remove the limiter. The public ordering and registration routes are unauthenticated.'
  },
  {
    id: 'api-lambda-throttle',
    category: 'API',
    codes: ['502', 'TooManyRequestsException', 'Rate Exceeded'],
    symptom: 'Spinners then failures at the front desk, several users at once, across hotels.',
    cause:
      'AWS Lambda concurrency limit reached. The account limit is 5 — all functions share it, including scheduled backups.',
    resolution: [
      'Check CloudWatch → Lambda → Throttles for the API function.',
      'Confirm whether a backup or migration job was running at the same time.',
      'The long-term fix is the pending Service Quota increase to 1000. Until then this recurs under any real load.'
    ],
    severity: 'P1',
    tags: ['502', 'timeout', 'everything slow', 'concurrency', 'throttle'],
    actions: [{ label: 'System Stats', to: '/super-admin/stats' }]
  },
  {
    id: 'db-pool-timeout',
    category: 'Database',
    codes: ['P2024', 'Timed out fetching a new connection'],
    symptom: 'Intermittent 500s that come and go with load.',
    cause:
      'The Prisma connection pool is exhausted. Connections in use are connection_limit multiplied by Lambda concurrency.',
    resolution: [
      'Check how many connections RDS currently has open.',
      'Do not raise connection_limit without lowering reserved concurrency — the two multiply.',
      'Escalate to engineering with the time window.'
    ],
    severity: 'P1',
    tags: ['500 errors', 'intermittent', 'database slow', 'pool'],
    caution: 'Raising connection_limit is the intuitive fix and the wrong one. It makes exhaustion happen sooner.'
  },
  {
    id: 'db-unique-violation',
    category: 'Database',
    codes: ['duplicate key value violates unique constraint', 'P2002'],
    symptom: 'Saving a record fails with a database error.',
    cause: 'Something with a uniqueness rule already exists — usually an email address, room number or booking reference.',
    resolution: [
      'Identify the field from the constraint name in the log.',
      'Search for the existing record — most often the user is recreating something already there.',
      'For imports, check whether the same file was uploaded twice.'
    ],
    severity: 'P3',
    tags: ['duplicate', 'already exists', 'unique constraint']
  },
  {
    id: 'api-cors',
    category: 'API',
    codes: ['CORS', 'Access-Control-Allow-Origin', 'blocked by CORS policy'],
    symptom: 'The page loads but every action fails; the browser console shows CORS errors.',
    cause: 'The origin is missing from the API Gateway allowlist.',
    resolution: [
      'Note the exact origin from the console — www and the apex are different origins.',
      'It must be in serverless.yml allowedOrigins, not only CORS_ORIGINS.',
      'API Gateway answers the preflight before Express runs, so its list is the one that decides. Requires a redeploy.'
    ],
    severity: 'P2',
    tags: ['cors', 'blocked', 'console error', 'preflight']
  },
  {
    id: 'infra-eventbus-down',
    category: 'API',
    codes: ['eventBus: down', 'RabbitMQ'],
    symptom: 'System Stats shows the queue as down. Users report nothing.',
    cause: 'RabbitMQ unreachable. Events fall back to in-process delivery.',
    resolution: [
      'Confirm nothing user-facing is broken — it usually is not.',
      'Check CloudAMQP is up and RABBITMQ_URL is set in the deployed environment.',
      'Raise a P3. What is lost is the durable event archive, not functionality.'
    ],
    severity: 'P3',
    tags: ['queue down', 'rabbitmq', 'event bus'],
    actions: [{ label: 'System Stats', to: '/super-admin/stats' }]
  },

  // ── Booking ─────────────────────────────────────────────────────────────
  {
    id: 'booking-room-stuck-cleaning',
    category: 'Booking',
    codes: ['CLEANING', 'room unavailable'],
    symptom: 'A room that was cleaned hours ago still cannot be sold.',
    cause: 'Housekeeping marked it clean but no manager approved it. Approval is what returns a room to sale.',
    resolution: [
      'Ask a manager to approve the housekeeping task.',
      'Housekeeping → filter to Awaiting approval.',
      'If no manager is on shift, a business admin can approve.'
    ],
    severity: 'P2',
    tags: ['room stuck', 'cannot sell room', 'housekeeping', 'dirty']
  },
  {
    id: 'booking-checkout-blocked',
    category: 'Booking',
    codes: ['outstanding balance', 'folio not settled'],
    symptom: 'Check-out refuses to complete.',
    cause: 'The folio still has an outstanding balance.',
    resolution: [
      'Open the folio and look at the balance.',
      'Take payment, or transfer the charge to a company folio if it is being billed.',
      'Check for restaurant charges posted to the room after the desk started checkout.'
    ],
    severity: 'P3',
    tags: ['cannot check out', 'balance', 'folio']
  },
  {
    id: 'night-audit-not-run',
    category: 'Booking',
    codes: ['NIGHT_AUDIT_NOT_FOUND', 'business date'],
    symptom: "Yesterday's revenue figures changed, or reports look wrong.",
    cause: 'The night audit has not run for that business date, so charges are still being posted into it.',
    resolution: [
      'Check the night audit history for that date.',
      'If it never ran, run it manually — it is safe and idempotent.',
      'If it ran twice, escalate: figures may be doubled.'
    ],
    severity: 'P2',
    tags: ['revenue changed', 'report wrong', 'night audit', 'figures']
  }
];

export const CATEGORIES: DiagnosticCategory[] = [
  'Auth', 'Migration', 'Payment', 'Webhook', 'Email', 'API', 'Database', 'Booking'
];
