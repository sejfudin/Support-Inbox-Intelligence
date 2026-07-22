import apiClient from './axios';

export const getDaily = async ({ workspace, date }) => {
  const response = await apiClient.get('/dailies', { params: { workspace, date } });
  return response.data;
};

export const getDailyHistory = async ({ workspace }) => {
  const response = await apiClient.get('/dailies/history', { params: { workspace } });
  return response.data;
};

export const startDaily = async ({ workspace, date }) => {
  const response = await apiClient.post('/dailies', { workspace, date });
  return response.data;
};

export const addDailyEntry = async ({ dailyId, member, done, todo, blockers }) => {
  const response = await apiClient.post(`/dailies/${dailyId}/entries`, {
    member,
    done,
    todo,
    blockers,
  });
  return response.data;
};

export const updateDailyEntry = async ({ dailyId, entryId, done, todo, blockers }) => {
  const response = await apiClient.patch(`/dailies/${dailyId}/entries/${entryId}`, {
    done,
    todo,
    blockers,
  });
  return response.data;
};

export const removeDailyEntry = async ({ dailyId, entryId }) => {
  const response = await apiClient.delete(`/dailies/${dailyId}/entries/${entryId}`);
  return response.data;
};
