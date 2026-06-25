const path = require('path');
const readline = require('readline');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const connectDB = require('../config/db');
const bcrypt = require('bcryptjs');

const confirm = () =>
  new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log('\n⚠️  WARNING: This will permanently delete ALL data in the database.');
    console.log(`    Connected to: ${process.env.MONGODB_URI}\n`);
    rl.question('    Type "wipe" to confirm, or anything else to cancel: ', (answer) => {
      rl.close();
      resolve(answer.trim() === 'wipe');
    });
  });

const User = require('../models/User');
const Workspace = require('../models/Workspace');
const Ticket = require('../models/Ticket');
const TicketStatus = require('../models/TicketStatus');
const Hub = require('../models/Hub');
const InternshipType = require('../models/InternshipType');
const Technology = require('../models/Technology');
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
const { seedReferenceData } = require('./referenceData');
const { seedDefaultStatuses } = require('../services/statusService');

const seedData = async () => {
  try {
    const confirmed = await confirm();
    if (!confirmed) {
      console.log('\n❌ Cancelled. No data was changed.');
      process.exit(0);
    }

    await connectDB();
    console.log('🟢 Seed process: Connected to database.');

    await Comment.deleteMany();
    await Notification.deleteMany();
    await History.deleteMany();
    await Ticket.deleteMany();
    await TicketStatus.deleteMany();
    await Recommendation.deleteMany();
    await ReadinessFlag.deleteMany();
    await Evaluation.deleteMany();
    await MentorComment.deleteMany();
    await InternProfile.deleteMany();
    await Invitation.deleteMany();
    await Integration.deleteMany();
    await AISummary.deleteMany();
    await RefreshToken.deleteMany();
    await Category.deleteMany();
    await Workspace.deleteMany();
    await User.deleteMany();
    await Technology.deleteMany();
    await InternshipType.deleteMany();
    await Hub.deleteMany();

    await seedReferenceData();
    console.log('✅ Reference data seeded (hubs, internship types, technologies).');

    const sarajevoHub = await Hub.findOne({ name: 'Sarajevo' });
    const salt = await bcrypt.genSalt(10);
    const adminPassword = await bcrypt.hash('admin123', salt);
    const mentorPassword = await bcrypt.hash('mentor123', salt);

    const admin = await User.create({
      fullname: 'Primary Admin',
      email: 'admin@test.com',
      password: adminPassword,
      role: 'admin',
      hub: sarajevoHub._id,
      active: true,
      status: 'active',
    });

    const mentor = await User.create({
      fullname: 'Mentor Mark',
      email: 'mentor@test.com',
      password: mentorPassword,
      role: 'mentor',
      hub: sarajevoHub._id,
      active: true,
      status: 'active',
    });

    console.log('✅ Users (Admin and Mentor) created.');

    const workspace = await Workspace.create({
      name: 'Support Inbox Demo',
      description: 'Seeded workspace for local development',
      owner: admin._id,
      members: [
        {
          user: admin._id,
          role: 'admin',
          status: 'active',
          invitedBy: admin._id,
        },
        {
          user: mentor._id,
          role: 'member',
          status: 'active',
          invitedBy: admin._id,
        },
      ],
    });

    await User.updateMany(
      { _id: { $in: [admin._id, mentor._id] } },
      { $set: { workspaceId: workspace._id } }
    );

    console.log('✅ Workspace created.');

    const workspaceStatuses = await seedDefaultStatuses(workspace._id);
    const inProgressStatus = workspaceStatuses.find((s) => s.tracksTime);
    const inProgressStatusId = inProgressStatus?._id || workspaceStatuses[0]?._id;

    console.log('✅ Ticket statuses seeded.');

    const ticket = await Ticket.create({
      subject: 'Subscription billing issue',
      status: inProgressStatusId,
      inProgressAt: new Date(),
      workspace: workspace._id,
      messages: [
        {
          senderType: 'user',
          text: 'Hello, I have been charged twice for my subscription this month.',
        },
        {
          senderType: 'admin',
          sender: admin._id,
          text: 'Hello, we are checking the transactions. Please wait a few minutes.',
        },
      ],
      ai: {
        summary: 'User reporting a double subscription charge.',
        category: 'billing',
        suggestedReply:
          'We apologize for the inconvenience. We have identified an error with the processor and a refund will be issued within 3-5 business days.',
        confidenceScore: 0.98,
      },
      creator: admin._id,
      assignedTo: [mentor._id],
    });

    console.log('✅ Ticket with messages created.');

    console.log('\n🚀 SEEDING COMPLETED SUCCESSFULLY!');
    console.log('----------------------------------');
    console.log('Admin: admin@test.com / admin123');
    console.log('Mentor: mentor@test.com / mentor123');
    console.log('----------------------------------');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  }
};

seedData();
