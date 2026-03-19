export const getTicketsQueryParams = ({
  page,
  search,
  activeTab,
  archived,
  status,
  workspaceId,
  listLimit = 10,
  boardLimit = 10000,
}) => {
  const listStatus =
    status !== undefined ? status : activeTab === "all" ? "" : activeTab;
  const normalizedStatus = listStatus === null ? "null" : listStatus;

  return {
    list: {
      page,
      limit: listLimit,
      search,
      status: normalizedStatus,
      archived,
      workspaceId,
    },
    board: {
      page: 1,
      limit: boardLimit,
      search,
      status: status !== undefined ? normalizedStatus : "",
      archived,
      workspaceId,
    },
  };
};
