const ticketService = require('../services/ticketService');
const statusService = require('../services/statusService');
const { assertWorkspaceAccess, resolveActiveWorkspaceId } = require('../helpers/workspaceAuthz');
const { ROLES } = require('../constants/roles');
const { handleControllerError } = require('../helpers/controllerError');
const {
  validateSuggestionInput,
  suggestTicketMetadata: suggestTicketMetadataService,
} = require('../services/ticketMetadataSuggestionService');
const {
  validateDescriptionGenerationInput,
  generateTicketDescription: generateTicketDescriptionService,
} = require('../services/ticketDescriptionGenerationService');

const STORY_POINTS_ERROR = 'Story points must be an integer between 1 and 5';

const getAllTickets = async (req, res) => {
  try {
    const {
      page,
      limit,
      search,
      status,
      statusId,
      priority,
      priorities,
      assigneeIds,
      priorityOrder,
      archived,
      workspaceId: queryWorkspaceId,
      sortBy,
      sortOrder,
      periodDays,
      awaitingReviewFrom,
      reviewRequestState,
    } = req.query;

    const workspaceId = await resolveActiveWorkspaceId({
      user: req.user,
      override: queryWorkspaceId,
    });

    const result = await ticketService.getAllTickets({
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
      search: search || '',
      status: status || '',
      statusId: statusId || '',
      priority: priority || '',
      priorities: priorities || '',
      assigneeIds: assigneeIds || '',
      priorityOrder: priorityOrder || 'none',
      archived: archived === undefined ? undefined : archived === 'true',
      workspaceId,
      sortBy: sortBy || 'updatedAt',
      sortOrder: sortOrder === 'asc' ? 'asc' : 'desc',
      periodDays,
      // Resolved here, not in the service, which stays ignorant of "current user".
      awaitingReviewFromUserId: awaitingReviewFrom === 'me' ? req.user._id : undefined,
      reviewRequestState: reviewRequestState || '',
    });

    res.status(200).json({
      success: true,
      data: result.tickets,
      pagination: result.pagination,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error: Unable to fetch tickets',
      error: error.message,
    });
  }
};

const getTicketById = async (req, res) => {
  try {
    const { id } = req.params;
    const ticket = await ticketService.getTicketById(id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found',
      });
    }

    // Admins and mentors can read tickets in any workspace. Everyone else
    // (interns, leadership) may only read a ticket if they are an active
    // member of that ticket's workspace.
    await assertWorkspaceAccess(ticket.workspace, req.user, 'Ticket not found');

    res.status(200).json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    if (error.message === 'Ticket not found') {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    res.status(500).json({
      success: false,
      message: 'Server Error: Unable to fetch ticket details',
      error: error.message,
    });
  }
};

