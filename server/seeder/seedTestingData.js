/**
 * Comprehensive test-data seeder — run AFTER `node seeder/seed.js`.
 *
 * Adds symphony.is users (password: password), interns across all statuses/programmes,
 * recommendations, evaluations, tickets, notifications, and every other collection.
 *
 * Idempotent guard: exits if leadership@symphony.is already exists (re-run seed.js first).
 */
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const connectDB = require('../config/db');
const bcrypt = require('bcryptjs');
const { ROLES } = require('../constants/roles');
const { seedDefaultStatuses } = require('../services/statusService');
const { encrypt } = require('../helpers/crypto');

const User = require('../models/User');
const Workspace = require('../models/Workspace');
const Ticket = require('../models/Ticket');
const TicketStatus = require('../models/TicketStatus');
const Hub = require('../models/Hub');
const InternshipType = require('../models/InternshipType');
const Technology = require('../models/Technology');
const Position = require('../models/Position');
const Project = require('../models/Project');
const { slugify } = require('../helpers/slugify');
const InternProfile = require('../models/InternProfile');
const ReadinessFlag = require('../models/ReadinessFlag');
const Evaluation = require('../models/Evaluation');
const MentorComment = require('../models/MentorComment');
const Recommendation = require('../models/Recommendation');
const Invitation = require('../models/Invitation');
const Notification = require('../models/Notification');
const Comment = require('../models/Comment');
const History = require('../models/History');
const Category = require('../models/Category');
const Integration = require('../models/Integration');
const AISummary = require('../models/AISummary');
const RefreshToken = require('../models/RefreshToken');

const TEST_MARKER_EMAIL = 'leadership@symphony.is';
const PASSWORD = 'password';

const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};

const daysFromNow = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
};

