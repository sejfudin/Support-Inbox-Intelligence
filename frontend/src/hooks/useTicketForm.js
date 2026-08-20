import { useEffect, useMemo, useState } from 'react';
import { emptyBlocker } from '@/helpers/ticketBlocker';

export const useTicketForm = (initialStatus = '') => {
  const initialState = useMemo(
    () => ({
      subject: '',
      description: '',
      status: initialStatus,
      priority: 'medium',
      storyPoints: null,
      assignedTo: 'unassigned',
      dueDate: '',
      category: null,
      // Only sent when Blocked is the chosen status — see `NewTickets#handleCreate`.
      blockedBy: emptyBlocker(),
    }),
    [initialStatus]
  );

  const [form, setForm] = useState(initialState);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      status: initialStatus,
    }));
  }, [initialStatus]);

  const updateField = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const resetForm = () => setForm(initialState);

  return {
    form,
    setForm,
    updateField,
    resetForm,
  };
};