const createTicket = async (req, res, next) => {
  try {
    const {
      subject,
      description,
      assignedTo,
      status,
      statusId,
      workspaceId: bodyWorkspaceId,
      priority,
      dueDate,
      storyPoints,
      category,
      blockedBy,
    } = req.body;
    const isAdmin = req.user?.role === ROLES.ADMIN;
    const hasStatus = status !== undefined && status !== null && status !== '';
    const hasStatusId = statusId !== undefined && statusId !== null && statusId !== '';
    const workspaceId = await resolveActiveWorkspaceId({
      user: req.user,
      override: bodyWorkspaceId,
    });

    if (!workspaceId) {
      return res.status(400).json({ success: false, message: 'No workspace associated' });
    }

    const assignedAgents = assignedTo
      ? Array.isArray(assignedTo)
        ? assignedTo
        : [assignedTo]
      : [];
    if (!subject) {
      return res.status(400).json({
        success: false,
        message: 'Subject details are required',
      });
    }

    const normalizedStoryPoints = normalizeStoryPointsInput(storyPoints);

    const newTicket = await ticketService.createTicket({
      subject,
      description,
      creatorId: req.user._id,
      actorUserId: req.user._id,
      assignedTo: assignedAgents,
      status: hasStatus ? statusService.slugifyLabel(status) : undefined,
      statusId: hasStatusId ? statusId : undefined,
      isAdmin,
      workspaceId,
      priority: priority || 'medium',
      dueDate,
      storyPoints: normalizedStoryPoints,
      category: category || null,
      blockedBy,
    });
    res.status(201).json({
      success: true,
      data: newTicket,
    });
  } catch (error) {
    if (
      error.message === 'Assigned users must be active members of this workspace' ||
      error.message === 'Workspace not found' ||
      error.message === 'Subject details are required' ||
      error.message?.includes('is not valid for this workspace') ||
      error.message === 'Status is not valid for this workspace' ||
      error.message === 'Invalid status'
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    if (error.name === 'StatusValidationError') {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    if (error.message === STORY_POINTS_ERROR) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    // Services raise `httpError` for validation the caller can fix (a blocker
    // pointing outside the workspace, a circular block) — the status rides on the
    // error, so it maps straight through instead of reading as a server fault.
    if (Number.isInteger(error?.statusCode)) {
      return handleControllerError(res, error, next);
    }

    res.status(500).json({
      success: false,
      message: 'Server Error: Unable to create ticket',
      error: error.message,
    });
  }
};

const updateTicket = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const existingTicket = await ticketService.getTicketById(id);

    // Admins and mentors can edit tickets in any workspace. Everyone else
    // may only edit a ticket if they are an active member of that ticket's
    // workspace.
    await assertWorkspaceAccess(existingTicket.workspace, req.user, 'Ticket not found');

    const hasStoryPoints = Object.prototype.hasOwnProperty.call(updateData, 'storyPoints');

    const normalizedStoryPoints = hasStoryPoints
      ? normalizeStoryPointsInput(updateData.storyPoints)
      : undefined;

    const allowedUpdates = [
      'subject',
      'description',
      'status',
      'statusId',
      'assignedTo',
      'priority',
      'dueDate',
      'storyPoints',
      'category',
      'blockedBy',
    ];
    const filteredUpdate = Object.keys(updateData)
      .filter((key) => allowedUpdates.includes(key))
      .reduce((obj, key) => {
        if (key === 'status' && typeof updateData[key] === 'string') {
          obj[key] = statusService.slugifyLabel(updateData[key]);
        } else if (key === 'priority' && typeof updateData[key] === 'string') {
          obj[key] = updateData[key].toLowerCase();
        } else if (key === 'dueDate') {
          const v = updateData[key];
          obj[key] = v === null || v === '' ? null : v;
        } else if (key === 'storyPoints') {
          obj[key] = normalizedStoryPoints;
        } else if (key === 'category') {
          const v = updateData[key];
          obj[key] = v === null || v === '' || v === 'none' ? null : v;
        } else {
          obj[key] = updateData[key];
        }
        return obj;
      }, {});

    const updatedTicket = await ticketService.updateTicket(id, filteredUpdate, req.user._id);

    res.status(200).json({
      success: true,
      data: updatedTicket,
    });
  } catch (error) {
    if (error.message === 'Ticket not found') {
      return res.status(404).json({ message: error.message });
    }
    if (
      error.message === 'Assigned users must be active members of this workspace' ||
      error.message === 'Workspace not found' ||
      error.message === 'Subject details are required' ||
      error.message?.includes('is not valid for this workspace') ||
      error.message === 'Status is not valid for this workspace' ||
      error.message === 'Invalid status' ||
      error.message === 'Tickets cannot be moved back to the backlog.'
    ) {
      return res.status(400).json({ message: error.message });
    }

    if (error.name === 'StatusValidationError') {
      return res.status(400).json({ message: error.message });
    }

    if (error.message === STORY_POINTS_ERROR) {
      return res.status(400).json({ message: error.message });
    }

    // See the note in `createTicket` — an error carrying a `statusCode` is one the
    // caller can act on; only the ones without fall through as an unexpected 500.
    if (Number.isInteger(error?.statusCode)) {
      return handleControllerError(res, error, next);
    }

    next(error);
  }
};

const archiveTicket = async (req, res, next) => {
  try {
    const { id } = req.params;

    const existingTicket = await ticketService.getTicketById(id);

    // Admins and mentors can archive tickets in any workspace. Everyone else
    // may only archive a ticket if they are an active member of that ticket's
    // workspace.
    await assertWorkspaceAccess(existingTicket.workspace, req.user, 'Ticket not found');

    const ticket = await ticketService.archiveTicket(id, req.user._id);

    res.status(200).json({
      success: true,
      data: ticket,
      message: 'Ticket archived successfully',
    });
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    if (error.message === 'Ticket not found') {
      return res.status(404).json({ message: error.message });
    }
    next(error);
  }
};

const unarchiveTicket = async (req, res, next) => {
  try {
    const { id } = req.params;

    const existingTicket = await ticketService.getTicketById(id);

    // Same workspace rule as archiving above.
    await assertWorkspaceAccess(existingTicket.workspace, req.user, 'Ticket not found');

    const ticket = await ticketService.unarchiveTicket(id, req.user._id);

    res.status(200).json({
      success: true,
      data: ticket,
      message: 'Ticket restored successfully',
    });
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    if (error.message === 'Ticket not found') {
      return res.status(404).json({ message: error.message });
    }
    next(error);
  }
};

