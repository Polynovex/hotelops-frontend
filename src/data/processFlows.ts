/**
 * Process flows for the support portal.
 *
 * Mermaid source rather than images: a diagram that is text stays in step with
 * the playbook it mirrors, reviews properly in a diff, and does not need a
 * designer to correct when a step changes.
 *
 * Each flow carries the failure points an agent is most likely to be looking
 * at, so the diagram answers "where did this stop?" rather than only "what is
 * supposed to happen?".
 */

export interface ProcessFlow {
  id: string;
  title: string;
  summary: string;
  diagram: string;
  /** Where this flow commonly breaks, and which diagnostic covers it. */
  failurePoints: Array<{ step: string; diagnosticId?: string; note: string }>;
  tags: string[];
}

export const PROCESS_FLOWS: ProcessFlow[] = [
  {
    id: 'onboarding',
    title: 'Tenant onboarding and initial setup',
    summary:
      'From a super admin creating the business to the property taking its first booking.',
    diagram: `flowchart TD
    A[Super admin creates business] --> B[Hotel + admin user created]
    B --> C[Welcome email with temporary password]
    C --> D{Email delivered?}
    D -- No --> D1[Check Blocked Emails]
    D -- Yes --> E[Admin signs in]
    E --> F[Forced password change]
    F --> G{Role requires MFA?}
    G -- Yes --> H[Confined to enrolment until set up]
    G -- No --> I[Full access]
    H --> I
    I --> J[Load rooms and room types]
    J --> K[Load outlets and menu]
    K --> L[Create staff accounts]
    L --> M[Save payment gateway keys]
    M --> N[Set webhook URL at the provider]
    N --> O[Property live]`,
    failurePoints: [
      { step: 'Welcome email', diagnosticId: 'email-suppressed', note: 'Address may be on the suppression list.' },
      { step: 'MFA gate', diagnosticId: 'auth-mfa-enrolment', note: 'Signed in but everything forbidden — they have not enrolled.' },
      { step: 'Webhook URL', diagnosticId: 'payment-webhook-signature', note: 'Keys alone are not enough; the URL must be set at the provider too.' }
    ],
    tags: ['onboarding', 'new hotel', 'setup', 'go live']
  },
  {
    id: 'migration',
    title: 'Data migration and bulk import',
    summary: 'Nothing is written until an admin has seen a dry run.',
    diagram: `flowchart TD
    A[Download template] --> B[Fill in, delete example rows]
    B --> C[Upload CSV]
    C --> D[Browser preflight]
    D -- Fails --> D1[Fix file, nothing sent]
    D -- Passes --> E[Analyse: server suggests mapping]
    E --> F[Admin reviews mapping]
    F --> G[Dry run: per-row validation]
    G --> H{Invalid rows?}
    H -- Yes --> H1[Fix source, or accept skipping]
    H -- No --> I[Commit]
    I --> J[Rows written, job COMMITTED]`,
    failurePoints: [
      { step: 'Preflight', diagnosticId: 'migration-missing-header', note: 'Header renamed or template not used.' },
      { step: 'Dry run', diagnosticId: 'migration-ambiguous-date', note: 'DD/MM/YYYY dates are refused, not guessed.' },
      { step: 'Commit', diagnosticId: 'migration-orphan-bookings', note: 'Bookings need guests and rooms imported first.' }
    ],
    tags: ['import', 'migration', 'csv', 'bulk upload']
  },
  {
    id: 'reservation',
    title: 'Reservation lifecycle',
    summary: 'Booking through to departure, and the states in between.',
    diagram: `stateDiagram-v2
    [*] --> PENDING: Booking created
    PENDING --> CONFIRMED: Deposit or confirmation
    PENDING --> CANCELLED: Cancelled before arrival
    CONFIRMED --> CHECKED_IN: Guest arrives
    CONFIRMED --> CANCELLED: Cancelled
    CONFIRMED --> PENDING: No-show, held
    CHECKED_IN --> CHECKED_OUT: Departure, folio settled
    CHECKED_OUT --> [*]
    CANCELLED --> [*]`,
    failurePoints: [
      { step: 'Check-out', diagnosticId: 'booking-checkout-blocked', note: 'An outstanding folio balance blocks it.' },
      { step: 'Room back on sale', diagnosticId: 'booking-room-stuck-cleaning', note: 'Needs manager approval after housekeeping.' }
    ],
    tags: ['booking', 'reservation', 'check in', 'check out', 'cancellation', 'no-show']
  },
  {
    id: 'payment',
    title: 'Card payment, end to end',
    summary:
      "On the hotel's own merchant account. HotelOpX never holds the money.",
    diagram: `sequenceDiagram
    participant S as Staff / Guest
    participant H as HotelOpX
    participant P as Paystack / Flutterwave
    participant B as Hotel's bank
    S->>H: Pay by card
    H->>H: Derive amount from booking or order
    H->>H: Create transaction (PENDING)
    H->>P: initialize (hotel's own key)
    P-->>H: authorization_url
    H-->>S: Redirect to provider
    S->>P: Enter card details
    P->>B: Settle to hotel's account
    P->>H: Webhook charge.success (signed)
    H->>H: Verify against that hotel's key
    H->>H: Mark transaction and order COMPLETED`,
    failurePoints: [
      { step: 'initialize', diagnosticId: 'payment-gateway-not-configured', note: 'No keys saved, or gateway inactive.' },
      { step: 'Webhook', diagnosticId: 'payment-webhook-signature', note: 'The classic "paid but shows unpaid".' },
      { step: 'Settlement', diagnosticId: 'payment-amount-mismatch', note: 'Refused when the amounts disagree.' }
    ],
    tags: ['payment', 'card', 'paystack', 'flutterwave', 'webhook', 'refund']
  },
  {
    id: 'access',
    title: 'Roles, access and MFA',
    summary: 'Who can reach what, and when a second factor is required.',
    diagram: `flowchart TD
    A[Sign in] --> B{Password correct?}
    B -- No --> B1[Failure counted, lockout after repeats]
    B -- Yes --> C{MFA enrolled?}
    C -- Yes --> D[Second factor required]
    C -- No --> E{Role requires MFA?}
    E -- Yes --> F[Signed in but confined to enrolment]
    E -- No --> G[Full access for the role]
    D --> G
    F --> H[Enrols authenticator] --> G
    G --> I{Turning MFA off?}
    I -- Ordinary role --> J[Password required, then removed]
    I -- Super or business admin --> K[Refused, cannot be disabled]`,
    failurePoints: [
      { step: 'Enrolment gate', diagnosticId: 'auth-mfa-enrolment', note: 'Looks like a permissions bug; it is not.' },
      { step: 'Disable MFA', diagnosticId: 'auth-mfa-cannot-disable', note: 'Refused by design for admin roles.' }
    ],
    tags: ['roles', 'permissions', 'mfa', '2fa', 'access', 'security']
  },
  {
    id: 'night-audit',
    title: 'Night audit and daily reconciliation',
    summary: 'Closes the trading day and freezes the figures.',
    diagram: `flowchart TD
    A[Business date ends] --> B[Night audit runs]
    B --> C[Post room charges to open folios]
    C --> D[Check every folio balances]
    D --> E{Discrepancy?}
    E -- Yes --> E1[Flagged for the accountant]
    E -- No --> F[Journals created]
    F --> G[Business date advances]
    G --> H[Figures frozen]`,
    failurePoints: [
      { step: 'Audit run', diagnosticId: 'night-audit-not-run', note: 'If it never ran, yesterday keeps changing.' }
    ],
    tags: ['night audit', 'reconciliation', 'end of day', 'revenue']
  }
];
