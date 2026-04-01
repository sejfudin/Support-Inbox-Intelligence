const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const bcrypt = require("bcryptjs");

const User = require("../models/User");
const Workspace = require("../models/Workspace");
const Ticket = require("../models/Ticket");
// const AILog = require("../models/AILog");

const seedData = async () => {
  try {
    await connectDB();
    console.log("🟢 Seed process: Connected to database.");

    await Ticket.deleteMany();
    await Workspace.deleteMany();
    await User.deleteMany();

    const salt = await bcrypt.genSalt(10);
    const adminPassword = await bcrypt.hash("admin123", salt);
    const agentPassword = await bcrypt.hash("agent123", salt);

    const admin = await User.create({
      fullname: "Primary Admin",
      username: "admin_user",
      email: "admin@test.com",
      password: adminPassword,
      role: "admin",
      active: true,
      status: "active",
    });

    const agent = await User.create({
      fullname: "Agent Mark",
      username: "agent_mark",
      email: "mark@test.com",
      password: agentPassword,
      role: "user",
      active: true,
      status: "active",
    });

    console.log("✅ Users (Admin and Agent) created.");

    const workspace = await Workspace.create({
      name: "Support Inbox Demo",
      description: "Seeded workspace for local development",
      owner: admin._id,
      members: [
        {
          user: admin._id,
          role: "admin",
          status: "active",
          invitedBy: admin._id,
        },
        {
          user: agent._id,
          role: "member",
          status: "active",
          invitedBy: admin._id,
        },
      ],
    });

    await User.updateMany(
      { _id: { $in: [admin._id, agent._id] } },
      { $set: { workspaceId: workspace._id } },
    );

    console.log("✅ Workspace created.");

    const ticket = await Ticket.create({
      subject: "Subscription billing issue",
      status: "in progress",
      workspace: workspace._id,
      messages: [
        {
          senderType: "user",
          text: "Hello, I have been charged twice for my subscription this month.",
        },
        {
          senderType: "user",
          sender: agent._id,
          text: "Hello Lena, we are checking the transactions. Please wait a few minutes.",
        },
      ],
      ai: {
        summary: "User reporting a double subscription charge.",
        category: "billing",
        suggestedReply:
          "We apologize for the inconvenience. We have identified an error with the processor and a refund will be issued within 3-5 business days.",
        confidenceScore: 0.98,
      },
      creator: admin._id, 
      assignedTo: [agent._id],
    });

    console.log("✅ Ticket with messages created.");

    // await AILog.create({
    //   ticketId: ticket._id,
    //   userId: agent._id,
    //   status: "success",
    //   latencyMs: 1250,
    //   errorMessage: "",
    // });

    console.log("✅ AI Log created.");

    console.log("\n🚀 SEEDING COMPLETED SUCCESSFULLY!");
    console.log("----------------------------------");
    console.log("Admin: admin@test.com / admin123");
    console.log("Agent: mark@test.com / agent123");
    console.log("----------------------------------");

    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding error:", error);
    process.exit(1);
  }
};

seedData();