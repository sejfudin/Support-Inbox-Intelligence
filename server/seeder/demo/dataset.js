/**
 * The entire demo dataset, as plain data.
 *
 * This module imports NOTHING on purpose — no mongoose, no models, no
 * `new Date()`. Every cross-reference is a symbolic key resolved by the phase
 * modules, and every date is an offset in WORKING DAYS from the run's anchor
 * (see demo/clock.js). That keeps "what the demo says" separate from "how it
 * gets written", so content can be reworded the morning of a demo without
 * touching persistence logic — and makes the whole run deterministic.
 *
 * Keys are the join mechanism: `mentorKey`, `internKey`, `ticketKey`,
 * `workspaceKey`, `projectKey` all point at the `key` field of an entry
 * elsewhere in this file. seedDemoData.js preflight-validates every one of them
 * BEFORE anything is deleted, so a typo here fails harmlessly.
 */

const PASSWORD = 'password';
const HUB = {
  SARAJEVO: 'Sarajevo',
  BELGRADE: 'Belgrade',
  NOVI_SAD: 'Novi Sad',
  BANJA_LUKA: 'Banja Luka',
  NIS: 'Niš',
};

// ─────────────────────────────────────────────────────────────────────────────
// Staff
// ─────────────────────────────────────────────────────────────────────────────

// The four accounts the demo is driven from. Same password, same hub, same
// workspace, so switching between them mid-demo needs no explanation.
const heroes = [
  {
    key: 'admin',
    email: 'admin@symphony.is',
    fullname: 'Sejfudin',
    role: 'admin',
    hub: HUB.SARAJEVO,
  },
  {
    key: 'mentor',
    email: 'mentor@symphony.is',
    fullname: 'Erik Muller',
    role: 'mentor',
    hub: HUB.SARAJEVO,
  },
  {
    key: 'leadership',
    email: 'leadership@symphony.is',
    fullname: 'Enis Kudo',
    role: 'leadership',
    hub: HUB.SARAJEVO,
  },
  // Also intern #1 below — the hero intern needs a User and an InternProfile.
  {
    key: 'intern',
    email: 'intern@symphony.is',
    fullname: 'Hamza Tuco',
    role: 'intern',
    hub: HUB.SARAJEVO,
  },
];

