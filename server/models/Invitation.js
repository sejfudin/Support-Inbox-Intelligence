const mongoose = require("mongoose");

const invitationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    workspaceRole: {
      type: String,
      enum: ["admin", "member"],
      default: "member",
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined", "cancelled"],
      default: "pending",
    },
    respondedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

invitationSchema.index({ user: 1, workspace: 1, status: 1 });

module.exports = mongoose.model("Invitation", invitationSchema);
