export const getApiErrorMessage = (error, fallback = 'Something went wrong. Please try again.') => {
  const data = error?.response?.data;

  if (typeof data === 'string' && data.trim()) {
    return data.trim();
  }

  if (data?.message) {
    return data.message;
  }

  if (data?.error) {
    return data.error;
  }

  if (error?.message) {
    return error.message;
  }

  return fallback;
};
