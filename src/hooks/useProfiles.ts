import { useQuery } from '@tanstack/react-query';

export const useProfiles = () => {
  return useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      return [] as Array<Record<string, unknown>>;
    },
    staleTime: 5 * 60 * 1000
  });
};
