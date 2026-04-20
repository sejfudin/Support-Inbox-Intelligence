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
}) => {
  const listStatus =
    status !== undefined ? status : activeTab === "all" ? "" : activeTab;
  const normalizedStatus = listStatus === null ? "null" : listStatus;

  const filterParams = { ...queryFilters };
  const sortBy = filterParams.sortBy ?? "dueDate";
  const sortOrder = filterParams.sortOrder === "asc" ? "asc" : "desc";
  delete filterParams.sortBy;
  delete filterParams.sortOrder;

  const sharedParams = {
    search,
    archived,
    workspaceId,
    ...filterParams,
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
