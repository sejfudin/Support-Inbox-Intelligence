const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    fullname: {
      type: String,
      required: [true, "Please enter your full name"],
      maxlength: [50, "Name cannot be longer than 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Please enter your email"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,})+$/,
        "Please enter a valid email address",
      ],
    },
    password: {
      type: String,
      minlength: [6, "Password must have at least 6 characters."],
      select: false,
      required: function () {
        // this requires password only when the user is active
        return this.active === true;
      },
    },
    role: {
      type: String,
      enum: {
        values: ["user", "admin"],
        message: "{VALUE} is not a supported role",
      },
      default: "user",
    },
    active: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["active", "invited", "disabled"],
      default: "invited",
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
    inviteTokenHash: {
      type: String,
      index: true,
    },
    inviteTokenExpires: {
      type: Date,
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    invitedAt: {
      type: Date,
    },
    inviteAcceptedAt: {
      type: Date,
    },
    inviteSetupSessionHash: {
      type: String,
      index: true,
    },
    inviteSetupSessionExpires: {
      type: Date,
    },
    passwordSetAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

userSchema.index({ active: 1, updatedAt: -1 });
module.exports = mongoose.model("User", userSchema);
