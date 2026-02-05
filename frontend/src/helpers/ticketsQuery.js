export const getTicketsQueryParams = ({
  page,
  search,
  activeTab,
  listLimit = 10,
  boardLimit = 10000,
}) => {
  const status = activeTab === "all" ? "" : activeTab;

  return {
    list: {
      page,
      limit: listLimit,
      search,
      status,
    },
    board: {
      page: 1,
      limit: boardLimit,
      search,
      status,
    },
  };
};
