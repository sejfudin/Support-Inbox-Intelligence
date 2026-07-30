import { useCallback, useEffect, useMemo, useState } from 'react';
import { extractStatusId } from '@/helpers/normalizeTicket';
import { normalizeStoryPoints } from '@/helpers/storyPoints';
import { dueDateToInputValue } from '@/helpers/ticketDueDate';

const SUBJECT_PREFIX_RE = /^\s*(?:ticket\s*\d+|t\s*#?\s*\d+)\s*[:\-]\s*/i;

export const sanitizeDisplaySubject = (value) =>
  String(value || '')
    .replace(SUBJECT_PREFIX_RE, '')
    .trim();

export const useTicketDetailsFormState = (ticket, isOpen, helpers) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [currentStatus, setCurrentStatus] = useState('To Do');
  const [currentPriority, setCurrentPriority] = useState('medium');
  const [currentStoryPoints, setCurrentStoryPoints] = useState(null);
  const [selectedAgents, setSelectedAgents] = useState([]);
  const [dueDateInput, setDueDateInput] = useState('');
  const [currentCategory, setCurrentCategory] = useState(null);
  const [priorityLockedByUser, setPriorityLockedByUser] = useState(false);
  const [storyPointsLockedByUser, setStoryPointsLockedByUser] = useState(false);

  const updateField = useCallback((field, value) => {
    if (field === 'description') {
      setDescription(String(value || ''));
      return;
    }

    if (field === 'priority') {
      setCurrentPriority(String(value || 'medium'));
      return;
    }

    if (field === 'storyPoints') {
      setCurrentStoryPoints(normalizeStoryPoints(value));
    }
  }, []);

  useEffect(() => {
    if (isOpen) return;
    setPriorityLockedByUser(false);
    setStoryPointsLockedByUser(false);
  }, [isOpen]);

  useEffect(() => {
    if (!ticket || !isOpen) return;

    const displayTitle = sanitizeDisplaySubject(ticket.subject || ticket.title);
    setTitle(displayTitle || 'Untitled Task');
    setDescription(ticket.description ?? '');
    setCurrentStatus(extractStatusId(ticket.status) || helpers.defaultMainStatusId || '');
    setCurrentPriority(ticket.priority ?? 'medium');
    setCurrentStoryPoints(normalizeStoryPoints(ticket.storyPoints));

    const existingAgentIds = ticket.assignedTo?.map((a) => a._id || a) || [];
    setSelectedAgents(existingAgentIds);
    setDueDateInput(dueDateToInputValue(ticket.dueDate));
    setCurrentCategory(ticket.category?._id || ticket.category || null);
    setPriorityLockedByUser(false);
    setStoryPointsLockedByUser(false);
  }, [isOpen, ticket, helpers.defaultMainStatusId]);

  const handlePriorityChange = useCallback((value) => {
    setPriorityLockedByUser(true);
    setCurrentPriority(value);
  }, []);

  const handleStoryPointsChange = useCallback((value) => {
    setStoryPointsLockedByUser(true);
    setCurrentStoryPoints(normalizeStoryPoints(value));
  }, []);

  const hasChanges = useMemo(() => {
    if (!ticket) return false;
    const initialTitle = sanitizeDisplaySubject(ticket.subject || ticket.title) || 'Untitled Task';
    const initialDescription = ticket.description ?? '';
    const initialStatus = extractStatusId(ticket.status) || helpers.defaultMainStatusId || '';
    const initialPriority = ticket.priority ?? 'medium';
    const initialStoryPoints = normalizeStoryPoints(ticket.storyPoints);
    const initialAgents = (ticket.assignedTo?.map((a) => a._id || a) || []).sort();
    const currentAgents = [...selectedAgents].sort();
    const initialDue = dueDateToInputValue(ticket.dueDate);
    const initialCategory = ticket.category?._id || ticket.category || null;
    return (
      title !== initialTitle ||
      description !== initialDescription ||
      currentStatus !== initialStatus ||
      currentPriority !== initialPriority ||
      currentStoryPoints !== initialStoryPoints ||
      dueDateInput !== initialDue ||
      currentCategory !== initialCategory ||
      JSON.stringify(initialAgents) !== JSON.stringify(currentAgents)
    );
  }, [
    ticket,
    description,
    currentStatus,
    currentPriority,
    currentStoryPoints,
    selectedAgents,
    title,
    dueDateInput,
    currentCategory,
    helpers.defaultMainStatusId,
  ]);

  return {
    title,
    setTitle,
    description,
    setDescription,
    currentStatus,
    setCurrentStatus,
    currentPriority,
    currentStoryPoints,
    selectedAgents,
    setSelectedAgents,
    dueDateInput,
    setDueDateInput,
    currentCategory,
    setCurrentCategory,
    priorityLockedByUser,
    storyPointsLockedByUser,
    updateField,
    handlePriorityChange,
    handleStoryPointsChange,
    hasChanges,
  };
};
