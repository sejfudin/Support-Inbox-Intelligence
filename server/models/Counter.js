const mongoose = require("mongoose");

const counterSchema = new mongoose.Schema({
  workspace: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Workspace", 
    required: true 
  },
  seq: { type: Number, default: 0 }
});

counterSchema.index({ workspace: 1 }, { unique: true });

module.exports = mongoose.model("Counter", counterSchema);