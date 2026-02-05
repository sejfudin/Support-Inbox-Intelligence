export const getTicketsQueryParams = ({
  page,
  search,
  activeTab,
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
    },
    board: {
      page: 1,
      limit: boardLimit,
      search,
      status: "",
    },
  };
};