// Background mentors so the admin roster shows more than one mentor's name and
// the "filter by mentor" control has something to do.
const mentors = [
  {
    key: 'boris',
    email: 'boris.petrovic@symphony.is',
    fullname: 'Boris Petrović',
    role: 'mentor',
    hub: HUB.BELGRADE,
  },
  {
    key: 'natasa',
    email: 'natasa.ilic@symphony.is',
    fullname: 'Nataša Ilić',
    role: 'mentor',
    hub: HUB.NOVI_SAD,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Interns
// ─────────────────────────────────────────────────────────────────────────────
//
// `attendance` drives phaseAttendance:
//   persona     — label only, for the run summary
//   absentEvery — every Nth working day has NO row (absence is never stored),
//                 which yields a stable rate of roughly (1 - 1/N)
//   today       — 'present' | 'cancelled' | 'none'  (state on the anchor day)
//   cancelledWorkdaysAgo — an extra historical cancelled day, if any
//
// Emails are literal, not derived: helpers/slugify.js does not fold diacritics
// (Dženana Kurtović -> 'd-enana-kurtovi-'), and User.email must satisfy the
// schema's email regex.

const interns = [
  {
    key: 'intern', // the hero — User already defined in `heroes`
    status: 'active',
    programme: 'fep',
    position: 'frontend-engineer',
    mentorKey: 'mentor',
    startWorkdaysAgo: 62,
    technologies: ['react', 'next-js', 'node-js'],
    // No row for today: the live check-in is the demo's money shot.
    attendance: { persona: 'star', absentEvery: 20, today: 'none' },
    readiness: [
      { technology: 'react', level: 'ready' },
      { technology: 'next-js', level: 'learning' },
      { position: 'frontend-engineer', level: 'learning' },
    ],
    docs: [{ label: 'Learning plan', url: 'https://drive.symphony.is/demo/hamza-plan' }],
  },
  {
    key: 'tarikKukulj',
    email: 'tarik.kukulj@symphony.is',
    fullname: 'Tarik Kukulj',
    status: 'active',
    programme: 'fep',
    position: 'backend-engineer',
    mentorKey: 'mentor',
    hub: HUB.SARAJEVO,
    startWorkdaysAgo: 55,
    technologies: ['node-js', 'go'],
    attendance: { persona: 'solid', absentEvery: 8, today: 'present', checkInMinute: 5 },
    readiness: [
      { technology: 'node-js', level: 'ready' },
      { technology: 'go', level: 'learning' },
    ],
  },
  {
    key: 'rizvan',
    email: 'rizvan.zolja@symphony.is',
    fullname: 'Rizvan Zolja',
    status: 'active',
    programme: 'fep',
    position: 'fullstack-engineer',
    mentorKey: 'mentor',
    hub: HUB.SARAJEVO,
    startWorkdaysAgo: 70,
    technologies: ['react', 'node-js', 'dotnet'],
    attendance: { persona: 'star', absentEvery: 20, today: 'present', checkInMinute: 12 },
    readiness: [
      { technology: 'react', level: 'ready' },
      { technology: 'node-js', level: 'ready' },
      { position: 'fullstack-engineer', level: 'learning' },
    ],
  },
  {
    key: 'tarikSehic',
    email: 'tarik.sehic@symphony.is',
    fullname: 'Tarik Šehić',
    status: 'active',
    programme: 'shadow',
    position: 'qa-engineer',
    mentorKey: 'mentor',
    hub: HUB.SARAJEVO,
    startWorkdaysAgo: 30,
    technologies: ['manual-qa', 'test-automation'],
    // Cancelled today — shows the "checked in then unchecked" state live.
    attendance: { persona: 'average', absentEvery: 5, today: 'cancelled', checkInMinute: 22 },
    readiness: [
      { technology: 'manual-qa', level: 'ready' },
      { technology: 'test-automation', level: 'learning' },
    ],
  },
  {
    key: 'ana',
    email: 'ana.petrovic@symphony.is',
    fullname: 'Ana Petrović',
    status: 'active',
    programme: 'fep',
    position: 'data-engineer',
    mentorKey: 'boris',
    hub: HUB.BELGRADE,
    startWorkdaysAgo: 48,
    technologies: ['data-engineering', 'fastapi'],
    attendance: { persona: 'solid', absentEvery: 8, today: 'present', checkInMinute: 31 },
    readiness: [{ technology: 'data-engineering', level: 'learning' }],
  },
  {
    key: 'emir',
    email: 'emir.delic@symphony.is',
    fullname: 'Emir Delić',
    status: 'active',
    programme: 'industrial',
    position: 'devops-engineer',
    mentorKey: 'boris',
    hub: HUB.BANJA_LUKA,
    startWorkdaysAgo: 40,
    technologies: ['devops', 'go'],
    // The struggling case, with a recent cancelled day to explain the dip.
    attendance: {
      persona: 'struggling',
      absentEvery: 3,
      today: 'none',
      cancelledWorkdaysAgo: 3,
    },
    readiness: [{ technology: 'devops', level: 'learning' }],
  },
  {
    key: 'sara',
    email: 'sara.markovic@symphony.is',
    fullname: 'Sara Marković',
    status: 'active',
    programme: 'fep',
    position: 'frontend-engineer',
    mentorKey: 'mentor',
    hub: HUB.NOVI_SAD,
    startWorkdaysAgo: 35,
    technologies: ['react', 'svelte'],
    attendance: { persona: 'solid', absentEvery: 8, today: 'present', checkInMinute: 44 },
    readiness: [{ technology: 'react', level: 'learning' }],
  },
  {
    key: 'arnes',
    email: 'arnes.rasta@symphony.is',
    fullname: 'Arnes Rasta',
    status: 'active',
    programme: 'one-on-one',
    position: 'mobile-engineer',
    mentorKey: 'natasa',
    hub: HUB.NOVI_SAD,
    startWorkdaysAgo: 26,
    technologies: ['react-native', 'kotlin'],
    attendance: { persona: 'average', absentEvery: 5, today: 'none' },
    readiness: [{ technology: 'react-native', level: 'learning' }],
  },
  {
    key: 'dzenana',
    email: 'dzenana.kurtovic@symphony.is',
    fullname: 'Dženana Kurtović',
    status: 'active',
    programme: 'fep',
    position: 'backend-engineer',
    mentorKey: 'mentor',
    hub: HUB.SARAJEVO,
    startWorkdaysAgo: 84,
    technologies: ['spring-boot', 'node-js', 'go'],
    attendance: { persona: 'star', absentEvery: 20, today: 'present', checkInMinute: 8 },
    readiness: [
      { technology: 'spring-boot', level: 'ready' },
      { technology: 'node-js', level: 'ready' },
      { position: 'backend-engineer', level: 'ready' },
    ],
  },
  {
    key: 'stefan',
    email: 'stefan.ilic@symphony.is',
    fullname: 'Stefan Ilić',
    status: 'active',
    programme: 'core-tool',
    position: 'qa-engineer',
    mentorKey: 'natasa',
    hub: HUB.NIS,
    startWorkdaysAgo: 20,
    technologies: ['test-automation'],
    attendance: { persona: 'average', absentEvery: 5, today: 'present', checkInMinute: 39 },
    readiness: [{ technology: 'test-automation', level: 'learning' }],
  },

  // ── ready for placement ──
  {
    key: 'nadia',
    email: 'nadia.hadzic@symphony.is',
    fullname: 'Nadia Hadžić',
    status: 'ready',
    programme: 'fep',
    position: 'frontend-engineer',
    mentorKey: 'mentor',
    hub: HUB.SARAJEVO,
    startWorkdaysAgo: 120,
    technologies: ['react', 'next-js', 'node-js'],
    attendance: { persona: 'star', absentEvery: 20, today: 'present', checkInMinute: 3 },
    readiness: [
      { technology: 'react', level: 'ready' },
      { technology: 'next-js', level: 'ready' },
      { position: 'frontend-engineer', level: 'ready' },
    ],
    docs: [{ label: 'Portfolio', url: 'https://drive.symphony.is/demo/nadia-portfolio' }],
  },
  {
    key: 'benjamin',
    email: 'benjamin.pashic@symphony.is',
    fullname: 'Benjamin Pashic',
    status: 'ready',
    programme: 'fep',
    position: 'backend-engineer',
    mentorKey: 'mentor',
    hub: HUB.SARAJEVO,
    startWorkdaysAgo: 110,
    technologies: ['spring-boot', 'go'],
    attendance: { persona: 'solid', absentEvery: 8, today: 'present', checkInMinute: 17 },
    readiness: [
      { technology: 'spring-boot', level: 'ready' },
      { position: 'backend-engineer', level: 'ready' },
    ],
  },
  {
    key: 'nedim',
    email: 'nedim.nedimarlija@symphony.is',
    fullname: 'Nedim Nedimarlija',
    status: 'ready',
    programme: 'fep',
    position: 'fullstack-engineer',
    mentorKey: 'boris',
    hub: HUB.BELGRADE,
    startWorkdaysAgo: 115,
    technologies: ['angular', 'dotnet'],
    attendance: { persona: 'solid', absentEvery: 8, today: 'present', checkInMinute: 26 },
    readiness: [
      { technology: 'angular', level: 'ready' },
      { technology: 'dotnet', level: 'ready' },
    ],
  },
  {
    key: 'amar',
    email: 'amar.softic@symphony.is',
    fullname: 'Amar Softić',
    status: 'ready',
    programme: 'shadow',
    position: 'ml-engineer',
    mentorKey: 'mentor',
    hub: HUB.SARAJEVO,
    startWorkdaysAgo: 100,
    technologies: ['machine-learning', 'data-science'],
    attendance: { persona: 'average', absentEvery: 5, today: 'none' },
    readiness: [{ technology: 'machine-learning', level: 'ready' }],
  },
  {
    key: 'sabahudin',
    email: 'sabahudin.topalbecirevic@symphony.is',
    fullname: 'Sabahudin Topalbecirevic',
    status: 'ready',
    programme: 'fep',
    position: 'data-analyst',
    mentorKey: 'natasa',
    hub: HUB.NIS,
    startWorkdaysAgo: 130,
    technologies: ['data-science', 'data-engineering'],
    attendance: { persona: 'star', absentEvery: 20, today: 'none' },
    readiness: [
      { technology: 'data-science', level: 'ready' },
      { position: 'data-analyst', level: 'ready' },
    ],
  },
  {
    key: 'lamija',
    email: 'lamija.hodzic@symphony.is',
    fullname: 'Lamija Hodžić',
    status: 'ready',
    programme: 'fep',
    position: 'qa-engineer',
    mentorKey: 'mentor',
    hub: HUB.SARAJEVO,
    startWorkdaysAgo: 105,
    technologies: ['test-automation', 'manual-qa'],
    attendance: { persona: 'solid', absentEvery: 8, today: 'present', checkInMinute: 36 },
    readiness: [
      { technology: 'test-automation', level: 'ready' },
      { position: 'qa-engineer', level: 'ready' },
    ],
  },

  // ── terminal states: off the attendance roster (ROSTER_STATUSES), present in
  //    the pipeline and history screens.
  {
    key: 'filip',
    email: 'filip.kovacevic@symphony.is',
    fullname: 'Filip Kovačević',
    status: 'placed',
    programme: 'fep',
    position: 'backend-engineer',
    mentorKey: 'mentor',
    hub: HUB.SARAJEVO,
    startWorkdaysAgo: 140,
    technologies: ['spring-boot', 'go'],
    attendance: null,
    readiness: [{ technology: 'spring-boot', level: 'ready' }],
  },
  {
    key: 'adna',
    email: 'adna.mujic@symphony.is',
    fullname: 'Adna Mujić',
    status: 'placed',
    programme: 'fep',
    position: 'frontend-engineer',
    mentorKey: 'boris',
    hub: HUB.BELGRADE,
    startWorkdaysAgo: 138,
    technologies: ['react', 'vue-js'],
    attendance: null,
    readiness: [{ technology: 'react', level: 'ready' }],
  },
  {
    key: 'kenan',
    email: 'kenan.begovic@symphony.is',
    fullname: 'Kenan Begović',
    status: 'placed',
    programme: 'fep',
    position: 'fullstack-engineer',
    mentorKey: 'mentor',
    hub: HUB.SARAJEVO,
    startWorkdaysAgo: 145,
    technologies: ['react', 'node-js'],
    attendance: null,
    readiness: [
      { technology: 'react', level: 'ready' },
      { position: 'fullstack-engineer', level: 'ready' },
    ],
  },
  {
    key: 'milica',
    email: 'milica.jovanovic@symphony.is',
    fullname: 'Milica Jovanović',
    status: 'placed',
    programme: 'industrial',
    position: 'data-engineer',
    mentorKey: 'natasa',
    hub: HUB.NOVI_SAD,
    startWorkdaysAgo: 150,
    technologies: ['data-engineering', 'fastapi'],
    attendance: null,
    readiness: [{ technology: 'data-engineering', level: 'ready' }],
  },
  {
    key: 'haris',
    email: 'haris.mehmedovic@symphony.is',
    fullname: 'Haris Mehmedović',
    status: 'placed',
    programme: 'fep',
    position: 'devops-engineer',
    mentorKey: 'boris',
    hub: HUB.BANJA_LUKA,
    startWorkdaysAgo: 142,
    technologies: ['devops', 'go'],
    attendance: null,
    readiness: [{ technology: 'devops', level: 'ready' }],
  },
  {
    key: 'dino',
    email: 'dino.ramazanovic@symphony.is',
    fullname: 'Dino Ramazanovic',
    status: 'completed',
    programme: 'industrial',
    position: 'devops-engineer',
    mentorKey: 'natasa',
    hub: HUB.NOVI_SAD,
    startWorkdaysAgo: 140,
    technologies: ['devops'],
    attendance: null,
    readiness: [{ technology: 'devops', level: 'ready' }],
  },
  {
    key: 'hana',
    email: 'hana.alic@symphony.is',
    fullname: 'Hana Alić',
    status: 'completed',
    programme: 'fep',
    position: 'qa-engineer',
    mentorKey: 'mentor',
    hub: HUB.SARAJEVO,
    startWorkdaysAgo: 140,
    technologies: ['manual-qa', 'test-automation'],
    attendance: null,
    readiness: [{ technology: 'test-automation', level: 'ready' }],
  },
  {
    key: 'vedrana',
    email: 'vedrana.simic@symphony.is',
    fullname: 'Vedrana Šimić',
    status: 'completed',
    programme: 'one-on-one',
    position: 'product-designer',
    mentorKey: 'boris',
    hub: HUB.BELGRADE,
    startWorkdaysAgo: 148,
    technologies: ['react'],
    attendance: null,
    readiness: [{ position: 'product-designer', level: 'ready' }],
  },
  {
    key: 'hamzaT',
    email: 'hamza.tucoglu@symphony.is',
    fullname: 'Hamza Tucoglu',
    status: 'discontinued',
    programme: 'shadow',
    position: 'mobile-engineer',
    mentorKey: 'boris',
    hub: HUB.BANJA_LUKA,
    startWorkdaysAgo: 90,
    technologies: ['flutter'],
    attendance: null,
    readiness: [{ technology: 'flutter', level: 'learning' }],
  },
  {
    key: 'goran',
    email: 'goran.stankovic@symphony.is',
    fullname: 'Goran Stanković',
    status: 'discontinued',
    programme: 'industrial',
    position: 'security-engineer',
    mentorKey: 'natasa',
    hub: HUB.NIS,
    startWorkdaysAgo: 75,
    technologies: ['go'],
    // Deactivated account: left the programme and the login was disabled.
    // `account.active: false` means login is rejected, but the user still
    // appears in the admin directory with a DISABLED badge and is filterable
    // via `?status=disabled` — which is the point of having one in the demo.
    //
    // The profile status stays terminal on purpose. getRoster keys off PROFILE
    // status and never checks `user.active`, so an `active`/`ready` profile on a
    // disabled account would sit on the attendance roster forever at 0%.
    account: { active: false, status: 'disabled' },
    attendance: null,
    readiness: [{ technology: 'go', level: 'learning' }],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Workspaces
// ─────────────────────────────────────────────────────────────────────────────
//
// `internMemberKeys: 'roster'` = every active/ready intern. Workspace members
// must be `status: 'active'` to appear in the dailies picker (see
// dailyService.getActiveInterns).

const workspaces = [
  {
    key: 'inbox',
    name: 'Symphony Support Inbox',
    description: 'Customer support and product engineering for the Symphony platform.',
    ownerKey: 'admin',
    staffMembers: [
      { key: 'admin', role: 'admin' },
      { key: 'mentor', role: 'admin' },
      { key: 'leadership', role: 'member' },
      { key: 'boris', role: 'member' },
      { key: 'natasa', role: 'member' },
    ],
    internMemberKeys: 'roster',
    isHome: true, // becomes User.workspaceId for everyone in it
  },
  {
    key: 'qa',
    name: 'FEP QA Guild',
    description: 'Quality engineering guild — regression sweeps and test automation.',
    ownerKey: 'admin',
    staffMembers: [
      { key: 'admin', role: 'admin' },
      { key: 'mentor', role: 'member' },
    ],
    internMemberKeys: ['tarikSehic', 'stefan', 'lamija'],
  },
];

const categories = [
  { key: 'billing', workspaceKey: 'inbox', name: 'Billing', color: '#f59e0b' },
  { key: 'bug', workspaceKey: 'inbox', name: 'Bug Report', color: '#ef4444' },
  { key: 'feature', workspaceKey: 'inbox', name: 'Feature Request', color: '#8b5cf6' },
  { key: 'onboarding', workspaceKey: 'inbox', name: 'Onboarding', color: '#10b981' },
  { key: 'qaDefect', workspaceKey: 'qa', name: 'QA Defect', color: '#ef4444' },
  { key: 'qaAutomation', workspaceKey: 'qa', name: 'Test Automation', color: '#3b82f6' },
];

// Client projects the placement pipeline points at. The locked `unspecified`
// sentinel is preserved by the wipe and used where no project is known yet.
const projects = [
  {
    key: 'meridian',
    name: 'Meridian Health — patient portal',
    client: 'Meridian Health',
    description: 'Patient-facing portal rebuild. React front end on a Node BFF.',
    technologies: ['react', 'node-js'],
    status: 'active',
  },
  {
    key: 'northwind',
    name: 'Northwind Logistics — fleet tracker',
    client: 'Northwind Logistics',
    description: 'Real-time fleet tracking dashboard. Angular + .NET services.',
    technologies: ['angular', 'dotnet'],
    status: 'active',
  },
  {
    key: 'kestrel',
    name: 'Kestrel Fintech — payments API',
    client: 'Kestrel Fintech',
    description: 'PSD2-compliant payments API. Spring Boot with Go edge services.',
    technologies: ['spring-boot', 'go'],
    status: 'active',
  },
  {
    key: 'blueharbour',
    name: 'Blue Harbour Retail — POS refresh',
    client: 'Blue Harbour Retail',
    description: 'In-store point-of-sale refresh. Paused pending client budget sign-off.',
    technologies: ['react-native', 'node-js'],
    status: 'on_hold',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Ticket board
// ─────────────────────────────────────────────────────────────────────────────
//
// ageWorkdays  — how long ago the ticket was opened (drives createdAt-ish dates)
// timeSpent    — minutes, only meaningful once a ticket has been in progress
// messages     — senderType 'user' is the customer, 'admin' is the team
// ai.category  — one of billing | bug | feature | other | ''

const tickets = [
  {
    key: 'invoiceTotal',
    workspaceKey: 'inbox',
    subject: "Invoice PDF shows last month's total",
    description:
      '<p>Customer reports the downloaded invoice PDF repeats the <strong>previous</strong> billing period total, while the web view is correct.</p><p>Reproduced on the July invoice for two accounts.</p>',
    statusSlug: 'done',
    priority: 'high',
    categoryKey: 'billing',
    creatorKey: 'admin',
    assigneeKeys: ['dzenana', 'admin'],
    storyPoints: 3,
    ageWorkdays: 14,
    timeSpent: 320,
    messages: [
      {
        senderType: 'user',
        text: 'Our July invoice PDF shows the June total. The dashboard shows the right number.',
      },
      {
        senderType: 'admin',
        senderKey: 'mentor',
        text: 'Thanks — reproduced. The PDF renderer was caching the previous period. Fix is out.',
      },
    ],
    ai: {
      summary: 'Invoice PDF renders the prior billing period total; web view is correct.',
      category: 'billing',
      suggestedReply:
        'Thanks for flagging this. The PDF export was reusing a cached billing period — a fix is deployed, and re-downloading the invoice now shows the correct total.',
      confidenceScore: 0.91,
    },
    comments: [
      { authorKey: 'dzenana', text: 'Cache key was missing the period id. Patch in review.' },
      { authorKey: 'mentor', text: 'Verified on staging with both affected accounts. Shipping.' },
    ],
  },
  {
    key: 'ssoSafari',
    workspaceKey: 'inbox',
    subject: 'SSO login loops on Safari 17',
    description:
      '<p>Safari 17 users bounce between the IdP and the app indefinitely. Chrome and Firefox are fine.</p><p>Suspect the session cookie is dropped because of <code>SameSite</code> handling on the callback.</p>',
    statusSlug: 'in progress',
    priority: 'critical',
    categoryKey: 'bug',
    creatorKey: 'admin',
    assigneeKeys: ['rizvan', 'tarikKukulj', 'mentor'],
    storyPoints: 5,
    ageWorkdays: 4,
    timeSpent: 210,
    messages: [
      {
        senderType: 'user',
        text: 'Nobody on Safari can sign in this morning — it just keeps redirecting.',
      },
    ],
    ai: {
      summary: 'Safari 17 SSO callback loops; likely SameSite cookie rejection on redirect.',
      category: 'bug',
      suggestedReply:
        "We've reproduced the Safari sign-in loop and are working on it now. In the meantime Chrome or Firefox will get you in.",
      confidenceScore: 0.84,
    },
    comments: [
      {
        authorKey: 'rizvan',
        text: 'Cookie is set SameSite=Lax; Safari drops it on the POST back.',
      },
      { authorKey: 'mentor', text: "Let's try SameSite=None + Secure and re-test on 17.4." },
      { authorKey: 'tarikKukulj', text: 'Staging build up — holding off until QA confirms.' },
    ],
  },
  {
    key: 'csvImport',
    workspaceKey: 'inbox',
    subject: 'Bulk CSV import silently drops rows past 500',
    description:
      '<p>Imports over 500 rows report success but only the first 500 land. No error surfaced to the user.</p>',
    statusSlug: 'in progress',
    priority: 'high',
    categoryKey: 'bug',
    creatorKey: 'mentor',
    assigneeKeys: ['tarikKukulj'],
    storyPoints: 3,
    ageWorkdays: 7,
    timeSpent: 145,
    ai: {
      summary: 'CSV import truncates at 500 rows and reports false success.',
      category: 'bug',
      suggestedReply:
        'Thanks — we found a hard limit in the importer that silently truncated large files. A fix is in progress and we will confirm once it ships.',
      confidenceScore: 0.88,
    },
    comments: [
      { authorKey: 'tarikKukulj', text: 'Batch loop breaks at the page size instead of paging.' },
    ],
  },
  {
    key: 'slaSlack',
    workspaceKey: 'inbox',
    subject: 'Add Slack notification for breached SLA',
    description:
      '<p>Support leads want a Slack ping when a ticket passes its response SLA, with the ticket link and current assignee.</p>',
    statusSlug: 'to do',
    priority: 'medium',
    categoryKey: 'feature',
    creatorKey: 'leadership',
    assigneeKeys: ['sara'],
    storyPoints: 5,
    ageWorkdays: 9,
    dueInWorkdays: 8,
    ai: {
      summary: 'Feature request: Slack alert on SLA breach with ticket link and assignee.',
      category: 'feature',
      suggestedReply: '',
      confidenceScore: 0.72,
    },
  },
  {
    key: 'attendanceExport',
    workspaceKey: 'inbox',
    subject: 'Attendance export missing cancelled days',
    description:
      '<p>The CSV export lists present days only. Cancelled check-ins should appear so the monthly numbers reconcile against the roster.</p>',
    statusSlug: 'on staging',
    priority: 'medium',
    categoryKey: 'bug',
    creatorKey: 'admin',
    assigneeKeys: ['dzenana', 'admin'],
    storyPoints: 2,
    ageWorkdays: 6,
    timeSpent: 95,
    comments: [{ authorKey: 'dzenana', text: 'Export now includes a status column. On staging.' }],
  },
  {
    key: 'archiveReassign',
    workspaceKey: 'inbox',
    subject: 'Mentor cannot reassign a ticket after archive',
    description:
      '<p>Archiving a ticket leaves the assignee control disabled even after restore, so tickets get stuck with the wrong owner.</p>',
    statusSlug: 'blocked',
    priority: 'high',
    categoryKey: 'bug',
    creatorKey: 'mentor',
    assigneeKeys: ['rizvan', 'mentor'],
    storyPoints: 3,
    ageWorkdays: 11,
    timeSpent: 60,
    comments: [
      {
        authorKey: 'rizvan',
        text: 'Blocked — need a product call on whether archived tickets should be editable at all.',
      },
    ],
  },
  {
    key: 'onboardingSpam',
    workspaceKey: 'inbox',
    subject: 'Onboarding checklist emails go to spam',
    description:
      '<p>New interns report the onboarding checklist email lands in spam. SPF passes; DKIM alignment looks wrong on the transactional domain.</p>',
    statusSlug: 'done',
    priority: 'medium',
    categoryKey: 'onboarding',
    creatorKey: 'admin',
    assigneeKeys: ['ana'],
    storyPoints: 2,
    ageWorkdays: 19,
    timeSpent: 180,
    ai: {
      summary: 'Onboarding email deliverability issue traced to DKIM alignment.',
      category: 'other',
      suggestedReply: '',
      confidenceScore: 0.66,
    },
    comments: [
      { authorKey: 'ana', text: 'DKIM selector fixed with IT. Test sends land in inbox.' },
    ],
  },
  {
    key: 'searchAccents',
    workspaceKey: 'inbox',
    subject: 'Ticket search ignores accented characters',
    description:
      '<p>Searching "Kurtovic" does not match "Kurtović". Needs diacritic-insensitive collation on the search index.</p>',
    statusSlug: 'to do',
    priority: 'low',
    categoryKey: 'bug',
    creatorKey: 'mentor',
    assigneeKeys: ['sara', 'admin'],
    storyPoints: 2,
    ageWorkdays: 13,
  },
  {
    key: 'darkModeChips',
    workspaceKey: 'inbox',
    subject: 'Dark mode contrast fails on status chips',
    description:
      '<p>Status chips on the board fall below WCAG AA in dark mode — worst on "On staging" and "Blocked".</p>',
    statusSlug: 'backlog',
    priority: 'low',
    categoryKey: 'bug',
    creatorKey: 'admin',
    assigneeKeys: [],
    storyPoints: 1,
    ageWorkdays: 22,
  },
  {
    key: 'hubFilter',
    workspaceKey: 'inbox',
    subject: 'Add per-hub filter to attendance roster',
    description:
      '<p>Admins covering several hubs want to narrow the roster to one hub, and have the monthly rate recomputed for that subset.</p>',
    statusSlug: 'in progress',
    priority: 'medium',
    categoryKey: 'feature',
    creatorKey: 'leadership',
    assigneeKeys: ['intern'],
    storyPoints: 3,
    ageWorkdays: 5,
    timeSpent: 130,
    comments: [
      { authorKey: 'intern', text: 'Filter is server-side now; wiring the select next.' },
      {
        authorKey: 'mentor',
        text: 'Keep the rate computed on the filtered set, not the full one.',
      },
    ],
  },
  {
    key: 'refundStuck',
    workspaceKey: 'inbox',
    subject: 'Refund request stuck in pending for 6 days',
    description:
      '<p>A customer refund has sat in <em>pending</em> since the 21st. Provider webhook was received but never processed.</p>',
    statusSlug: 'in progress',
    priority: 'critical',
    categoryKey: 'billing',
    creatorKey: 'admin',
    assigneeKeys: ['dzenana', 'rizvan', 'mentor'],
    storyPoints: 3,
    ageWorkdays: 6,
    timeSpent: 240,
    messages: [
      { senderType: 'user', text: 'Six days and my refund still says pending. Can someone check?' },
      {
        senderType: 'admin',
        senderKey: 'admin',
        text: 'Apologies for the delay — we found the stuck webhook and are processing it manually today.',
      },
    ],
    ai: {
      summary: 'Refund stuck pending; provider webhook received but not processed.',
      category: 'billing',
      suggestedReply:
        'Sorry about the wait. Your refund was held up by a failed webhook on our side — we are processing it manually now and you will see it within one business day.',
      confidenceScore: 0.94,
    },
    comments: [
      {
        authorKey: 'dzenana',
        text: 'Webhook handler threw on a null payout id and never retried.',
      },
    ],
  },
  {
    key: 'digestDoubleCount',
    workspaceKey: 'inbox',
    subject: 'Weekly digest email double-counts done tickets',
    description:
      '<p>The Monday digest counts a ticket twice when it moved to Done and back within the same week.</p>',
    statusSlug: 'done',
    priority: 'medium',
    categoryKey: 'bug',
    creatorKey: 'mentor',
    assigneeKeys: ['ana'],
    storyPoints: 2,
    ageWorkdays: 17,
    timeSpent: 110,
    comments: [
      { authorKey: 'ana', text: 'Counting distinct ticket ids now instead of transitions.' },
    ],
  },
  {
    key: 'cvUpload',
    workspaceKey: 'inbox',
    subject: 'Intern CV upload rejects PDFs over 4 MB',
    description:
      '<p>Upload fails with a generic error above 4 MB. Either raise the limit or surface a clear message with the actual limit.</p>',
    statusSlug: 'on staging',
    priority: 'medium',
    categoryKey: 'bug',
    creatorKey: 'mentor',
    assigneeKeys: ['tarikKukulj'],
    storyPoints: 2,
    ageWorkdays: 8,
    timeSpent: 85,
  },
  {
    key: 'boardShortcuts',
    workspaceKey: 'inbox',
    subject: 'Add keyboard shortcuts to the ticket board',
    description:
      '<p>Power users want <code>j</code>/<code>k</code> navigation and <code>1-6</code> to move a ticket between statuses.</p>',
    statusSlug: 'backlog',
    priority: 'low',
    categoryKey: 'feature',
    creatorKey: 'mentor',
    assigneeKeys: [],
    storyPoints: 5,
    ageWorkdays: 25,
  },
  {
    key: 'holidayReminder',
    workspaceKey: 'inbox',
    subject: 'Daily stand-up reminder fires on public holidays',
    description:
      '<p>The stand-up reminder respects weekends but not the hub holiday calendar, so it pinged everyone on a public holiday.</p>',
    statusSlug: 'to do',
    priority: 'low',
    categoryKey: 'bug',
    creatorKey: 'natasa',
    assigneeKeys: ['stefan'],
    storyPoints: 3,
    ageWorkdays: 10,
  },
  {
    key: 'recTimeline',
    workspaceKey: 'inbox',
    subject: 'Recommendation timeline shows stages out of order',
    description:
      '<p>When a recommendation skips the interviewing stage, the timeline renders <em>resulted</em> above <em>recommended</em>.</p>',
    statusSlug: 'done',
    priority: 'high',
    categoryKey: 'bug',
    creatorKey: 'leadership',
    assigneeKeys: ['rizvan', 'mentor'],
    storyPoints: 2,
    ageWorkdays: 16,
    timeSpent: 150,
    comments: [
      { authorKey: 'rizvan', text: 'Sorting on statusDates now, falling back to stage order.' },
    ],
  },
  {
    key: 'prAutoMove',
    workspaceKey: 'inbox',
    subject: 'GitHub PR link does not auto-move ticket to staging',
    description:
      '<p>With auto-move enabled, merging a linked PR leaves the ticket in progress. Webhook arrives; the status update is skipped.</p>',
    statusSlug: 'blocked',
    priority: 'medium',
    categoryKey: 'bug',
    creatorKey: 'admin',
    assigneeKeys: ['emir', 'mentor'],
    storyPoints: 3,
    ageWorkdays: 12,
    timeSpent: 70,
    comments: [
      { authorKey: 'emir', text: 'Blocked on getting a test GitHub App installation for staging.' },
    ],
  },
  {
    key: 'dupeNotification',
    workspaceKey: 'inbox',
    subject: 'Duplicate notification when mentioned twice in one comment',
    description:
      '<p>Mentioning the same person twice in a comment sends two notifications. Mentions should be de-duplicated per comment.</p>',
    statusSlug: 'done',
    priority: 'low',
    categoryKey: 'bug',
    creatorKey: 'mentor',
    assigneeKeys: ['sara'],
    storyPoints: 1,
    ageWorkdays: 20,
    timeSpent: 45,
  },

  // ── FEP QA Guild ──
  {
    key: 'qaCalendarOffByOne',
    workspaceKey: 'qa',
    subject: 'Regression: attendance calendar off-by-one in July',
    description:
      '<p>The calendar grid renders the first of the month in the wrong weekday column for months starting on a Wednesday.</p>',
    statusSlug: 'in progress',
    priority: 'high',
    categoryKey: 'qaDefect',
    creatorKey: 'admin',
    assigneeKeys: ['tarikSehic'],
    storyPoints: 3,
    ageWorkdays: 3,
    timeSpent: 90,
    comments: [
      { authorKey: 'tarikSehic', text: 'Reproduced for July. Leading-blank count is off.' },
    ],
  },
  {
    key: 'qaFlakyDnd',
    workspaceKey: 'qa',
    subject: 'Flaky test: ticket drag-and-drop suite',
    description:
      '<p>The board drag-and-drop suite fails roughly one run in five in CI, always on the first drag. Suspect a missing wait on the drop target.</p>',
    statusSlug: 'to do',
    priority: 'medium',
    categoryKey: 'qaAutomation',
    creatorKey: 'mentor',
    assigneeKeys: ['stefan'],
    storyPoints: 2,
    ageWorkdays: 7,
  },
  {
    key: 'qaCheckInCoverage',
    workspaceKey: 'qa',
    subject: 'Add coverage for the check-in window boundaries',
    description:
      '<p>No test covers 06:59 / 07:00 / 10:59 / 11:00 office time, or the weekend rejection. These are the rules most likely to regress.</p>',
    statusSlug: 'backlog',
    priority: 'medium',
    categoryKey: 'qaAutomation',
    creatorKey: 'admin',
    assigneeKeys: [],
    storyPoints: 3,
    ageWorkdays: 15,
  },
  {
    key: 'qaRateLimit',
    workspaceKey: 'qa',
    subject: 'Login rate-limit not covered by tests',
    description: '<p>Add a case asserting repeated failed logins are throttled.</p>',
    statusSlug: 'done',
    priority: 'low',
    categoryKey: 'qaAutomation',
    creatorKey: 'mentor',
    assigneeKeys: ['stefan'],
    storyPoints: 1,
    ageWorkdays: 18,
    timeSpent: 55,
  },
  {
    key: 'qaCancelledRate',
    workspaceKey: 'qa',
    subject: 'QA: cancelled check-in still counted in monthly rate',
    description:
      '<p>A day the intern cancelled was counted as present in the monthly rate. Cancelled days must not count toward <code>presentDays</code>.</p>',
    statusSlug: 'done',
    priority: 'high',
    categoryKey: 'qaDefect',
    creatorKey: 'tarikSehic',
    assigneeKeys: ['tarikSehic'],
    storyPoints: 2,
    ageWorkdays: 9,
    timeSpent: 120,
    comments: [
      {
        authorKey: 'mentor',
        text: 'Confirmed fixed — cancelled rows route to cancelledDates only.',
      },
    ],
  },
  {
    key: 'qaFirefoxDatePicker',
    workspaceKey: 'qa',
    subject: 'Cross-browser: date picker unusable on Firefox',
    description:
      '<p>The month picker on the roster closes on the first click in Firefox, so you cannot page to a previous month.</p>',
    statusSlug: 'blocked',
    priority: 'medium',
    categoryKey: 'qaDefect',
    creatorKey: 'admin',
    assigneeKeys: ['stefan'],
    storyPoints: 2,
    ageWorkdays: 11,
    comments: [{ authorKey: 'stefan', text: 'Blocked pending a decision on the picker library.' }],
  },
];

// Unread bell notifications so the badge is non-zero for the demo mentor.
const notifications = [
  {
    recipientKey: 'mentor',
    type: 'ticket_comment',
    ticketKey: 'ssoSafari',
    title: 'New comment on SSO login loops on Safari 17',
    body: 'Rizvan Zolja: Cookie is set SameSite=Lax; Safari drops it on the POST back.',
    read: false,
    workdaysAgo: 1,
  },
  {
    recipientKey: 'mentor',
    type: 'ticket_assigned',
    ticketKey: 'refundStuck',
    title: 'You were added to Refund request stuck in pending for 6 days',
    body: 'Sejfudin assigned you to a critical billing ticket.',
    read: false,
    workdaysAgo: 1,
  },
  {
    recipientKey: 'mentor',
    type: 'ticket_comment',
    ticketKey: 'hubFilter',
    title: 'New comment on Add per-hub filter to attendance roster',
    body: 'Hamza Tuco: Filter is server-side now; wiring the select next.',
    read: true,
    workdaysAgo: 2,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Dailies
// ─────────────────────────────────────────────────────────────────────────────
//
// One entry per workspace, so both boards have stand-up history rather than just
// the main one. Generated rather than hand-written per day: `days` working days
// back from the anchor, with coverage deliberately partial so the compliance
// view has something to show. Who files on which day is a fixed function of
// (internIndex, dayOffset) — no randomness, so re-seeding reproduces it exactly.
//
// `skipEvery: N` means an intern files unless (index + dayOffset) % N === N-1,
// i.e. roughly (N-1)/N coverage. `blockerEvery: N` adds a blocker to every Nth.

const dailies = [
  {
    workspaceKey: 'inbox',
    days: 15,
    scribeKey: 'mentor',
    skipEvery: 4, // ~75% coverage
    blockerEvery: 5,
    done: [
      'Finished the invoice-total fix and opened a PR',
      'Paired on the CSV importer paging bug',
      'Wrote unit tests for the refund webhook handler',
      'Reviewed two PRs and left comments',
      'Reproduced the Safari SSO loop locally',
      'Migrated the roster filter to the server side',
      'Cleaned up the status chip colour tokens',
      'Walked through the attendance export with QA',
      'Split the importer into batched writes',
      'Added the missing index on the tickets collection',
      'Fixed the digest double-count query',
      'Wrote up findings on the webhook retry design',
    ],
    todo: [
      'Wire the hub select into the roster query',
      'Pair with Tarik on the importer batch loop',
      'Add the missing DKIM regression test',
      'Pick up the accented-search ticket',
      'Re-test SSO on Safari 17.4 staging build',
      'Write up the webhook retry design',
      'Finish the CV upload size-limit message',
      'Start on the SLA Slack notification',
      'Review Nadia’s PR on the status chips',
      'Break the keyboard-shortcuts ticket into subtasks',
    ],
    blockers: [
      'Waiting on staging database credentials',
      'Need a review on the open PR before I can continue',
      'Blocked on a product call about archived tickets',
      'Waiting for the test GitHub App installation',
      'Need the client to confirm the expected invoice totals',
      'Waiting on design for the empty state',
    ],
    blockerTicketKeys: ['ssoSafari', 'csvImport', 'archiveReassign', 'prAutoMove', 'refundStuck'],
  },
  {
    workspaceKey: 'qa',
    days: 8,
    scribeKey: 'mentor',
    skipEvery: 3, // ~66% coverage — a smaller guild, patchier stand-ups
    blockerEvery: 4,
    done: [
      'Triaged the overnight regression run',
      'Reproduced the July calendar off-by-one',
      'Stabilised two flaky drag-and-drop specs',
      'Added boundary cases for the check-in window',
      'Filed three defects from the cross-browser sweep',
    ],
    todo: [
      'Finish the Playwright check-in coverage',
      'Re-run the board suite on the new staging build',
      'Pin down the Firefox date-picker repro',
      'Write the rate-limit assertion',
    ],
    blockers: [
      'Waiting on a decision about the picker library',
      'CI runner is queued behind the main build',
      'Need a seeded account with a cancelled check-in',
    ],
    blockerTicketKeys: ['qaFirefoxDatePicker', 'qaFlakyDnd', 'qaCheckInCoverage'],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Placement pipeline
// ─────────────────────────────────────────────────────────────────────────────
//
// Every intern in `interns` has at least one recommendation — preflight enforces
// it, so the pipeline and each intern's "Recommendations" tab are never empty.
// The interns in RECOMMENDATION_MULTI_KEYS have several, so the demo can show a
// real placement journey (rejected, re-recommended, still open) rather than a
// single row per person.
//
// Recommendation status has to agree with the intern's PROFILE status, and
// preflight enforces that too (see checkRecommendationCoherence in
// seedDemoData.js). The rules come from recommendationService:
//
//   active       → open stages only (`recommended` / `interviewing`). Resolving a
//                  recommendation as not_placed moves the profile to `ready`, so
//                  a resulted recommendation on an `active` intern is a state the
//                  app itself can never produce.
//   ready        → open stages, plus past `not_placed` results (that IS how an
//                  intern lands back on the bench).
//   placed       → all resulted; exactly one with outcome `placed`.
//   completed /
//   discontinued → all resulted, all `not_placed`. NON_RECOMMENDABLE_PROFILE_
//                  STATUSES rejects new recommendations for these interns, and
//                  closeStaleRecommendations.js closes any left open.
//
// Omitting `interviewingWorkdaysAgo` on a resulted recommendation is meaningful,
// not lazy: it renders as "interviewing was skipped" (see Recommendation.js), i.e.
// closed before the client ever scheduled anything.

// Interns who get more than one recommendation. Kept as data so preflight can
// assert it and a reviewer can see the intent without reading every spec below.
const RECOMMENDATION_MULTI_KEYS = [
  'intern',
  'tarikKukulj',
  'rizvan',
  'tarikSehic',
  'arnes',
  'nadia',
  'benjamin',
  'nedim',
  'sabahudin',
  'dino',
  'hamzaT',
];

const recommendations = [
  {
    key: 'nadiaMeridian',
    internKey: 'nadia',
    positionSlug: 'frontend-engineer',
    projectKey: 'meridian',
    technologies: ['react', 'next-js'],
    status: 'interviewing',
    createdByKey: 'mentor',
    recommendedWorkdaysAgo: 12,
    interviewingWorkdaysAgo: 5,
    recommendationNote:
      'Strongest front-end intern this cycle. Owned the roster filter end to end and reviews others’ work carefully. Ready for a client-facing React role.',
    interviews: [
      {
        company: 'Meridian Health',
        role: 'Frontend Engineer',
        stage: 'Technical screen',
        scheduledWorkdaysAgo: 4,
        interviewers: ['Dario Kovač', 'Lena Fischer'],
        locationNote: 'Remote — Google Meet',
        feedback: {
          summary: 'Solid React fundamentals, explained trade-offs clearly.',
          strengths: 'Component design, testing instincts, communication.',
          concerns: 'Limited exposure to their design-system tooling.',
          rating: 4,
        },
      },
      {
        company: 'Meridian Health',
        role: 'Frontend Engineer',
        stage: 'Final — team fit',
        scheduledWorkdaysAhead: 2,
        interviewers: ['Lena Fischer', 'Marc Weber'],
        locationNote: 'Remote — Google Meet',
      },
    ],
  },
  {
    key: 'benjaminKestrel',
    internKey: 'benjamin',
    positionSlug: 'backend-engineer',
    projectKey: 'kestrel',
    technologies: ['spring-boot', 'go'],
    status: 'recommended',
    createdByKey: 'mentor',
    recommendedWorkdaysAgo: 3,
    recommendationNote:
      'Comfortable across Spring Boot and Go. Picked up the payments domain quickly during the shadow rotation — good fit for the Kestrel API team.',
    interviews: [],
  },
  {
    key: 'nedimNorthwind',
    internKey: 'nedim',
    positionSlug: 'fullstack-engineer',
    projectKey: 'northwind',
    technologies: ['angular', 'dotnet'],
    status: 'interviewing',
    createdByKey: 'boris',
    recommendedWorkdaysAgo: 15,
    interviewingWorkdaysAgo: 8,
    recommendationNote:
      'Angular + .NET is exactly the Northwind stack. Reliable, methodical, asks good questions in review.',
    interviews: [
      {
        company: 'Northwind Logistics',
        role: 'Fullstack Engineer',
        stage: 'First round',
        scheduledWorkdaysAgo: 7,
        interviewers: ['Ivan Horvat'],
        locationNote: 'Belgrade office',
        feedback: {
          summary: 'Good coverage of both ends of the stack.',
          strengths: 'Pragmatic, clear about what he does not know.',
          concerns: 'Wants more real-time/streaming experience for the tracker work.',
          rating: 4,
        },
      },
    ],
  },
  {
    key: 'amarOpen',
    internKey: 'amar',
    positionSlug: 'ml-engineer',
    // No client yet — points at the locked `unspecified` sentinel.
    projectKey: null,
    technologies: ['machine-learning', 'data-science'],
    status: 'recommended',
    createdByKey: 'mentor',
    recommendedWorkdaysAgo: 6,
    recommendationNote:
      'Ready for an ML role; no matching client opening yet. Keep on the bench and revisit when the data platform work lands.',
    interviews: [],
  },
  {
    key: 'sabahudinBlueHarbour',
    internKey: 'sabahudin',
    positionSlug: 'data-analyst',
    projectKey: 'blueharbour',
    technologies: ['data-science', 'data-engineering'],
    status: 'resulted',
    createdByKey: 'natasa',
    recommendedWorkdaysAgo: 30,
    interviewingWorkdaysAgo: 22,
    resultedWorkdaysAgo: 14,
    recommendationNote:
      'Strong analyst profile, put forward for the Blue Harbour reporting workstream.',
    interviews: [
      {
        company: 'Blue Harbour Retail',
        role: 'Data Analyst',
        stage: 'Technical screen',
        scheduledWorkdaysAgo: 20,
        interviewers: ['Sanja Kos'],
        locationNote: 'Remote',
        feedback: {
          summary: 'Good SQL and modelling, less confident on their BI stack.',
          strengths: 'Analytical thinking, clear written communication.',
          concerns: 'No hands-on Power BI, which the role leans on heavily.',
          rating: 3,
        },
      },
    ],
    result: {
      outcome: 'not_placed',
      note: 'Client paused the POS refresh before making an offer. Sabahudin stays on the bench and is being put forward for the Meridian reporting role next.',
      decidedByKey: 'natasa',
    },
  },
  {
    key: 'filipKestrel',
    internKey: 'filip',
    positionSlug: 'backend-engineer',
    projectKey: 'kestrel',
    technologies: ['spring-boot', 'go'],
    status: 'resulted',
    createdByKey: 'mentor',
    recommendedWorkdaysAgo: 55,
    interviewingWorkdaysAgo: 45,
    resultedWorkdaysAgo: 35,
    recommendationNote: 'Put forward for the payments API team after a strong FEP finish.',
    interviews: [
      {
        company: 'Kestrel Fintech',
        role: 'Backend Engineer',
        stage: 'Final',
        scheduledWorkdaysAgo: 40,
        interviewers: ['Tom Reid', 'Ana Šarić'],
        locationNote: 'Remote',
        feedback: {
          summary: 'Best candidate they saw in the round.',
          strengths: 'Spring Boot depth, calm under pressure, good system design.',
          concerns: 'None material.',
          rating: 5,
        },
      },
    ],
    result: {
      outcome: 'placed',
      note: 'Offer accepted — started on the Kestrel payments API team. Client specifically asked for more candidates like him.',
      decidedByKey: 'mentor',
    },
  },
  {
    key: 'adnaMeridian',
    internKey: 'adna',
    positionSlug: 'frontend-engineer',
    projectKey: 'meridian',
    technologies: ['react', 'vue-js'],
    status: 'resulted',
    createdByKey: 'boris',
    recommendedWorkdaysAgo: 50,
    interviewingWorkdaysAgo: 42,
    resultedWorkdaysAgo: 30,
    recommendationNote:
      'Front-end generalist, strong on accessibility. Good fit for the portal work.',
    interviews: [
      {
        company: 'Meridian Health',
        role: 'Frontend Engineer',
        stage: 'Final',
        scheduledWorkdaysAgo: 34,
        interviewers: ['Lena Fischer'],
        locationNote: 'Remote',
        feedback: {
          summary: 'Very strong on accessibility, which the portal needs.',
          strengths: 'A11y knowledge, CSS depth, thoughtful questions.',
          concerns: 'Wants mentoring on state management at scale.',
          rating: 4,
        },
      },
    ],
    result: {
      outcome: 'placed',
      note: 'Offer accepted — joined the patient portal squad as a front-end engineer.',
      decidedByKey: 'boris',
    },
  },
  {
    key: 'lamijaNorthwind',
    internKey: 'lamija',
    positionSlug: 'qa-engineer',
    projectKey: 'northwind',
    technologies: ['test-automation', 'manual-qa'],
    status: 'recommended',
    createdByKey: 'mentor',
    recommendedWorkdaysAgo: 2,
    recommendationNote:
      'Built out most of our Playwright coverage during the QA rotation. Northwind asked for a test-automation profile — good first match.',
    interviews: [],
  },
  {
    key: 'kenanMeridian',
    internKey: 'kenan',
    positionSlug: 'fullstack-engineer',
    projectKey: 'meridian',
    technologies: ['react', 'node-js'],
    status: 'resulted',
    createdByKey: 'mentor',
    recommendedWorkdaysAgo: 60,
    interviewingWorkdaysAgo: 52,
    resultedWorkdaysAgo: 44,
    recommendationNote: 'Full-stack generalist, comfortable owning a vertical slice end to end.',
    interviews: [
      {
        company: 'Meridian Health',
        role: 'Fullstack Engineer',
        stage: 'Final',
        scheduledWorkdaysAgo: 48,
        interviewers: ['Lena Fischer', 'Marc Weber'],
        locationNote: 'Remote',
        feedback: {
          summary: 'Handled the system-design round better than expected.',
          strengths: 'Breadth, pragmatic trade-offs, easy to talk to.',
          concerns: 'Little exposure to healthcare compliance — will need ramp-up.',
          rating: 4,
        },
      },
    ],
    result: {
      outcome: 'placed',
      note: 'Offer accepted — joined the patient portal squad alongside Adna.',
      decidedByKey: 'mentor',
    },
  },
  {
    key: 'milicaNorthwind',
    internKey: 'milica',
    positionSlug: 'data-engineer',
    projectKey: 'northwind',
    technologies: ['data-engineering', 'fastapi'],
    status: 'resulted',
    createdByKey: 'natasa',
    recommendedWorkdaysAgo: 68,
    interviewingWorkdaysAgo: 60,
    resultedWorkdaysAgo: 50,
    recommendationNote:
      'Strongest data profile of her cohort. Owned the reporting pipeline rewrite during the industrial track.',
    interviews: [
      {
        company: 'Northwind Logistics',
        role: 'Data Engineer',
        stage: 'Final',
        scheduledWorkdaysAgo: 55,
        interviewers: ['Ivan Horvat', 'Sanja Kos'],
        locationNote: 'Novi Sad office',
        feedback: {
          summary: 'Clear thinker, strong on pipeline design.',
          strengths: 'Airflow experience, good instincts on data quality.',
          concerns: 'None material.',
          rating: 5,
        },
      },
    ],
    result: {
      outcome: 'placed',
      note: 'Offer accepted — now on the fleet-tracker data platform team.',
      decidedByKey: 'natasa',
    },
  },
  {
    key: 'harisKestrel',
    internKey: 'haris',
    positionSlug: 'devops-engineer',
    projectKey: 'kestrel',
    technologies: ['devops', 'go'],
    status: 'resulted',
    createdByKey: 'boris',
    recommendedWorkdaysAgo: 58,
    interviewingWorkdaysAgo: 49,
    resultedWorkdaysAgo: 40,
    recommendationNote:
      'Ran our staging pipeline for two months without incident. Kestrel needed a platform hire.',
    interviews: [
      {
        company: 'Kestrel Fintech',
        role: 'Platform Engineer',
        stage: 'Technical screen',
        scheduledWorkdaysAgo: 45,
        interviewers: ['Tom Reid'],
        locationNote: 'Remote',
        feedback: {
          summary: 'Solid on Kubernetes and CI, asked sharp questions about their release process.',
          strengths: 'Automation instincts, calm debugging.',
          concerns: 'Wants more exposure to production incident response.',
          rating: 4,
        },
      },
    ],
    result: {
      outcome: 'placed',
      note: 'Offer accepted — joined the Kestrel platform team on a 12-month contract.',
      decidedByKey: 'boris',
    },
  },
  {
    key: 'vedranaBlueHarbour',
    internKey: 'vedrana',
    positionSlug: 'product-designer',
    projectKey: 'blueharbour',
    technologies: ['react'],
    status: 'resulted',
    createdByKey: 'boris',
    recommendedWorkdaysAgo: 90,
    interviewingWorkdaysAgo: 82,
    resultedWorkdaysAgo: 74,
    recommendationNote: 'Put forward for the POS design workstream at the end of her 1-on-1 track.',
    interviews: [
      {
        company: 'Blue Harbour Retail',
        role: 'Product Designer',
        stage: 'Portfolio review',
        scheduledWorkdaysAgo: 79,
        interviewers: ['Sanja Kos'],
        locationNote: 'Remote',
        feedback: {
          summary: 'Strong portfolio, but thin on in-store/retail context.',
          strengths: 'Visual craft, clear rationale for each decision.',
          concerns: 'No POS or kiosk experience, which this role is mostly about.',
          rating: 3,
        },
      },
    ],
    result: {
      outcome: 'not_placed',
      note: 'Client went with a candidate who had prior retail POS work. Vedrana finished the programme and is on the alumni list for the next design opening.',
      decidedByKey: 'boris',
    },
  },

  // ── currently-active interns: open stages only ─────────────────────────────
  {
    key: 'internMeridian',
    internKey: 'intern',
    positionSlug: 'frontend-engineer',
    projectKey: 'meridian',
    technologies: ['react', 'next-js'],
    status: 'interviewing',
    createdByKey: 'mentor',
    recommendedWorkdaysAgo: 11,
    interviewingWorkdaysAgo: 5,
    recommendationNote:
      'Meridian opened a second front-end seat on the portal squad. Hamza owned the roster filter end to end and is the natural second candidate alongside Nadia.',
    interviews: [
      {
        company: 'Meridian Health',
        role: 'Frontend Engineer',
        stage: 'Technical screen',
        scheduledWorkdaysAgo: 4,
        interviewers: ['Dario Kovač'],
        locationNote: 'Remote — Google Meet',
        feedback: {
          summary:
            'Strong React fundamentals for his tenure; walked through the filter rewrite well.',
          strengths: 'Component design, asks for review early, clear written updates.',
          concerns: 'Has not worked inside a large design system yet.',
          rating: 4,
        },
      },
      {
        company: 'Meridian Health',
        role: 'Frontend Engineer',
        stage: 'Final — team fit',
        scheduledWorkdaysAhead: 4,
        interviewers: ['Lena Fischer', 'Marc Weber'],
        locationNote: 'Remote — Google Meet',
      },
    ],
  },
  {
    key: 'internBench',
    internKey: 'intern',
    positionSlug: 'frontend-engineer',
    // Bench entry — no client attached, so it points at the locked sentinel.
    projectKey: null,
    technologies: ['react', 'node-js'],
    status: 'recommended',
    createdByKey: 'mentor',
    recommendedWorkdaysAgo: 3,
    recommendationNote:
      'Kept on the bench for the Node BFF work in case the Meridian front-end seat goes to Nadia. Either way he is placeable this quarter.',
    interviews: [],
  },
  {
    key: 'tarikKukuljKestrel',
    internKey: 'tarikKukulj',
    positionSlug: 'backend-engineer',
    projectKey: 'kestrel',
    technologies: ['node-js', 'go'],
    status: 'interviewing',
    createdByKey: 'mentor',
    recommendedWorkdaysAgo: 14,
    interviewingWorkdaysAgo: 6,
    recommendationNote:
      'Owns the ticket-export batching work in Go. Kestrel needs a second engineer on the edge services and the stack lines up exactly.',
    interviews: [
      {
        company: 'Kestrel Fintech',
        role: 'Backend Engineer',
        stage: 'Technical screen',
        scheduledWorkdaysAgo: 5,
        interviewers: ['Tom Reid'],
        locationNote: 'Remote',
        feedback: {
          summary:
            'Good Go fundamentals; reasoned clearly about the paging bug he shipped a fix for.',
          strengths: 'Debugging, reads unfamiliar code quickly, asks precise questions.',
          concerns: 'No production payments or PSD2 exposure.',
          rating: 4,
        },
      },
    ],
  },
  {
    key: 'tarikKukuljNorthwind',
    internKey: 'tarikKukulj',
    positionSlug: 'backend-engineer',
    projectKey: 'northwind',
    technologies: ['node-js'],
    status: 'recommended',
    createdByKey: 'mentor',
    recommendedWorkdaysAgo: 4,
    recommendationNote:
      'Second option for the Northwind services team if Kestrel fills its seat internally. Not pushed hard yet — Kestrel is further along.',
    interviews: [],
  },
  {
    key: 'rizvanNorthwind',
    internKey: 'rizvan',
    positionSlug: 'fullstack-engineer',
    projectKey: 'northwind',
    technologies: ['dotnet', 'react'],
    status: 'interviewing',
    createdByKey: 'mentor',
    recommendedWorkdaysAgo: 12,
    interviewingWorkdaysAgo: 5,
    recommendationNote:
      'The most experienced intern on the roster — .NET plus React covers both ends of the fleet tracker.',
    interviews: [
      {
        company: 'Northwind Logistics',
        role: 'Fullstack Engineer',
        stage: 'First round',
        scheduledWorkdaysAgo: 4,
        interviewers: ['Ivan Horvat'],
        locationNote: 'Belgrade office',
        feedback: {
          summary:
            'Covered both ends of the stack comfortably; good instincts on the tracker data flow.',
          strengths: 'Breadth, ownership, explains trade-offs without prompting.',
          concerns: 'Wants a steer on real-time/streaming patterns.',
          rating: 4,
        },
      },
    ],
  },
  {
    key: 'rizvanMeridian',
    internKey: 'rizvan',
    positionSlug: 'fullstack-engineer',
    projectKey: 'meridian',
    technologies: ['react', 'node-js'],
    status: 'recommended',
    createdByKey: 'mentor',
    recommendedWorkdaysAgo: 3,
    recommendationNote:
      'Also a fit for the Meridian BFF work. Filed so the portal squad has a full-stack option on the list.',
    interviews: [],
  },
  {
    key: 'tarikSehicNorthwind',
    internKey: 'tarikSehic',
    positionSlug: 'qa-engineer',
    projectKey: 'northwind',
    technologies: ['test-automation', 'manual-qa'],
    status: 'interviewing',
    createdByKey: 'mentor',
    recommendedWorkdaysAgo: 16,
    interviewingWorkdaysAgo: 7,
    recommendationNote:
      'Northwind asked for a QA pair. Early in his shadow track, but he has been the most consistent bug reporter on the board.',
    interviews: [
      {
        company: 'Northwind Logistics',
        role: 'QA Engineer',
        stage: 'First round',
        scheduledWorkdaysAgo: 6,
        interviewers: ['Ivan Horvat'],
        locationNote: 'Remote',
        feedback: {
          summary: 'Careful, methodical tester; automation experience is still thin.',
          strengths: 'Reproduction steps, attention to detail, takes feedback well.',
          concerns: 'Only six weeks in — would need a QA lead on the client side.',
          rating: 3,
        },
      },
    ],
  },
  {
    key: 'tarikSehicBench',
    internKey: 'tarikSehic',
    positionSlug: 'qa-engineer',
    projectKey: null,
    technologies: ['manual-qa'],
    status: 'recommended',
    createdByKey: 'mentor',
    recommendedWorkdaysAgo: 5,
    recommendationNote:
      'On the bench for any manual-QA opening that comes up before his shadow track ends.',
    interviews: [],
  },
  {
    key: 'anaNorthwind',
    internKey: 'ana',
    positionSlug: 'data-engineer',
    projectKey: 'northwind',
    technologies: ['data-engineering', 'fastapi'],
    status: 'recommended',
    createdByKey: 'boris',
    recommendedWorkdaysAgo: 7,
    recommendationNote:
      'Picking up the reporting pipeline work Milica left behind. Worth putting in front of Northwind now that there is a second data seat.',
    interviews: [],
  },
  {
    key: 'emirBench',
    internKey: 'emir',
    positionSlug: 'devops-engineer',
    projectKey: null,
    technologies: ['devops', 'go'],
    status: 'recommended',
    createdByKey: 'boris',
    recommendedWorkdaysAgo: 4,
    recommendationNote:
      'Technically ready for a platform rotation, but attendance has been patchy this month — filed now so the conversation happens, not pushed to a client yet.',
    interviews: [],
  },
  {
    key: 'saraMeridian',
    internKey: 'sara',
    positionSlug: 'frontend-engineer',
    projectKey: 'meridian',
    technologies: ['react'],
    status: 'recommended',
    createdByKey: 'mentor',
    recommendedWorkdaysAgo: 6,
    recommendationNote:
      'Solid React work on the board and improving fast. Third front-end name for the portal squad shortlist.',
    interviews: [],
  },
  {
    key: 'arnesNorthwind',
    internKey: 'arnes',
    positionSlug: 'mobile-engineer',
    projectKey: 'northwind',
    technologies: ['react-native'],
    status: 'interviewing',
    createdByKey: 'natasa',
    recommendedWorkdaysAgo: 15,
    interviewingWorkdaysAgo: 6,
    recommendationNote:
      'Northwind wants a driver-app companion to the tracker. Arnes is the only react-native profile on the roster.',
    interviews: [
      {
        company: 'Northwind Logistics',
        role: 'Mobile Engineer',
        stage: 'First round',
        scheduledWorkdaysAgo: 5,
        interviewers: ['Ivan Horvat'],
        locationNote: 'Novi Sad office',
        feedback: {
          summary:
            'Knows react-native well for his tenure; vague on offline sync, which the driver app needs.',
          strengths: 'Mobile fundamentals, keen to learn, good demo of his own side project.',
          concerns: 'Would need a mobile lead on the client side.',
          rating: 3,
        },
      },
    ],
  },
  {
    key: 'arnesBlueHarbour',
    internKey: 'arnes',
    positionSlug: 'mobile-engineer',
    projectKey: 'blueharbour',
    technologies: ['react-native', 'kotlin'],
    status: 'recommended',
    createdByKey: 'natasa',
    recommendedWorkdaysAgo: 9,
    recommendationNote:
      'Obvious match for the POS kiosk app, but Blue Harbour is still waiting on budget sign-off. Parked until the project comes off hold.',
    interviews: [],
  },
  {
    key: 'dzenanaKestrel',
    internKey: 'dzenana',
    positionSlug: 'backend-engineer',
    projectKey: 'kestrel',
    technologies: ['spring-boot', 'go'],
    status: 'interviewing',
    createdByKey: 'mentor',
    recommendedWorkdaysAgo: 10,
    interviewingWorkdaysAgo: 4,
    recommendationNote:
      'Longest-tenured intern on the roster and marked ready on the backend position. Kestrel is the strongest match available.',
    interviews: [
      {
        company: 'Kestrel Fintech',
        role: 'Backend Engineer',
        stage: 'Technical screen',
        scheduledWorkdaysAgo: 3,
        interviewers: ['Tom Reid', 'Ana Šarić'],
        locationNote: 'Remote',
        feedback: {
          summary: 'Best intern-level system design they have seen this round.',
          strengths: 'Spring Boot depth, clean API design, calm and precise.',
          concerns: 'None material.',
          rating: 5,
        },
      },
    ],
  },
  {
    key: 'stefanBench',
    internKey: 'stefan',
    positionSlug: 'qa-engineer',
    projectKey: null,
    technologies: ['test-automation'],
    status: 'recommended',
    createdByKey: 'natasa',
    recommendedWorkdaysAgo: 2,
    recommendationNote:
      'Four weeks into the core-tool track — filed early so he shows up on the bench, not as a client-ready candidate yet.',
    interviews: [],
  },

  // ── ready-for-placement interns: a rejected attempt behind the open one ────
  {
    key: 'nadiaKestrel',
    internKey: 'nadia',
    positionSlug: 'frontend-engineer',
    projectKey: 'kestrel',
    technologies: ['react', 'node-js'],
    status: 'resulted',
    createdByKey: 'mentor',
    recommendedWorkdaysAgo: 45,
    interviewingWorkdaysAgo: 38,
    resultedWorkdaysAgo: 30,
    recommendationNote:
      'First placement attempt — Kestrel needed a front-end engineer on the merchant console.',
    interviews: [
      {
        company: 'Kestrel Fintech',
        role: 'Frontend Engineer',
        stage: 'Technical screen',
        scheduledWorkdaysAgo: 36,
        interviewers: ['Tom Reid'],
        locationNote: 'Remote',
        feedback: {
          summary: 'No technical concerns; the gap was experience, not ability.',
          strengths: 'React depth, testing instincts, very clear communicator.',
          concerns: 'Client wanted someone who had already shipped inside a design system.',
          rating: 4,
        },
      },
    ],
    result: {
      outcome: 'not_placed',
      note: 'Kestrel filled the seat with an internal transfer before the final round. Nadia went straight back on the bench and is now interviewing with Meridian.',
      decidedByKey: 'mentor',
    },
  },
  {
    key: 'benjaminBlueHarbour',
    internKey: 'benjamin',
    positionSlug: 'backend-engineer',
    projectKey: 'blueharbour',
    technologies: ['go'],
    status: 'resulted',
    createdByKey: 'mentor',
    recommendedWorkdaysAgo: 34,
    interviewingWorkdaysAgo: 26,
    resultedWorkdaysAgo: 18,
    recommendationNote: 'Put forward for the POS backend services before the project went on hold.',
    interviews: [
      {
        company: 'Blue Harbour Retail',
        role: 'Backend Engineer',
        stage: 'Technical screen',
        scheduledWorkdaysAgo: 24,
        interviewers: ['Sanja Kos'],
        locationNote: 'Remote',
        feedback: {
          summary: 'Good conversation; the client liked him and said so.',
          strengths: 'Go and Spring Boot both solid, pragmatic about trade-offs.',
          concerns: 'None raised.',
          rating: 4,
        },
      },
    ],
    result: {
      outcome: 'not_placed',
      note: 'Blue Harbour paused the POS refresh before a final round could be scheduled. Benjamin is now put forward for the Kestrel API team instead.',
      decidedByKey: 'mentor',
    },
  },
  {
    key: 'nedimBlueHarbour',
    internKey: 'nedim',
    positionSlug: 'fullstack-engineer',
    projectKey: 'blueharbour',
    technologies: ['angular'],
    status: 'resulted',
    createdByKey: 'boris',
    recommendedWorkdaysAgo: 40,
    interviewingWorkdaysAgo: 33,
    resultedWorkdaysAgo: 25,
    recommendationNote: 'First attempt — the POS back-office console was an Angular job.',
    interviews: [
      {
        company: 'Blue Harbour Retail',
        role: 'Fullstack Engineer',
        stage: 'First round',
        scheduledWorkdaysAgo: 31,
        interviewers: ['Sanja Kos'],
        locationNote: 'Remote',
        feedback: {
          summary: 'Competent but quiet in the interview; came across less confident than he is.',
          strengths: 'Angular experience, methodical, honest about gaps.',
          concerns: 'Client wanted someone more comfortable talking to store staff directly.',
          rating: 3,
        },
      },
    ],
    result: {
      outcome: 'not_placed',
      note: 'Project paused before a decision. Moved to Northwind, where he is now interviewing for the fleet tracker.',
      decidedByKey: 'boris',
    },
  },
  {
    key: 'sabahudinMeridian',
    internKey: 'sabahudin',
    positionSlug: 'data-analyst',
    projectKey: 'meridian',
    technologies: ['data-science', 'data-engineering'],
    status: 'interviewing',
    createdByKey: 'natasa',
    recommendedWorkdaysAgo: 10,
    interviewingWorkdaysAgo: 4,
    recommendationNote:
      'The Meridian reporting role flagged in the Blue Harbour debrief. No Power BI dependency this time, which was the blocker there.',
    interviews: [
      {
        company: 'Meridian Health',
        role: 'Data Analyst',
        stage: 'Technical screen',
        scheduledWorkdaysAgo: 3,
        interviewers: ['Marc Weber'],
        locationNote: 'Remote',
        feedback: {
          summary:
            'Strong SQL round; the modelling exercise went better than the Blue Harbour one.',
          strengths: 'Analytical thinking, clear written summaries, learns tooling fast.',
          concerns: 'Needs an introduction to clinical data conventions.',
          rating: 4,
        },
      },
      {
        company: 'Meridian Health',
        role: 'Data Analyst',
        stage: 'Final — team fit',
        scheduledWorkdaysAhead: 3,
        interviewers: ['Marc Weber', 'Lena Fischer'],
        locationNote: 'Remote',
      },
    ],
  },

  // ── alumni: completed / discontinued, so every recommendation is closed ────
  {
    key: 'dinoKestrel',
    internKey: 'dino',
    positionSlug: 'devops-engineer',
    projectKey: 'kestrel',
    technologies: ['devops'],
    status: 'resulted',
    createdByKey: 'natasa',
    recommendedWorkdaysAgo: 96,
    interviewingWorkdaysAgo: 88,
    resultedWorkdaysAgo: 80,
    recommendationNote:
      'First attempt, halfway through his industrial track — Kestrel was hiring for platform.',
    interviews: [
      {
        company: 'Kestrel Fintech',
        role: 'Platform Engineer',
        stage: 'Technical screen',
        scheduledWorkdaysAgo: 86,
        interviewers: ['Tom Reid'],
        locationNote: 'Remote',
        feedback: {
          summary: 'Knew the CI side well, thinner on orchestration.',
          strengths: 'Pipeline automation, willing to dig into failures.',
          concerns: 'Wanted more Kubernetes depth than Dino had at that point.',
          rating: 3,
        },
      },
    ],
    result: {
      outcome: 'not_placed',
      note: 'Kestrel went with a more senior platform hire. Dino kept running our staging pipeline and was re-recommended two months later.',
      decidedByKey: 'natasa',
    },
  },
  {
    key: 'dinoNorthwind',
    internKey: 'dino',
    positionSlug: 'devops-engineer',
    projectKey: 'northwind',
    technologies: ['devops'],
    status: 'resulted',
    createdByKey: 'natasa',
    recommendedWorkdaysAgo: 70,
    interviewingWorkdaysAgo: 62,
    resultedWorkdaysAgo: 54,
    recommendationNote:
      'Second attempt, and a much stronger one — by then he had run our staging pipeline for two months without incident.',
    interviews: [
      {
        company: 'Northwind Logistics',
        role: 'DevOps Engineer',
        stage: 'First round',
        scheduledWorkdaysAgo: 60,
        interviewers: ['Ivan Horvat'],
        locationNote: 'Novi Sad office',
        feedback: {
          summary: 'Clear improvement on the earlier round; the team wanted him.',
          strengths: 'CI/CD, incident write-ups, calm under questioning.',
          concerns: 'No on-call experience.',
          rating: 4,
        },
      },
    ],
    result: {
      outcome: 'not_placed',
      note: 'Northwind froze platform headcount for the quarter after the final round was already booked. No offer was made — this one was budget, not fit.',
      decidedByKey: 'natasa',
    },
  },
  {
    key: 'dinoBench',
    internKey: 'dino',
    positionSlug: 'devops-engineer',
    projectKey: null,
    technologies: ['devops'],
    status: 'resulted',
    // No interviewingWorkdaysAgo: closed before any client interview.
    createdByKey: 'natasa',
    recommendedWorkdaysAgo: 46,
    resultedWorkdaysAgo: 34,
    recommendationNote: 'Third and last attempt — kept on the bench for the next platform opening.',
    interviews: [],
    result: {
      outcome: 'not_placed',
      note: 'No client opening came up before his industrial track ended, so this was closed when he completed the programme. Strong alumni candidate — re-recommend the moment platform work lands.',
      decidedByKey: 'natasa',
    },
  },
  {
    key: 'hanaBlueHarbour',
    internKey: 'hana',
    positionSlug: 'qa-engineer',
    projectKey: 'blueharbour',
    technologies: ['manual-qa', 'test-automation'],
    status: 'resulted',
    createdByKey: 'mentor',
    recommendedWorkdaysAgo: 60,
    interviewingWorkdaysAgo: 52,
    resultedWorkdaysAgo: 44,
    recommendationNote: 'Put forward for POS release testing at the end of her FEP track.',
    interviews: [
      {
        company: 'Blue Harbour Retail',
        role: 'QA Engineer',
        stage: 'Technical screen',
        scheduledWorkdaysAgo: 50,
        interviewers: ['Sanja Kos'],
        locationNote: 'Remote',
        feedback: {
          summary: 'Good test design; the seniority bar was the problem, not the skills.',
          strengths: 'Thorough regression thinking, wrote up findings clearly.',
          concerns: 'Role needed someone who had owned a release sign-off before.',
          rating: 4,
        },
      },
    ],
    result: {
      outcome: 'not_placed',
      note: 'Client paused the POS refresh before deciding. Hana finished the programme and is on the alumni list for the next QA opening.',
      decidedByKey: 'mentor',
    },
  },
  {
    key: 'hamzaTBlueHarbour',
    internKey: 'hamzaT',
    positionSlug: 'mobile-engineer',
    projectKey: 'blueharbour',
    technologies: ['flutter'],
    status: 'resulted',
    createdByKey: 'boris',
    recommendedWorkdaysAgo: 62,
    interviewingWorkdaysAgo: 54,
    resultedWorkdaysAgo: 46,
    recommendationNote:
      'Only mobile candidate available when Blue Harbour asked about the kiosk app.',
    interviews: [
      {
        company: 'Blue Harbour Retail',
        role: 'Mobile Engineer',
        stage: 'Technical screen',
        scheduledWorkdaysAgo: 52,
        interviewers: ['Sanja Kos'],
        locationNote: 'Remote',
        feedback: {
          summary: 'Fine on Flutter, but the team does not use it.',
          strengths: 'Flutter widget work, decent UI instincts.',
          concerns: 'The kiosk app is react-native; Flutter-only experience was the blocker.',
          rating: 3,
        },
      },
    ],
    result: {
      outcome: 'not_placed',
      note: 'Client wanted react-native, not Flutter. Flagged in his plan as the next thing to pick up.',
      decidedByKey: 'boris',
    },
  },
  {
    key: 'hamzaTBench',
    internKey: 'hamzaT',
    positionSlug: 'mobile-engineer',
    projectKey: null,
    technologies: ['flutter'],
    status: 'resulted',
    // No interviewingWorkdaysAgo: he left before anything was scheduled.
    createdByKey: 'boris',
    recommendedWorkdaysAgo: 40,
    resultedWorkdaysAgo: 32,
    recommendationNote: 'Kept on the bench while he picked up react-native.',
    interviews: [],
    result: {
      outcome: 'not_placed',
      note: 'Closed unplaced when Hamza left the programme — no client interviews were ever scheduled for this one.',
      decidedByKey: 'boris',
    },
  },
  {
    key: 'goranBench',
    internKey: 'goran',
    positionSlug: 'security-engineer',
    projectKey: null,
    technologies: ['go'],
    status: 'resulted',
    // No interviewingWorkdaysAgo: no client ever had a security opening.
    createdByKey: 'natasa',
    recommendedWorkdaysAgo: 48,
    resultedWorkdaysAgo: 40,
    recommendationNote:
      'Security is a thin market for us — filed to keep him visible rather than against a live opening.',
    interviews: [],
    result: {
      outcome: 'not_placed',
      note: 'No client security opening came up. Closed when Goran left the programme; his account was deactivated the same week.',
      decidedByKey: 'natasa',
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Evaluations & mentor notes
// ─────────────────────────────────────────────────────────────────────────────
//
// Keyed by attendance persona (and `alumni` for terminal statuses) so the
// numbers tell the same story as the attendance figures on screen: the star's
// scores climb, the struggling intern's evaluation says what the 65% shows.

const evaluationProfiles = {
  star: {
    first: { technical: 4, communication: 4, ownership: 4, growth: 5 },
    second: { technical: 5, communication: 5, ownership: 5, growth: 5 },
    firstNotes:
      'Ramped up faster than expected. Takes a task to done without hand-holding and asks precise questions.',
    secondNotes:
      'Now reviewing other interns’ PRs and catching real issues. Ready for client-facing work.',
  },
  solid: {
    first: { technical: 3, communication: 4, ownership: 3, growth: 4 },
    second: { technical: 4, communication: 4, ownership: 4, growth: 4 },
    firstNotes: 'Steady progress, good collaborator. Needs a nudge to break large tasks down.',
    secondNotes: 'Consistently delivering. Estimation has improved noticeably this period.',
  },
  average: {
    first: { technical: 3, communication: 3, ownership: 3, growth: 3 },
    second: { technical: 3, communication: 4, ownership: 3, growth: 4 },
    firstNotes: 'Meeting expectations. Would benefit from pairing more often on unfamiliar code.',
    secondNotes: 'Communication has improved; technical depth is the focus for next period.',
  },
  struggling: {
    first: { technical: 2, communication: 3, ownership: 2, growth: 3 },
    second: { technical: 2, communication: 3, ownership: 3, growth: 3 },
    firstNotes:
      'Attendance has been inconsistent and it is showing in delivery. Agreed a weekly check-in to get back on track.',
    secondNotes:
      'Some improvement in ownership, but attendance is still the blocker. Escalated to the programme lead.',
  },
  alumni: {
    first: { technical: 4, communication: 4, ownership: 4, growth: 4 },
    second: { technical: 5, communication: 4, ownership: 5, growth: 4 },
    firstNotes: 'Strong second half of the programme.',
    secondNotes: 'Finished the programme comfortably above the bar.',
  },
};

// Mentor notes. `shared: true` puts admin + leadership on the note's `visibleTo`
// list; `shared: false` leaves it private to the authoring mentor.
//
// This is not cosmetic: mentorCommentService.canReadComment admits ONLY the
// author or someone explicitly in `visibleTo`, so a note with an empty list is
// invisible to admins. Every persona therefore has at least one shared note (so
// the admin's intern page isn't blank) and one private one (so the visibility
// control has something to demonstrate).
const mentorNotePools = {
  star: [
    {
      text: 'Handled the roster filter work end to end, including the edge case nobody had spotted.',
      shared: true,
    },
    {
      text: 'Volunteered to review the other interns’ PRs this sprint. Quality of feedback is genuinely useful.',
      shared: false,
    },
  ],
  solid: [
    {
      text: 'Good sprint. Asked for help at the right moment rather than getting stuck for a day.',
      shared: true,
    },
    {
      text: 'Estimation is getting more realistic — flagged a slipping task early this week.',
      shared: false,
    },
  ],
  average: [
    {
      text: 'Solid delivery on the smaller tickets. Pairing on the harder ones is helping.',
      shared: true,
    },
    { text: 'Would like to see more initiative in picking up unfamiliar areas.', shared: false },
  ],
  struggling: [
    {
      text: 'Missed three stand-ups this sprint. Talked it through — some personal commitments are getting in the way.',
      shared: true,
    },
    {
      text: 'Agreed a plan: shorter tickets, daily 10-minute sync, revisit in two weeks.',
      shared: true,
    },
  ],
  alumni: [
    {
      text: 'Finished the programme in good shape and left the codebase better than they found it.',
      shared: true,
    },
  ],
};

module.exports = {
  PASSWORD,
  HUB,
  heroes,
  mentors,
  interns,
  workspaces,
  categories,
  projects,
  tickets,
  notifications,
  dailies,
  recommendations,
  RECOMMENDATION_MULTI_KEYS,
  evaluationProfiles,
  mentorNotePools,
};