const monthsAgo = (n) => {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d;
};

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const seedTestingData = async () => {
  try {
    await connectDB();
    console.log('🟢 Test seed: connected to database.');

    const alreadySeeded = await User.findOne({ email: TEST_MARKER_EMAIL });
    if (alreadySeeded) {
      console.log(
        '⚠️  Test data already present (leadership@symphony.is exists). Run `node seeder/seed.js` to reset, then run this script again.'
      );
      process.exit(0);
    }

    const baseAdmin = await User.findOne({ email: 'admin@test.com' });
    const baseMentor = await User.findOne({ email: 'mentor@test.com' });
    const demoWorkspace = await Workspace.findOne({ name: 'Support Inbox Demo' });

    if (!baseAdmin || !baseMentor || !demoWorkspace) {
      throw new Error('Base seed missing. Run `node seeder/seed.js` first.');
    }

    const hubs = await Hub.find().sort({ name: 1 });
    const programmes = await InternshipType.find({ isActive: true }).sort({ slug: 1 });
    const technologies = await Technology.find().sort({ name: 1 });
    const positions = await Position.find().sort({ name: 1 });

    const hubByName = (name) => {
      const hub = hubs.find((h) => h.name === name);
      if (!hub) throw new Error(`Hub not found: ${name}`);
      return hub;
    };

    const programmeBySlug = (slug) => {
      const type = programmes.find((p) => p.slug === slug);
      if (!type) throw new Error(`Programme not found: ${slug}`);
      return type;
    };

    const techBySlug = (slug) => {
      const tech = technologies.find((t) => t.slug === slug);
      if (!tech) throw new Error(`Technology not found: ${slug}`);
      return tech;
    };

    const randomPosition = () => positions[Math.floor(Math.random() * positions.length)];

    const projectByTitle = async (name) => {
      const slug = slugify(name);
      let project = await Project.findOne({ slug });
      if (!project) {
        project = await Project.create({ name, slug, status: 'active', type: 'client' });
      }
      return project;
    };

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(PASSWORD, salt);

    const createActiveUser = async ({
      email,
      fullname,
      role,
      hubId,
      workspaceId = null,
      extra = {},
    }) =>
      User.create({
        fullname,
        email,
        password: passwordHash,
        role,
        hub: hubId,
        workspaceId: workspaceId || undefined,
        active: true,
        status: 'active',
        passwordSetAt: new Date(),
        ...extra,
      });

    console.log('👤 Creating symphony.is staff users…');

    const leadership = await createActiveUser({
      email: 'leadership@symphony.is',
      fullname: 'Leadership Lara',
      role: ROLES.LEADERSHIP,
      hubId: hubByName('Sarajevo')._id,
    });

    const leadership2 = await createActiveUser({
      email: 'leadership2@symphony.is',
      fullname: 'Leadership Leo',
      role: ROLES.LEADERSHIP,
      hubId: hubByName('Belgrade')._id,
    });

    const adminSymphony = await createActiveUser({
      email: 'admin@symphony.is',
      fullname: 'Admin Ana',
      role: ROLES.ADMIN,
      hubId: hubByName('Sarajevo')._id,
      workspaceId: demoWorkspace._id,
    });

    const mentorSarajevo = await createActiveUser({
      email: 'mentor.sarajevo@symphony.is',
      fullname: 'Mentor Mira',
      role: ROLES.MENTOR,
      hubId: hubByName('Sarajevo')._id,
      workspaceId: demoWorkspace._id,
    });

    const mentorBelgrade = await createActiveUser({
      email: 'mentor.belgrade@symphony.is',
      fullname: 'Mentor Boris',
      role: ROLES.MENTOR,
      hubId: hubByName('Belgrade')._id,
      workspaceId: demoWorkspace._id,
    });

    const mentorNoviSad = await createActiveUser({
      email: 'mentor.novisad@symphony.is',
      fullname: 'Mentor Neda',
      role: ROLES.MENTOR,
      hubId: hubByName('Novi Sad')._id,
      workspaceId: demoWorkspace._id,
    });

    const mentors = [baseMentor, mentorSarajevo, mentorBelgrade, mentorNoviSad];

    const invitedMentor = await User.create({
      fullname: 'Invited Mentor',
      email: 'invited.mentor@symphony.is',
      role: ROLES.MENTOR,
      hub: hubByName('Niš')._id,
      active: false,
      status: 'invited',
      invitedBy: adminSymphony._id,
      invitedAt: daysAgo(2),
      inviteTokenHash: hashToken('test-invite-token-mentor'),
      inviteTokenExpires: daysFromNow(7),
    });

    const disabledIntern = await User.create({
      fullname: 'Disabled Intern',
      email: 'disabled.intern@symphony.is',
      role: ROLES.INTERN,
      hub: hubByName('Skopje')._id,
      active: false,
      status: 'disabled',
      password: passwordHash,
      passwordSetAt: daysAgo(90),
    });

    const waitingIntern = await User.create({
      fullname: 'Waiting Room Intern',
      email: 'waiting@symphony.is',
      role: ROLES.INTERN,
      hub: hubByName('Medellín')._id,
      active: true,
      status: 'active',
      password: passwordHash,
      passwordSetAt: new Date(),
    });

    await Workspace.findByIdAndUpdate(demoWorkspace._id, {
      $push: {
        members: {
          $each: [
            {
              user: adminSymphony._id,
              role: 'admin',
              status: 'active',
              invitedBy: baseAdmin._id,
            },
            {
              user: mentorSarajevo._id,
              role: 'member',
              status: 'active',
              invitedBy: baseAdmin._id,
            },
            {
              user: mentorBelgrade._id,
              role: 'member',
              status: 'active',
              invitedBy: baseAdmin._id,
            },
            {
              user: mentorNoviSad._id,
              role: 'member',
              status: 'active',
              invitedBy: baseAdmin._id,
            },
          ],
        },
      },
    });

    console.log('🏢 Creating second workspace…');

    const qaWorkspace = await Workspace.create({
      name: 'Symphony FEP QA',
      description: 'Second workspace for integration and invitation testing',
      owner: adminSymphony._id,
      members: [
        {
          user: adminSymphony._id,
          role: 'admin',
          status: 'active',
          invitedBy: adminSymphony._id,
        },
        {
          user: leadership._id,
          role: 'member',
          status: 'active',
          invitedBy: adminSymphony._id,
        },
      ],
    });

    await User.findByIdAndUpdate(leadership._id, { workspaceId: qaWorkspace._id });
    await User.findByIdAndUpdate(leadership2._id, { workspaceId: qaWorkspace._id });

    const qaStatuses = await seedDefaultStatuses(qaWorkspace._id);
    const demoStatuses = await TicketStatus.find({ workspace: demoWorkspace._id });

    const statusBySlug = (statuses, slug) => {
      const match = statuses.find((s) => s.slug === slug);
      if (!match) throw new Error(`Status slug not found: ${slug}`);
      return match;
    };

    console.log('🎫 Seeding categories, tickets, comments, history, notifications…');

    const billingCategory = await Category.create({
      name: 'Billing',
      color: '#f59e0b',
      descriptionTemplate: 'Customer billing inquiry: {{subject}}',
      workspace: demoWorkspace._id,
    });

    const bugCategory = await Category.create({
      name: 'Bug Report',
      color: '#ef4444',
      descriptionTemplate: 'Reproduction steps for {{subject}}',
      workspace: demoWorkspace._id,
    });

    const qaBugCategory = await Category.create({
      name: 'QA Defect',
      color: '#8b5cf6',
      workspace: qaWorkspace._id,
    });

    const lastDemoTicket = await Ticket.findOne({ workspace: demoWorkspace._id })
      .sort('-taskNumber')
      .select('taskNumber');
    let taskCounter = (lastDemoTicket?.taskNumber || 0) + 1;

    const createTicket = async (payload) => {
      const ticket = await Ticket.create({ ...payload, taskNumber: taskCounter });
      taskCounter += 1;
      return ticket;
    };

    const inProgressStatus = statusBySlug(demoStatuses, 'in progress');
    const blockedStatus = statusBySlug(demoStatuses, 'blocked');
    const doneStatus = statusBySlug(demoStatuses, 'done');

    const ticketHigh = await createTicket({
      subject: 'Payment gateway timeout',
      description: 'Checkout fails after 30 seconds on production.',
      status: inProgressStatus._id,
      priority: 'high',
      storyPoints: 3,
      workspace: demoWorkspace._id,
      category: bugCategory._id,
      creator: baseAdmin._id,
      assignedTo: [mentorSarajevo._id, mentorBelgrade._id],
      inProgressAt: daysAgo(1),
      dueDate: daysFromNow(2),
      messages: [
        { senderType: 'user', text: 'Customers cannot complete checkout.' },
        {
          senderType: 'admin',
          sender: mentorSarajevo._id,
          text: 'Reproduced in staging — investigating API latency.',
        },
      ],
      ai: {
        summary: 'Checkout timeout on payment step.',
        category: 'bug',
        suggestedReply: 'We are investigating elevated latency on the payment service.',
        confidenceScore: 0.91,
      },
    });

    const ticketCritical = await createTicket({
      subject: 'Data export returns empty CSV',
      status: blockedStatus._id,
      priority: 'critical',
      storyPoints: 5,
      workspace: demoWorkspace._id,
      category: billingCategory._id,
      creator: adminSymphony._id,
      assignedTo: [baseMentor._id],
      dueDate: daysFromNow(1),
      messages: [{ senderType: 'user', text: 'Exported file has headers only.' }],
    });

    const ticketWithPr = await createTicket({
      subject: 'Fix navbar regression',
      status: inProgressStatus._id,
      priority: 'medium',
      workspace: demoWorkspace._id,
      creator: mentorBelgrade._id,
      assignedTo: [mentorNoviSad._id],
      inProgressAt: daysAgo(3),
      linkedPullRequest: {
        prNumber: 142,
        prTitle: 'fix: navbar height on mobile',
        branchName: 'feature/TASK-142-navbar',
        state: 'open',
        isDraft: false,
        author: { login: 'mentor-boris', avatarUrl: 'https://github.com/identicons/boris.png' },
        url: 'https://github.com/symphony-is/demo/pull/142',
        createdAt: daysAgo(2),
        updatedAt: daysAgo(1),
      },
    });

    const ticketArchived = await createTicket({
      subject: 'Legacy invoice format',
      status: doneStatus._id,
      priority: 'low',
      workspace: demoWorkspace._id,
      creator: baseAdmin._id,
      assignedTo: [mentorSarajevo._id],
      isArchived: true,
      doneAt: daysAgo(14),
      totalTimeSpent: 7200,
    });

    const ticketQa = await createTicket({
      subject: 'Intern dashboard smoke test',
      status: statusBySlug(qaStatuses, 'to do')._id,
      priority: 'medium',
      workspace: qaWorkspace._id,
      category: qaBugCategory._id,
      creator: adminSymphony._id,
      assignedTo: [leadership._id],
      dueDate: daysFromNow(5),
    });

    const comment1 = await Comment.create({
      content: 'Added logs from payment service — spike at 14:00 UTC.',
      ticket: ticketHigh._id,
      author: mentorSarajevo._id,
    });

    const comment2 = await Comment.create({
      content: '@Admin please confirm refund policy for duplicate charges.',
      ticket: ticketCritical._id,
      author: baseMentor._id,
      isEdited: true,
    });

    await Comment.create({
      content: 'Removed sensitive customer data from thread.',
      ticket: ticketHigh._id,
      author: adminSymphony._id,
      isDeleted: true,
    });

    await History.insertMany([
      {
        ticketId: ticketHigh._id,
        entityType: 'ticket',
        entityId: ticketHigh._id,
        action: 'Status changed to In progress',
        userId: mentorSarajevo._id,
        userName: mentorSarajevo.fullname,
        timestamp: daysAgo(1),
      },
      {
        ticketId: ticketHigh._id,
        entityType: 'ticket',
        entityId: ticketHigh._id,
        action: 'Priority set to high',
        userId: baseAdmin._id,
        userName: baseAdmin.fullname,
        timestamp: daysAgo(2),
      },
      {
        ticketId: ticketCritical._id,
        entityType: 'ticket',
        entityId: ticketCritical._id,
        action: 'Assigned to Mentor Mark',
        userId: adminSymphony._id,
        userName: adminSymphony.fullname,
        timestamp: daysAgo(0),
      },
      {
        ticketId: ticketWithPr._id,
        entityType: 'ticket',
        entityId: ticketWithPr._id,
        action: 'Linked PR #142',
        userId: mentorBelgrade._id,
        userName: mentorBelgrade.fullname,
        timestamp: daysAgo(2),
      },
    ]);

    await Notification.insertMany([
      {
        recipient: baseAdmin._id,
        read: false,
        type: 'ticket_comment',
        title: 'New comment on Payment gateway timeout',
        body: 'Mentor Mira added a comment.',
        ticket: ticketHigh._id,
        comment: comment1._id,
        workspace: demoWorkspace._id,
      },
      {
        recipient: adminSymphony._id,
        read: true,
        type: 'ticket_assigned',
        title: 'Assigned to Data export returns empty CSV',
        body: 'You were assigned to a critical ticket.',
        ticket: ticketCritical._id,
        workspace: demoWorkspace._id,
      },
      {
        recipient: mentorSarajevo._id,
        read: false,
        type: 'ticket_mention',
        title: 'Mentioned in Payment gateway timeout',
        body: 'Please review the latest logs.',
        ticket: ticketHigh._id,
        comment: comment1._id,
        workspace: demoWorkspace._id,
      },
    ]);

    console.log('🔗 Seeding workspace integrations…');

    await Integration.create({
      workspace: demoWorkspace._id,
      isConnected: false,
    });

    let connectedIntegration = null;
    try {
      connectedIntegration = await Integration.create({
        workspace: qaWorkspace._id,
        isConnected: true,
        githubAppInstallationId: 99001,
        githubAccountLogin: 'symphony-is',
        githubAccountType: 'Organization',
        connectedRepo: {
          owner: 'symphony-is',
          name: 'fep-qa',
          fullName: 'symphony-is/fep-qa',
          defaultBranch: 'main',
        },
        encryptedAccessToken: encrypt('gho_test_seeded_token_for_qa'),
        encryptedRefreshToken: encrypt('gho_test_seeded_refresh_for_qa'),
        tokenExpiresAt: daysFromNow(30),
        settings: {
          autoLinkEnabled: true,
          autoMoveOnPROpenEnabled: true,
          autoMoveOnMergeEnabled: true,
          onPROpenTargetStatusId: statusBySlug(qaStatuses, 'in progress')._id,
          onMergeTargetStatusId: statusBySlug(qaStatuses, 'done')._id,
        },
        lastWebhookReceivedAt: daysAgo(1),
        lastSyncAt: daysAgo(1),
      });
    } catch (integrationError) {
      console.log(
        '⚠️  Skipped connected GitHub integration (set GITHUB_ENCRYPTION_KEY in .env to seed it).'
      );
      await Integration.create({
        workspace: qaWorkspace._id,
        isConnected: false,
      });
    }

    console.log('✉️  Seeding workspace invitations…');

    const invitePendingUser = await createActiveUser({
      email: 'invite.pending@symphony.is',
      fullname: 'Invite Pending',
      role: ROLES.MENTOR,
      hubId: hubByName('Banja Luka')._id,
    });

    const inviteDeclinedUser = await createActiveUser({
      email: 'invite.declined@symphony.is',
      fullname: 'Invite Declined',
      role: ROLES.MENTOR,
      hubId: hubByName('Banja Luka')._id,
    });

    await Invitation.insertMany([
      {
        user: invitePendingUser._id,
        workspace: qaWorkspace._id,
        invitedBy: adminSymphony._id,
        workspaceRole: 'member',
        status: 'pending',
      },
      {
        user: leadership2._id,
        workspace: demoWorkspace._id,
        invitedBy: baseAdmin._id,
        workspaceRole: 'member',
        status: 'accepted',
        respondedAt: daysAgo(5),
      },
      {
        user: inviteDeclinedUser._id,
        workspace: demoWorkspace._id,
        invitedBy: adminSymphony._id,
        workspaceRole: 'admin',
        status: 'declined',
        respondedAt: daysAgo(3),
      },
      {
        user: invitedMentor._id,
        workspace: qaWorkspace._id,
        invitedBy: adminSymphony._id,
        workspaceRole: 'member',
        status: 'cancelled',
        respondedAt: daysAgo(1),
      },
    ]);

    await AISummary.insertMany([
      {
        user: baseAdmin._id,
        workspace: demoWorkspace._id,
        summary: 'Resolved 12 billing tickets this week. SLA compliance at 94%.',
        generatedAt: daysAgo(1),
      },
      {
        user: mentorSarajevo._id,
        workspace: demoWorkspace._id,
        summary: 'Focused on payment gateway incident and mentor evaluations.',
        generatedAt: daysAgo(2),
      },
      {
        user: adminSymphony._id,
        workspace: qaWorkspace._id,
        summary: 'QA workspace onboarding — 3 open defects, 1 blocked.',
        generatedAt: daysAgo(0),
      },
    ]);

    await RefreshToken.create({
      token: hashToken('seeded-refresh-token-admin-symphony'),
      user: adminSymphony._id,
      expiresAt: daysFromNow(7),
    });

    console.log('🎓 Creating intern matrix…');

    const internSpecs = [
      {
        email: 'intern.active.fep@symphony.is',
        fullname: 'Intern Active FEP',
        hub: 'Sarajevo',
        programme: 'fep',
        mentorIdx: 0,
        secondaryIdx: 1,
        status: 'active',
        endDays: 45,
        techs: ['react', 'node-js'],
        readiness: { react: 'learning', 'node-js': 'none' },
      },
      {
        email: 'intern.active.shadow@symphony.is',
        fullname: 'Intern Active Shadow',
        hub: 'Belgrade',
        programme: 'shadow',
        mentorIdx: 1,
        status: 'active',
        endDays: 60,
        techs: ['angular'],
        readiness: { angular: 'learning' },
      },
      {
        email: 'intern.active.industrial@symphony.is',
        fullname: 'Intern Active Industrial',
        hub: 'Novi Sad',
        programme: 'industrial',
        mentorIdx: 2,
        status: 'active',
        endDays: 30,
        techs: ['spring-boot', 'kotlin'],
      },
      {
        email: 'intern.active.oneonone@symphony.is',
        fullname: 'Intern Active OneOnOne',
        hub: 'Niš',
        programme: 'one-on-one',
        mentorIdx: 3,
        status: 'active',
        endDays: 20,
        techs: ['django'],
      },
      {
        email: 'intern.active.core@symphony.is',
        fullname: 'Intern Active Core',
        hub: 'Skopje',
        programme: 'core-tool',
        mentorIdx: 0,
        secondaryIdx: 2,
        status: 'active',
        endDays: 15,
        techs: ['docker', 'go'],
      },
      {
        email: 'intern.ready.unpitched@symphony.is',
        fullname: 'Intern Ready Unpitched',
        hub: 'Sarajevo',
        programme: 'fep',
        mentorIdx: 0,
        status: 'ready',
        endDays: 10,
        techs: ['react', 'next-js'],
        readiness: { react: 'ready', 'next-js': 'ready' },
        rec: null,
      },
      {
        email: 'intern.ready.draft@symphony.is',
        fullname: 'Intern Ready Draft Rec',
        hub: 'Belgrade',
        programme: 'fep',
        mentorIdx: 1,
        status: 'ready',
        endDays: 25,
        techs: ['vue-js'],
        readiness: { 'vue-js': 'ready' },
        rec: 'recommended',
      },
      {
        email: 'intern.ready.recommended@symphony.is',
        fullname: 'Intern Ready Recommended',
        hub: 'Novi Sad',
        programme: 'fep',
        mentorIdx: 2,
        status: 'ready',
        endDays: 18,
        techs: ['react-native', 'kotlin'],
        readiness: { 'react-native': 'ready', kotlin: 'ready' },
        rec: 'recommended',
        recAgeDays: 3,
      },
      {
        email: 'intern.ready.stalled@symphony.is',
        fullname: 'Intern Ready Stalled',
        hub: 'Sarajevo',
        programme: 'shadow',
        mentorIdx: 0,
        status: 'ready',
        endDays: 12,
        techs: ['flutter'],
        readiness: { flutter: 'ready' },
        rec: 'recommended',
        recAgeDays: 21,
      },
      {
        email: 'intern.ready.interview@symphony.is',
        fullname: 'Intern Ready Interviewing',
        hub: 'Belgrade',
        programme: 'fep',
        mentorIdx: 1,
        status: 'ready',
        endDays: 8,
        techs: ['node-js', 'react'],
        readiness: { 'node-js': 'ready', react: 'learning' },
        rec: 'interviewing',
        interviewInDays: 4,
      },
      {
        email: 'intern.ready.noschedule@symphony.is',
        fullname: 'Intern Ready No Schedule',
        hub: 'Medellín',
        programme: 'industrial',
        mentorIdx: 2,
        status: 'ready',
        endDays: 5,
        techs: ['sql'],
        readiness: { 'sql': 'ready' },
        rec: 'interviewing',
        interviewInDays: null,
      },
      {
        email: 'intern.ready.urgent@symphony.is',
        fullname: 'Intern Ready Urgent End',
        hub: 'Banja Luka',
        programme: 'fep',
        mentorIdx: 3,
        status: 'ready',
        endDays: 2,
        techs: ['fastapi', 'pandas'],
        readiness: { fastapi: 'ready', 'pandas': 'learning' },
        rec: 'recommended',
        recAgeDays: 5,
      },
      {
        email: 'intern.ready.multi@symphony.is',
        fullname: 'Intern Ready Multi Tech',
        hub: 'Sarajevo',
        programme: 'fep',
        mentorIdx: 0,
        secondaryIdx: 1,
        status: 'ready',
        endDays: 14,
        techs: ['react', 'node-js', 'docker'],
        readiness: { react: 'ready', 'node-js': 'ready', docker: 'learning' },
        rec: 'interviewing',
        interviewInDays: 2,
      },
      {
        email: 'intern.placed.alpha@symphony.is',
        fullname: 'Intern Placed Alpha',
        hub: 'Belgrade',
        programme: 'fep',
        mentorIdx: 1,
        status: 'placed',
        endDays: -30,
        techs: ['dotnet'],
        rec: 'placed',
      },
      {
        email: 'intern.placed.beta@symphony.is',
        fullname: 'Intern Placed Beta',
        hub: 'Novi Sad',
        programme: 'shadow',
        mentorIdx: 2,
        status: 'placed',
        endDays: -10,
        techs: ['ruby-on-rails'],
        rec: 'placed',
      },
      {
        email: 'intern.completed.gamma@symphony.is',
        fullname: 'Intern Completed Gamma',
        hub: 'Sarajevo',
        programme: 'fep',
        mentorIdx: 0,
        status: 'completed',
        endDays: -60,
        techs: ['react'],
        rec: 'not_placed',
      },
      {
        email: 'intern.completed.delta@symphony.is',
        fullname: 'Intern Completed Delta',
        hub: 'Skopje',
        programme: 'one-on-one',
        mentorIdx: 3,
        status: 'completed',
        endDays: -45,
        techs: ['manual-qa', 'test-automation'],
        rec: 'not_placed',
      },
      {
        email: 'intern.discontinued@symphony.is',
        fullname: 'Intern Discontinued',
        hub: 'Niš',
        programme: 'industrial',
        mentorIdx: 2,
        status: 'discontinued',
        endDays: 40,
        techs: ['cpp'],
      },
      {
        email: 'intern.discontinued2@symphony.is',
        fullname: 'Intern Discontinued Two',
        hub: 'Medellín',
        programme: 'core-tool',
        mentorIdx: 1,
        status: 'discontinued',
        endDays: 35,
        techs: ['rust'],
      },
    ];

    const internProfiles = [];

    for (const spec of internSpecs) {
      const primaryMentor = mentors[spec.mentorIdx];
      const secondaryMentor = spec.secondaryIdx != null ? mentors[spec.secondaryIdx] : undefined;
      const selfTechIds = (spec.techs || []).map((slug) => techBySlug(slug)._id);

      const user = await User.create({
        fullname: spec.fullname,
        email: spec.email,
        password: passwordHash,
        role: ROLES.INTERN,
        hub: hubByName(spec.hub)._id,
        active: true,
        status: 'active',
        passwordSetAt: monthsAgo(2),
      });

      const profile = await InternProfile.create({
        user: user._id,
        internshipType: programmeBySlug(spec.programme)._id,
        primaryMentor: primaryMentor._id,
        secondaryMentor: secondaryMentor?._id,
        startDate: monthsAgo(4),
        status: spec.status,
        expectedEndDate: spec.endDays != null ? daysFromNow(spec.endDays) : undefined,
        selfTechnologies: selfTechIds,
        declaredPosition: positions.length > 0 ? randomPosition()._id : null,
      });

      internProfiles.push({ user, profile, spec, primaryMentor, secondaryMentor });

      if (spec.readiness) {
        for (const [slug, level] of Object.entries(spec.readiness)) {
          await ReadinessFlag.create({
            internProfile: profile._id,
            technology: techBySlug(slug)._id,
            level,
            setBy: primaryMentor._id,
          });
        }
      }

      await Evaluation.create({
        internProfile: profile._id,
        evaluator: primaryMentor._id,
        periodStart: monthsAgo(3),
        periodEnd: monthsAgo(2),
        scores: { technical: 3, communication: 4, ownership: 3, growth: 4 },
        notes: 'Mid-programme evaluation — steady progress.',
      });

      await Evaluation.create({
        internProfile: profile._id,
        evaluator: secondaryMentor?._id || primaryMentor._id,
        periodStart: monthsAgo(2),
        periodEnd: monthsAgo(1),
        scores: { technical: 4, communication: 4, ownership: 4, growth: 5 },
        notes: 'Recent evaluation — strong improvement on deliverables.',
      });

      const visibleTo = [leadership._id, leadership2._id];
      if (secondaryMentor) visibleTo.push(secondaryMentor._id);

      await MentorComment.create({
        internProfile: profile._id,
        author: primaryMentor._id,
        content: `Mentor note for ${spec.fullname}: consistent attendance and good collaboration.`,
        visibleTo,
      });

      await MentorComment.create({
        internProfile: profile._id,
        author: leadership._id,
        content: `Leadership visibility comment for ${spec.fullname} — pipeline review.`,
        visibleTo: [leadership._id, primaryMentor._id],
      });
    }

    console.log('📋 Seeding recommendations…');

    // Append-only status history rows for a seeded recommendation. `events` is
    // an ordered list of { statusKey, at } so the new table date columns and the
    // per-status labels have realistic data after seeding.
    const logRecommendationHistory = async (rec, author, events) => {
      await History.insertMany(
        events.map((event) => ({
          entityType: 'recommendation',
          entityId: rec._id,
          statusKey: event.statusKey,
          action: `Status set to ${event.statusKey.charAt(0).toUpperCase() + event.statusKey.slice(1)}`,
          userId: author,
          userName: leadership.fullname,
          timestamp: event.at,
        }))
      );
    };

    const createRecommendation = async (profileEntry, recSpec) => {
      const { profile, spec } = profileEntry;
      const techIds = (spec.techs || []).map((slug) => techBySlug(slug)._id);
      const leadershipAuthor = leadership._id;

      if (!recSpec) return null;

      const project = await projectByTitle(`${spec.fullname.split(' ')[0]} placement track`);

      const base = {
        internProfile: profile._id,
        createdBy: leadershipAuthor,
        updatedBy: leadershipAuthor,
        position: profile.declaredPosition || randomPosition()._id,
        project: project._id,
        technologies: techIds,
        recommendationNote: `Recommendation for ${spec.fullname} — ${recSpec} track.`,
      };

      if (recSpec === 'recommended') {
        const age = spec.recAgeDays ?? 7;
        const rec = await Recommendation.create({ ...base, status: 'recommended' });
        await Recommendation.updateOne(
          { _id: rec._id },
          { $set: { createdAt: daysAgo(age), updatedAt: daysAgo(age) } }
        );
        await logRecommendationHistory(rec, leadershipAuthor, [
          { statusKey: 'recommended', at: daysAgo(age) },
        ]);
        return rec;
      }

      if (recSpec === 'interviewing') {
        const interview = {
          company: 'Acme Corp',
          role: 'Junior Engineer',
          stage: 'Technical',
          scheduledAt: spec.interviewInDays != null ? daysFromNow(spec.interviewInDays) : undefined,
          interviewers: ['Jane Hiring', 'John Tech'],
          locationNote: spec.interviewInDays != null ? 'Remote — Google Meet' : 'Schedule TBD',
          feedback: {
            summary: 'Initial screen positive.',
            strengths: 'Clear communication',
            concerns: 'Limited system design exposure',
            rating: 4,
          },
        };
        const rec = await Recommendation.create({
          ...base,
          status: 'interviewing',
          interviews: [interview],
        });
        // Progressed: recommended first, then interviewing.
        await logRecommendationHistory(rec, leadershipAuthor, [
          { statusKey: 'recommended', at: daysAgo(14) },
          { statusKey: 'interviewing', at: daysAgo(5) },
        ]);
        return rec;
      }

      if (recSpec === 'placed' || recSpec === 'not_placed') {
        const rec = await Recommendation.create({
          ...base,
          status: 'resulted',
          interviews: [
            {
              company: 'Partner Ltd',
              role: 'Engineer',
              stage: 'Final',
              scheduledAt: daysAgo(20),
              interviewers: ['HR Lead'],
              feedback: { summary: 'Completed full loop.', rating: 4 },
            },
          ],
          result: {
            outcome: recSpec === 'placed' ? 'placed' : 'not_placed',
            note:
              recSpec === 'placed'
                ? 'Offer accepted — starts next month.'
                : 'Strong candidate; no open headcount this quarter.',
            decidedAt: daysAgo(7),
            decidedBy: leadershipAuthor,
          },
        });
        // Full status lifecycle; both placed and not_placed reach 'resulted'
        // (the placed/not_placed distinction lives in the Result field).
        await logRecommendationHistory(rec, leadershipAuthor, [
          { statusKey: 'recommended', at: daysAgo(30) },
          { statusKey: 'interviewing', at: daysAgo(20) },
          { statusKey: 'resulted', at: daysAgo(7) },
        ]);
        return rec;
      }

      return null;
    };

    for (const entry of internProfiles) {
      if (entry.spec.rec != null) {
        await createRecommendation(entry, entry.spec.rec);
      }
    }

    // Extra historical resulted recommendations for dashboard "recent outcomes"
    const recentOutcomeIntern = internProfiles.find(
      (e) => e.spec.email === 'intern.completed.gamma@symphony.is'
    );
    if (recentOutcomeIntern) {
      const earlierAttemptProject = await projectByTitle('Client pipeline — earlier attempt');
      const rec = await Recommendation.create({
        internProfile: recentOutcomeIntern.profile._id,
        createdBy: leadership2._id,
        updatedBy: leadership2._id,
        position: recentOutcomeIntern.profile.declaredPosition || randomPosition()._id,
        project: earlierAttemptProject._id,
        technologies: [techBySlug('react')._id],
        status: 'resulted',
        recommendationNote: 'Earlier pipeline attempt.',
        result: {
          outcome: 'not_placed',
          note: 'Client chose another candidate.',
          decidedAt: daysAgo(2),
          decidedBy: leadership2._id,
        },
      });
      // not_placed → no 'placed' event, only recommended + interviewing.
      await History.insertMany([
        {
          entityType: 'recommendation',
          entityId: rec._id,
          statusKey: 'recommended',
          action: 'Status set to Recommended',
          userId: leadership2._id,
          userName: leadership2.fullname,
          timestamp: daysAgo(18),
        },
        {
          entityType: 'recommendation',
          entityId: rec._id,
          statusKey: 'interviewing',
          action: 'Status set to Interviewing',
          userId: leadership2._id,
          userName: leadership2.fullname,
          timestamp: daysAgo(9),
        },
      ]);
    }

    const placedIntern = internProfiles.find(
      (e) => e.spec.email === 'intern.placed.alpha@symphony.is'
    );
    if (placedIntern) {
      const dotnetPlacementProject = await projectByTitle('Enterprise Co. — .NET placement');
      const rec = await Recommendation.create({
        internProfile: placedIntern.profile._id,
        createdBy: leadership._id,
        updatedBy: leadership._id,
        position: placedIntern.profile.declaredPosition || randomPosition()._id,
        project: dotnetPlacementProject._id,
        technologies: [techBySlug('dotnet')._id],
        status: 'resulted',
        recommendationNote: 'Successful placement at Enterprise Co.',
        result: {
          outcome: 'placed',
          note: 'Joined Enterprise Co. as .NET developer.',
          decidedAt: daysAgo(1),
          decidedBy: leadership._id,
        },
      });
      await History.insertMany([
        {
          entityType: 'recommendation',
          entityId: rec._id,
          statusKey: 'recommended',
          action: 'Status set to Recommended',
          userId: leadership._id,
          userName: leadership.fullname,
          timestamp: daysAgo(25),
        },
        {
          entityType: 'recommendation',
          entityId: rec._id,
          statusKey: 'interviewing',
          action: 'Status set to Interviewing',
          userId: leadership._id,
          userName: leadership.fullname,
          timestamp: daysAgo(12),
        },
        {
          entityType: 'recommendation',
          entityId: rec._id,
          statusKey: 'resulted',
          action: 'Status set to Resulted',
          userId: leadership._id,
          userName: leadership.fullname,
          timestamp: daysAgo(1),
        },
      ]);
    }

    console.log('\n🚀 TEST SEEDING COMPLETED SUCCESSFULLY!');
    console.log('========================================');
    console.log('All new @symphony.is accounts use password: password');
    console.log('');
    console.log('Leadership:  leadership@symphony.is, leadership2@symphony.is');
    console.log('Admin:       admin@symphony.is');
    console.log(
      'Mentors:     mentor.sarajevo@symphony.is, mentor.belgrade@symphony.is, mentor.novisad@symphony.is'
    );
    console.log('Interns:     intern.*@symphony.is (19 profiles — all statuses & pipeline combos)');
    console.log(
      'Edge cases:  invited.mentor@symphony.is, disabled.intern@symphony.is, waiting@symphony.is'
    );
    console.log('Invites:     invite.pending@symphony.is, invite.declined@symphony.is');
    console.log('');
    console.log(
      'Base seed still available: admin@test.com / admin123, mentor@test.com / mentor123'
    );
    console.log('Workspaces:  Support Inbox Demo + Symphony FEP QA');
    if (connectedIntegration) {
      console.log('Integration: symphony-is/fep-qa connected on QA workspace');
    }
    console.log('========================================');

    process.exit(0);
  } catch (error) {
    console.error('❌ Test seeding error:', error);
    process.exit(1);
  }
};

seedTestingData();
