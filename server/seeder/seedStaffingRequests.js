#!/usr/bin/env node
/**
 * Staffing-request seeder — `npm run seed:staffing-requests`
 *
 * Rebuilds the staffing-request dataset so every state the Requests screen can
 * render is present at once. NARROWLY DESTRUCTIVE: it deletes all
 * `StaffingRequest` documents and only those `Recommendation` documents that
 * carry a `staffingRequest` reference (i.e. ones a request produced). Ordinary
 * recommendations, interns, projects, users and reference data are untouched,
 * which is why this is safe to point at the shared dev cluster where the full
 * `seed:demo` is not.
 *
 * Notes are authored by an ADMIN, never by the request's leadership author —
 * the note is the admin's remark back to leadership, and the model enforces the
 * text/who/when triple. A cancellation reason goes to `closeNote` instead, so it
 * can never overwrite that note.
 *
 * Intern lifecycle is deliberately NOT touched: a placed recommendation here
 * does not flip `InternProfile.status` to `placed` the way the real fulfil flow
 * would. Keeping the footprint to two collections is worth that small
 * inconsistency in a fixture.
 *
 *   npm run seed:staffing-requests -- --dry-run    inspect the target, change nothing
 *   npm run seed:staffing-requests                 wipe and rebuild
 */

const path = require('path');

// Load env the way index.js does — see the long note in seedDemoData.js.
// Captured before the load because .env.development sets NODE_ENV itself.
const ENV_FILE = `.env.${process.env.NODE_ENV || 'development'}`;
require('dotenv').config({ path: path.join(__dirname, '..', ENV_FILE) });

const mongoose = require('mongoose');
const User = require('../models/User');
const Project = require('../models/Project');
const Position = require('../models/Position');
const Technology = require('../models/Technology');
const InternProfile = require('../models/InternProfile');
const Recommendation = require('../models/Recommendation');
const StaffingRequest = require('../models/StaffingRequest');

const DRY_RUN = process.argv.includes('--dry-run');

// Every date is an offset from one anchor so the fixture reads consistently
// ("3 weeks left" agrees with the date shown) within a run.
const ANCHOR = new Date();
const day = (offset) => {
  const date = new Date(ANCHOR);
  date.setDate(date.getDate() + offset);
  date.setHours(12, 0, 0, 0);
  return date;
};

const need = (value, label) => {
  if (!value) throw new Error(`Fixture needs ${label}, and the database has none`);
  return value;
};

/**
 * One entry per request, each chosen to exercise a distinct branch of the
 * screen rather than to look like plausible volume.
 */
