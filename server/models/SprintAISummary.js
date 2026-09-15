const mongoose = require('mongoose');

// One AI-generated recap per sprint, replaced wholesale on regenerate (the
// `sprint` index is unique). `workspace` rides along for scoping and for a cheap
// "every summary in this workspace" read.
//
// NUMBERS ARE NOT STORED HERE. Story points and ticket counts — team-wide and
// per person — are recomputed from `Ticket.sprint` on every read by
// `helpers/sprintRules.js`, the same helper the progress strip uses (ADR 0011 /
// ADR 0012), so a recap and the strip beside it can never disagree. What IS
// stored is the model's prose: `team.themes` groups the shipped tickets into a
// handful of short phrases ("Taskbar reorganization"), and `perUser[].themes` is
// the same per assignee. The carry-over list is derived too (subjects of tickets
// that did not land) and is likewise not stored.
//
// `sourceHash` is a digest of the sprint's ticket state at generation time
// (`helpers/sprintSummaryData.js`). A read recomputes it from the live tickets
// and marks the recap `stale` when the two diverge — the freshness mechanism the
// standup card uses (`helpers/standupNote.js`). A past (sealed) sprint's tickets
// barely move, so in practice this only fires for the active-sprint preview.
const perUserSummarySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    themes: { type: [String], default: [] },
  },
  { _id: false }
);

const sprintAISummarySchema = new mongoose.Schema(
  {
    sprint: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sprint',
      required: true,
      // `unique` already builds the index — no separate `index: true` (Mongoose
      // 9 warns on the duplicate). One recap per sprint, replaced on regenerate.
      unique: true,
    },
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    team: {
      themes: { type: [String], default: [] },
    },
    perUser: { type: [perUserSummarySchema], default: [] },
    // Digest of the ticket state this recap was built from — see the file header.
    sourceHash: { type: String, default: '' },
    // Which GROQ_MODEL produced it, kept for debugging a bad batch.
    model: { type: String, default: '' },
    generatedAt: { type: Date, default: Date.now },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SprintAISummary', sprintAISummarySchema);
