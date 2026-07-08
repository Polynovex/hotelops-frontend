import { useQuery } from '@tanstack/react-query';
import { accountingApi } from '../api/accounting';

export const useChartOfAccounts = () => {
  return useQuery({
    queryKey: ['chart-of-accounts'],
    queryFn: () => accountingApi.getChartOfAccounts(),
    staleTime: 5 * 60 * 1000
  });
};

export const useJournals = () => {
  return useQuery({
    queryKey: ['journals'],
    queryFn: () => accountingApi.getJournals(),
    staleTime: 5 * 60 * 1000
  });
};