const buildFixture = ({ projects, positions, technologies, interns }) => {
  const project = (fragment) =>
    need(
      projects.find((candidate) => candidate.name.toLowerCase().includes(fragment)),
      `a project matching "${fragment}"`
    );
  const position = (name) =>
    need(
      positions.find((candidate) => candidate.name === name),
      `the "${name}" position`
    );
  const techs = (...names) =>
    names
      .map((name) => technologies.find((candidate) => candidate.name === name))
      .filter(Boolean)
      .map((row) => row._id);

  // Interns cycle so the fixture doesn't need 30 distinct people; an intern can
  // legitimately be put forward on more than one project.
  let cursor = 0;
  const nextIntern = () => interns[cursor++ % interns.length];

  // Put-forward rows that aren't placed alternate between the two pre-result
  // statuses, so the suggestion card's status line has both to show.
  const suggest = (count, placedCount, technologyIds) =>
    Array.from({ length: count }, (_unused, index) => ({
      intern: nextIntern(),
      placed: index < placedCount,
      status: index % 2 === 0 ? 'interviewing' : 'recommended',
      technologies: technologyIds,
    }));

  return [
    {
      key: 'flagship-partial',
      why: 'Multi-position, partly filled, one position with nobody on it at all',
      project: project('northwind'),
      neededBy: day(49),
      note: {
        text: 'DevOps is the hold-up — both engineers I had in mind went to Kestrel. Frontend and backend are effectively done.',
        daysAgo: 6,
      },
      positions: [
        {
          position: position('Frontend Engineer'),
          count: 2,
          technologies: techs('React', 'Next.js'),
          suggestions: suggest(2, 1, techs('React')),
        },
        {
          position: position('Backend Engineer'),
          count: 4,
          technologies: techs('.NET', 'Spring Boot'),
          suggestions: suggest(3, 2, techs('.NET')),
        },
        {
          position: position('DevOps Engineer'),
          count: 2,
          technologies: techs('Test Automation'),
          suggestions: [],
        },
      ],
    },
    {
      key: 'nobody-yet',
      why: 'Open, unblocked, nobody put forward — the "waiting on an admin" banner',
      project: project('kestrel'),
      neededBy: day(21),
      positions: [
        {
          position: position('Backend Engineer'),
          count: 2,
          technologies: techs('.NET', 'FastAPI'),
          suggestions: [],
        },
        {
          position: position('QA Engineer'),
          count: 1,
          technologies: techs('Test Automation'),
          suggestions: [],
        },
      ],
    },
    {
      key: 'demand-met-still-open',
      why: 'Every seat placed but still open — the "an admin still needs to close it" banner',
      project: project('meridian'),
      neededBy: day(30),
      positions: [
        {
          position: position('Fullstack Engineer'),
          count: 2,
          technologies: techs('React', 'Django'),
          suggestions: suggest(2, 2, techs('React', 'Django')),
        },
        {
          position: position('Data Analyst'),
          count: 1,
          technologies: techs('Data Engineering'),
          suggestions: suggest(1, 1, techs('Data Engineering')),
        },
      ],
    },
    {
      key: 'overdue',
      why: 'Needed-by date already gone with seats unfilled — red date plus overdue banner',
      project: project('blue harbour'),
      neededBy: day(-12),
      note: {
        text: 'Slipped badly. Two of the three I put forward went elsewhere; I need another week to find a mobile engineer.',
        daysAgo: 3,
      },
      positions: [
        {
          position: position('Mobile Engineer'),
          count: 3,
          technologies: techs('Kotlin', 'Swift'),
          suggestions: suggest(2, 1, techs('Kotlin')),
        },
      ],
    },
    {
      key: 'draft-project-with-client',
      why: 'Draft project — nobody CAN be put forward, and the title has a client to prefix',
      draftProject: {
        name: 'KYC portal rebuild',
        client: 'Solstice Bank',
        description:
          'Replacing the vendor KYC flow. Not signed yet, so the project does not exist.',
      },
      neededBy: day(42),
      positions: [
        {
          position: position('Frontend Engineer'),
          count: 2,
          technologies: techs('React', 'Angular'),
          suggestions: [],
        },
        {
          position: position('Security Engineer'),
          count: 1,
          technologies: [],
          suggestions: [],
        },
      ],
    },
    {
      key: 'draft-no-client-no-date',
      why: 'Draft project with no client AND no needed-by — both fallbacks at once',
      draftProject: {
        name: 'Internal tooling revamp',
        client: '',
        description: 'Ours, not a client project. No deadline yet.',
      },
      neededBy: null,
      positions: [
        {
          position: position('Product Designer'),
          count: 1,
          technologies: [],
          suggestions: [],
        },
      ],
    },
    {
      key: 'over-supply',
      why: 'More people put forward than seats asked for — the surplus label',
      project: project('kestrel'),
      neededBy: day(35),
      note: {
        text: 'Put four forward for two seats deliberately — take your pick, the other two will wait for the next wave.',
        daysAgo: 1,
      },
      positions: [
        {
          position: position('Cloud Engineer'),
          count: 2,
          technologies: techs('Go'),
          suggestions: suggest(4, 1, techs('Go')),
        },
      ],
    },
    {
      key: 'large-request',
      why: "Seat count above the meter's segment limit — falls back to a proportional bar",
      project: project('northwind'),
      neededBy: day(90),
      positions: [
        {
          position: position('Data Engineer'),
          count: 18,
          technologies: techs('Data Engineering', 'Python'),
          suggestions: suggest(11, 6, techs('Data Engineering')),
        },
      ],
    },
    {
      key: 'closed-fulfilled',
      why: 'Closed as fulfilled — green badge, locked for good (no reopen)',
      project: project('meridian'),
      neededBy: day(-30),
      close: { reason: 'fulfilled', daysAgo: 9, by: 'admin' },
      note: {
        text: 'Both started on the 1st. The stronger of the two on the API side is Ivana.',
        daysAgo: 9,
      },
      positions: [
        {
          position: position('Backend Engineer'),
          count: 2,
          technologies: techs('Spring Boot'),
          suggestions: suggest(2, 2, techs('Spring Boot')),
        },
      ],
    },
    {
      key: 'closed-declined',
      why: 'Closed as declined — red badge, and the mandatory reason IS the admin note',
      project: project('blue harbour'),
      neededBy: day(14),
      close: { reason: 'declined', daysAgo: 4, by: 'admin' },
      note: {
        text: 'Declining this one: every ML-capable intern is already placed or in selection, and the next cohort does not start until October.',
        daysAgo: 4,
      },
      positions: [
        {
          position: position('ML Engineer'),
          count: 2,
          technologies: techs('Machine Learning'),
          suggestions: [],
        },
      ],
    },
    {
      key: 'closed-cancelled',
      why: 'Cancelled by leadership — grey badge, closeNote renders separately from the admin note it must not have overwritten, and one candidate closed out as demand-ended',
      project: project('kestrel'),
      neededBy: day(60),
      close: {
        reason: 'cancelled',
        daysAgo: 2,
        by: 'author',
        closeNote: 'Client pushed the whole phase to next year — we no longer need these seats.',
        // The shared reason the cascade writes onto everyone still in selection.
        // Internal: read by admins, leadership and mentors, never by the intern,
        // whose card reads off `demandEnded` instead.
        notPlacedReason: 'The client withdrew the ask before we could put anyone in front of them.',
      },
      note: {
        text: 'Had two frontend interns lined up for this before it was pulled.',
        daysAgo: 11,
      },
      positions: [
        {
          position: position('Frontend Engineer'),
          count: 2,
          technologies: techs('Svelte'),
          suggestions: suggest(1, 0, techs('Svelte')),
        },
      ],
    },
  ];
};

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const { name, host } = mongoose.connection;

  console.log(`\nenv file : ${ENV_FILE}`);
  console.log(`database : ${name}  @ ${host}`);

  const [admin, author, projects, positions, technologies, internProfiles] = await Promise.all([
    User.findOne({ role: 'admin' }).select('fullname').lean(),
    User.findOne({ role: 'leadership' }).select('fullname').lean(),
    Project.find({ isSystem: { $ne: true } })
      .select('name client')
      .lean(),
    Position.find().select('name').lean(),
    Technology.find({ isActive: true }).select('name').lean(),
    InternProfile.find({ status: { $in: ['active', 'ready', 'placed'] } })
      .select('user')
      .lean(),
  ]);

  need(admin, 'an admin user');
  need(author, 'a leadership user');
  if (internProfiles.length < 6) throw new Error('Fixture needs at least 6 usable intern profiles');

  const existingRequests = await StaffingRequest.countDocuments();
  const existingTagged = await Recommendation.countDocuments({ staffingRequest: { $ne: null } });
  const untagged = await Recommendation.countDocuments({ staffingRequest: null });

  console.log(`\nwill delete : ${existingRequests} staffing request(s)`);
  console.log(`            : ${existingTagged} recommendation(s) tagged to a request`);
  console.log(`will keep   : ${untagged} untagged recommendation(s), and every other collection`);

  const fixture = buildFixture({ projects, positions, technologies, interns: internProfiles });

  if (DRY_RUN) {
    console.log(`\n--dry-run: would create ${fixture.length} requests\n`);
    for (const entry of fixture) {
      console.log(`  ${entry.key.padEnd(28)} ${entry.why}`);
    }
    await mongoose.disconnect();
    return;
  }

  // Child before parent, so a crash mid-wipe can't leave a recommendation
  // pointing at a request that no longer exists.
  await Recommendation.deleteMany({ staffingRequest: { $ne: null } });
  await StaffingRequest.deleteMany({});

  let createdRequests = 0;
  let createdRecommendations = 0;

  for (const entry of fixture) {
    const request = new StaffingRequest({
      project: entry.project?._id,
      draftProject: entry.draftProject,
      author: author._id,
      requestedPositions: entry.positions.map((row) => ({
        position: row.position._id,
        count: row.count,
        technologies: row.technologies,
      })),
      neededBy: entry.neededBy ?? undefined,
      status: entry.close ? 'closed' : 'open',
    });

    // The note is the admin's, always — attributed and stamped, never written
    // by the leadership author who filed the request.
    if (entry.note) {
      request.note = entry.note.text;
      request.noteBy = admin._id;
      request.noteAt = day(-entry.note.daysAgo);
    }

    if (entry.close) {
      request.reason = entry.close.reason;
      request.closedBy = entry.close.by === 'admin' ? admin._id : author._id;
      request.closedAt = day(-entry.close.daysAgo);
      if (entry.close.closeNote) request.closeNote = entry.close.closeNote;
    }

    await request.save();
    createdRequests += 1;

    // A draft-project request can never carry recommendations:
    // `Recommendation.project` is a required reference.
    if (!entry.project) continue;

    for (const row of entry.positions) {
      for (const suggestion of row.suggestions) {
        const reachedInterviewing = suggestion.placed || suggestion.status === 'interviewing';
        // Nobody is left in selection on a closed request: closing closes out
        // every candidate who was, as `not_placed` with `demandEnded` and the one
        // shared reason (ticket 09 / ADR 0004). Seeding them still mid-pipeline
        // would produce a state the app can no longer reach, and would show the
        // "still open on a closed request" banner for a case that can't happen.
        const closedOut = Boolean(entry.close) && !suggestion.placed;
        const closedAt = entry.close ? day(-entry.close.daysAgo) : undefined;
        await Recommendation.create({
          internProfile: suggestion.intern._id,
          createdBy: admin._id,
          updatedBy: admin._id,
          position: row.position._id,
          project: entry.project._id,
          staffingRequest: request._id,
          technologies: suggestion.technologies,
          status: suggestion.placed || closedOut ? 'resulted' : suggestion.status,
          statusDates: {
            recommended: day(-20),
            interviewing: reachedInterviewing ? day(-12) : undefined,
            resulted: suggestion.placed ? day(-6) : closedOut ? closedAt : undefined,
          },
          result: suggestion.placed
            ? {
                outcome: 'placed',
                note: 'Placed off the back of this request.',
                decidedAt: day(-6),
                decidedBy: admin._id,
                startDate: day(14),
              }
            : closedOut
              ? {
                  outcome: 'not_placed',
                  note: entry.close.notPlacedReason,
                  // Whoever closed the request caused this write — for a
                  // cancellation that is the leadership author, which is correct
                  // and is the platform's one non-admin recommendation write.
                  decidedAt: closedAt,
                  decidedBy: entry.close.by === 'admin' ? admin._id : author._id,
                  demandEnded: true,
                }
              : undefined,
        });
        createdRecommendations += 1;
      }
    }
  }

  console.log(`\ncreated : ${createdRequests} staffing requests`);
  console.log(`        : ${createdRecommendations} tagged recommendations`);
  console.log(`notes by: ${admin.fullname} (admin) — never the leadership author\n`);

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error('\nSeed failed:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
