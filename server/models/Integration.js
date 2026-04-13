const mongoose = require("mongoose");

const integrationSchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: [true, "Workspace is required"],
      unique: true,
      index: true,
    },

    githubAppInstallationId: {
      type: Number,
      required: function () {
        return this.isConnected;
      },
      index: true,
    },

    githubAccountLogin: {
      type: String,
      required: function () {
        return this.isConnected;
      },
    },

    githubAccountType: {
      type: String,
      enum: ["User", "Organization"],
      required: function () {
        return this.isConnected;
      },
    },

    connectedRepo: {
      owner: {
        type: String,
        required: function () {
          return this.isConnected && this.connectedRepo;
        },
      },
      name: {
        type: String,
        required: function () {
          return this.isConnected && this.connectedRepo;
        },
      },
      fullName: {
        type: String,
        required: function () {
          return this.isConnected && this.connectedRepo;
        },
      },
      defaultBranch: {
        type: String,
        default: "main",
      },
    },

    encryptedAccessToken: {
      type: String,
      required: function () {
        return this.isConnected;
      },
    },

    encryptedRefreshToken: {
      type: String,
    },

    tokenExpiresAt: {
      type: Date,
    },

    settings: {
      autoLinkEnabled: {
        type: Boolean,
        default: true,
      },
      autoMoveOnPROpenEnabled: {
        type: Boolean,
        default: false,
      },
      autoMoveOnMergeEnabled: {
        type: Boolean,
        default: false,
      },
      onPROpenTargetStatus: {
        type: String,
        enum: ["backlog", "to do", "in progress", "on staging", "blocked", "done"],
        default: "on staging",
      },
      onMergeTargetStatus: {
        type: String,
        enum: ["backlog", "to do", "in progress", "on staging", "blocked", "done"],
        default: "done",
      },
    },

    isConnected: {
      type: Boolean,
      default: false,
    },

    lastWebhookReceivedAt: {
      type: Date,
    },

    lastSyncAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

integrationSchema.index({ isConnected: 1, updatedAt: -1 });

module.exports = mongoose.model("Integration", integrationSchema);
