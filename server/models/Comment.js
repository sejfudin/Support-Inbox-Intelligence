const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
    content: {
        type: String,
        required: true,
    },
    ticket: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Ticket',
        required: true, 
        index: true,
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    isEdited: { 
        type: Boolean, 
        default: false 
    },
    isDeleted: { 
        type: Boolean,
        default: false,
        index: true 
    }
}, {timestamps: true });

module.exports = mongoose.model('Comment', commentSchema);