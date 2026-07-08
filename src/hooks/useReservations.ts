import { useQuery } from '@tanstack/react-query';
import { pmsApi } from '../api/pms';

export const useReservations = () => {
  return useQuery({
    queryKey: ['reservations'],
    queryFn: () => pmsApi.getReservations(),
    staleTime: 5 * 60 * 1000
  });
};