const getReviewerCandidates = async (req, res, next) => {
  try {
    const { ticketId } = req.params;

    const existingTicket = await ticketService.getTicketById(ticketId);
    await assertWorkspaceAccess(existingTicket.workspace, req.user, 'Ticket not found');

    const result = await ticketService.getReviewerCandidates(ticketId, req.user._id);

    res.status(200).json({ success: true, message: 'Reviewer candidates fetched', data: result });
  } catch (error) {
    handleControllerError(res, error, next);
  }
};

const requestReview = async (req, res, next) => {
  try {
    const { ticketId } = req.params;
    const { prUrl, reviewerId } = req.body;

    const existingTicket = await ticketService.getTicketById(ticketId);
    await assertWorkspaceAccess(existingTicket.workspace, req.user, 'Ticket not found');

    const ticket = await ticketService.requestReview(ticketId, { prUrl, reviewerId }, req.user);

    res.status(200).json({ success: true, message: 'Review requested', data: ticket });
  } catch (error) {
    if (error.message === 'Ticket not found') {
      return res.status(404).json({ success: false, message: error.message });
    }
    handleControllerError(res, error, next);
  }
};

const answerReview = async (req, res, next) => {
  try {
    const { ticketId } = req.params;
    const { state } = req.body;

    const existingTicket = await ticketService.getTicketById(ticketId);
    await assertWorkspaceAccess(existingTicket.workspace, req.user, 'Ticket not found');

    const ticket = await ticketService.answerReview(ticketId, { state }, req.user._id);

    res.status(200).json({ success: true, message: 'Review answered', data: ticket });
  } catch (error) {
    if (error.message === 'Ticket not found') {
      return res.status(404).json({ success: false, message: error.message });
    }
    handleControllerError(res, error, next);
  }
};

const cancelReview = async (req, res, next) => {
  try {
    const { ticketId } = req.params;

    const existingTicket = await ticketService.getTicketById(ticketId);
    await assertWorkspaceAccess(existingTicket.workspace, req.user, 'Ticket not found');

    const ticket = await ticketService.cancelReview(ticketId, req.user._id);

    res.status(200).json({ success: true, message: 'Review request cancelled', data: ticket });
  } catch (error) {
    if (error.message === 'Ticket not found') {
      return res.status(404).json({ success: false, message: error.message });
    }
    handleControllerError(res, error, next);
  }
};

const getMyTickets = async (req, res, next) => {
  try {
    const {
      page,
      limit,
      search,
      status,
      statusId,
      priority,
      priorities,
      priorityOrder,
      sortBy,
      sortOrder,
    } = req.query;

    const result = await ticketService.getMyTickets({
      userId: req.user._id,
      workspaceId: await resolveActiveWorkspaceId({ user: req.user }),
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
      search: search || '',
      status: status || '',
      statusId: statusId || '',
      priority: priority || '',
      priorities: priorities || '',
      priorityOrder: priorityOrder || 'none',
      sortBy: sortBy || 'updatedAt',
      sortOrder: sortOrder === 'asc' ? 'asc' : 'desc',
    });

    res.status(200).json({
      success: true,
      data: result.tickets,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

const normalizeStoryPointsInput = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) throw new Error(STORY_POINTS_ERROR);

  return parsed;
};

const suggestTicketMetadata = async (req, res) => {
  try {
    const { subject, description } = req.body || {};

    const validationError = validateSuggestionInput({ subject, description });
    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const suggestion = await suggestTicketMetadataService({ subject, description });

    return res.status(200).json({
      success: true,
      data: suggestion,
    });
  } catch (error) {
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 503;

    return res.status(statusCode).json({
      success: false,
      message: error?.message || 'AI suggestion is currently unavailable.',
    });
  }
};

const generateTicketDescription = async (req, res) => {
  try {
    const { subject, prompt } = req.body || {};

    const validationError = validateDescriptionGenerationInput({ subject, prompt });
    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const result = await generateTicketDescriptionService({ subject, prompt });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 503;

    return res.status(statusCode).json({
      success: false,
      message: error?.message || 'AI description generation is currently unavailable.',
    });
  }
};

module.exports = {
  getAllTickets,
  getTicketById,
  createTicket,
  updateTicket,
  archiveTicket,
  unarchiveTicket,
  getMyTickets,
  suggestTicketMetadata,
  generateTicketDescription,
  getReviewerCandidates,
  requestReview,
  answerReview,
  cancelReview,
};
