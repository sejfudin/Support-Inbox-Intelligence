const mongoose = require('mongoose');
const sanitizeHtml = require('sanitize-html');
const AISummary = require('../models/AISummary');
const Ticket = require('../models/Ticket');
const Workspace = require('../models/Workspace');
const statusService = require('./statusService');
const { buildUserSummaryPrompt } = require('../prompts/ticketPrompts');
const { createAiServiceError, requestGroqOutputText } = require('./groqAiClient');
const { userSelect } = require('../constants/userSelect');

function normalizeText(value) {
  return String(value || '').trim();
}

function toObjectId(value, errorMessage) {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new Error(errorMessage);
  }

  return new mongoose.Types.ObjectId(value);
}

function stripHtml(value) {
  return sanitizeHtml(normalizeText(value), {
    allowedTags: [],
    allowedAttributes: {},
  }).trim();
}

function sanitizeSummaryText(value) {
  return normalizeText(value)
    .replace(/^```(?:text|markdown)?\s*/i, '')
    .replace(/```$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function ensureWorkspaceAccess({ workspaceId, userId, requesterId, requesterRole }) {
  const workspace = await Workspace.findOne({
    _id: workspaceId,
    isArchived: { $ne: true },
  }).select('members');

  if (!workspace) {
    throw new Error('Workspace not found');
  }

  const targetIsActiveMember = workspace.members.some(
    (member) => member.user && member.user.equals(userId) && member.status === 'active'
  );

  if (!targetIsActiveMember) {
    throw new Error('User is not an active member of this workspace');
  }

  if (requesterRole === 'admin') {
    return;
  }

  const requesterIsActiveMember = workspace.members.some(
    (member) => member.user && member.user.equals(requesterId) && member.status === 'active'
  );

  if (!requesterIsActiveMember) {
    throw new Error('Not a member of this workspace');
  }
}

async function getLatestUserSummary({ userId, workspaceId, requesterId, requesterRole }) {
  const userObjectId = toObjectId(userId, 'Invalid userId');
  const workspaceObjectId = toObjectId(workspaceId, 'Invalid workspaceId');
  const requesterObjectId = toObjectId(requesterId, 'Invalid requesterId');

  await ensureWorkspaceAccess({
    workspaceId: workspaceObjectId,
    userId: userObjectId,
    requesterId: requesterObjectId,
    requesterRole,
  });

  return AISummary.findOne({
    user: userObjectId,
    workspace: workspaceObjectId,
  })
    .sort({ generatedAt: -1 })
    .populate('user', userSelect())
    .populate('workspace', 'name');
}

async function generateUserSummary({ userId, workspaceId, requesterId, requesterRole }) {
  const userObjectId = toObjectId(userId, 'Invalid userId');
  const workspaceObjectId = toObjectId(workspaceId, 'Invalid workspaceId');
  const requesterObjectId = toObjectId(requesterId, 'Invalid requesterId');

  await ensureWorkspaceAccess({
    workspaceId: workspaceObjectId,
    userId: userObjectId,
    requesterId: requesterObjectId,
    requesterRole,
  });

  const { doneIds } = await statusService.getStatusIdSets(workspaceObjectId);

  const tickets = await Ticket.find({
    assignedTo: userObjectId,
    workspace: workspaceObjectId,
    status: { $in: doneIds },
    isArchived: { $ne: true },
    $or: [{ subject: { $exists: true, $ne: '' } }, { description: { $exists: true, $ne: '' } }],
  })
    .sort({ doneAt: -1, updatedAt: -1 })
    .populate('status', 'slug')
    .select('subject description status priority')
    .lean();

  if (tickets.length === 0) {
    throw createAiServiceError('No completed tickets found for this user in the workspace.', 404);
  }

  const prompt = buildUserSummaryPrompt({
    tickets: tickets.map((ticket) => ({
      subject: normalizeText(ticket.subject),
      description: stripHtml(ticket.description),
      status: normalizeText(
        ticket.status && typeof ticket.status === 'object' ? ticket.status.slug : ticket.status
      ),
      priority: normalizeText(ticket.priority),
    })),
  });

  const outputText = await requestGroqOutputText({ prompt });
  const summary = sanitizeSummaryText(outputText);

  if (!summary) {
    throw createAiServiceError('AI generated empty summary.', 502);
  }

  return AISummary.create({
    user: userObjectId,
    workspace: workspaceObjectId,
    summary,
    generatedAt: new Date(),
  });
}

module.exports = {
  getLatestUserSummary,
  generateUserSummary,
};
