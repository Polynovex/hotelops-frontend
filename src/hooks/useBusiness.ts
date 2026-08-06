import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { businessApi } from '../api/business';
import { CreateBusinessPayload } from '../services/api';

export const useBusinesses = () => {
  return useQuery({
    queryKey: ['businesses'],
    queryFn: () => businessApi.getBusinesses(),
    staleTime: 5 * 60 * 1000
  });
};

export const useCreateBusiness = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateBusinessPayload) => businessApi.createBusiness(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businesses'] });
      queryClient.invalidateQueries({ queryKey: ['system-metrics'] });
    }
  });
};
