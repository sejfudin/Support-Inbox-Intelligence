const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
senderType: {
    type: String,
    enum: ["admin", "user"],
    required: true
  },
sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
text: {
    type: String,
    required: [true, "Message text is required"]
  },
},
{
  timestamps: true
});

const aiAssistantSchema = new mongoose.Schema({
  summary: { type: String, default: "" },
  category: { 
    type: String, 
    enum: ["billing", "bug", "feature", "other", ""],
    default: ""
  },
  suggestedReply: { type: String, default: "" },
  confidenceScore: { 
    type: Number, 
    min: 0, 
    max: 1, 
    default: 0 
  }
}, { 
  timestamps: true, 
  _id: false
});

const ticketSchema = new mongoose.Schema({
    subject: {
    type: String,
    required: [true, "Please provide a ticket subject"],
    trim: true,
    maxlength: [100, "Title cannot be more than 100 characters"]
  },
  description: {
    type: String,
  },
  status: {
    type: String,
    enum: {
      values: ["open", "pending", "closed"],
      message: "{VALUE} is not a supported status"
    },
    default: "open"
  },
 customer: {
    name: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true }
  },
  messages: [messageSchema],
  ai: aiAssistantSchema,
creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  assignedTo: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }]
},{ 
  timestamps: true, 
});
ticketSchema.index({ status: 1, updatedAt: -1 });
ticketSchema.index({ "customer.email": 1 });
module.exports = mongoose.model("Ticket", ticketSchema);