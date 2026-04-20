export const getTicketsQueryParams = ({
  page,
  search,
  activeTab,
  archived,
  status,
  workspaceId,
  queryFilters = {},
  listLimit = 10,
  boardLimit = 10000,
  sortBy = "dueDate",
  sortOrder = "desc",
}) => {
  const listStatus =
    status !== undefined ? status : activeTab === "all" ? "" : activeTab;
  const normalizedStatus = listStatus === null ? "null" : listStatus;

  const sharedParams = {
    search,
    archived,
    workspaceId,
    ...queryFilters,
  };

  return {
    list: {
      page,
      limit: listLimit,
      ...sharedParams,
      status: normalizedStatus,
      sortBy,
      sortOrder,
    },
    board: {
      page: 1,
      limit: boardLimit,
      ...sharedParams,
      status: status !== undefined ? normalizedStatus : "",
      sortBy: "updatedAt",
      sortOrder: "desc",
    },
  };
};
