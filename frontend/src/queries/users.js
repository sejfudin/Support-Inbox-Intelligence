import { useQuery } from "@tanstack/react-query";
import { getUsers } from "@/api/users";

export const useUsers = (filters = { page: 1, limit: 10, search: "", pagination:true }) => {
  return useQuery({
    queryKey: ["users", filters],
    queryFn: () => getUsers(filters),
    keepPreviousData: true, 
  });
};