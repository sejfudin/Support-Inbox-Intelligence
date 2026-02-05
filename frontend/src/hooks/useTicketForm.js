import { useEffect, useMemo, useState } from "react";

export const useTicketForm = (initialStatus = "to do") => {
  const initialState = useMemo(
    () => ({
      subject: "",
      description: "",
      status: initialStatus,
      assignedTo: "unassigned",
    }),
    [initialStatus],
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
