export const getTicketsQueryParams = ({
  page,
  search,
  activeTab,
  archived,
  listLimit = 10,
  boardLimit = 10000,
}) => {
  const listStatus = activeTab === "all" ? "" : activeTab;

  return {
    list: {
      page,
      limit: listLimit,
      search,
      status: listStatus,
      archived,
    },
    board: {
      page: 1,
      limit: boardLimit,
      search,
      status: "",
      archived,
    },
  };
};
