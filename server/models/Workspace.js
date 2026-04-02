const mongoose = require('mongoose');

const workspaceSchema = new mongoose.Schema(
  {
        name: {
            type: String,
            required: [true, 'Please enter a workspace name'],
            maxlength: [100, 'Workspace name cannot be longer than 100 characters'],
        },
        description: {
            type: String,
            maxlength: [500, 'Description cannot be longer than 500 characters'],
        },
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        isArchived: { type: Boolean, default: false },
        members: [
            {
                user: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User',
                },
                role: {
                    type: String,
                    enum: ['admin', 'member'],
                    default: 'member',
                },
                status: {
                    type: String,
                    enum: ['active', 'invited', 'disabled'],
                    default: 'invited',
                },
                invitedBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User',
                },
            },
        ],
    },
    { timestamps: true }
);

module.exports = mongoose.model('Workspace', workspaceSchema);