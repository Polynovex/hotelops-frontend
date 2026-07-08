import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { posApi } from '../api/pos';

export const usePosOrders = (params?: { outletId?: string; orderStatus?: string }) => {
  return useQuery({
    queryKey: ['pos-orders', params],
    queryFn: () => posApi.getOrders(params),
    staleTime: 60 * 1000
  });
};

export const useCreatePosOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: posApi.createOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-orders'] });
      queryClient.invalidateQueries({ queryKey: ['kds-orders'] });
    }
  });
};
