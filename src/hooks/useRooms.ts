import { useQuery } from '@tanstack/react-query';
import { pmsApi } from '../api/pms';

export const useRooms = () => {
  return useQuery({
    queryKey: ['rooms'],
    queryFn: () => pmsApi.getRooms(),
    staleTime: 5 * 60 * 1000
  });
};
