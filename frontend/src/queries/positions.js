import { useQuery } from '@tanstack/react-query';
import { fetchPositions } from '@/api/positions';

export const POSITIONS_QUERY_KEY = ['positions'];

export const usePositions = () =>
  useQuery({
    queryKey: POSITIONS_QUERY_KEY,
    queryFn: fetchPositions,
    staleTime: 10 * 60 * 1000,
  });
