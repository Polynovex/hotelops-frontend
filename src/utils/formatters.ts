export const formatCurrency = (value: number, currency = 'NGN') => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2
  }).format(value || 0);
};

export const formatNumber = (value: number) => new Intl.NumberFormat('en-NG').format(value || 0);

export const formatDate = (value: string | Date) => {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return 'Invalid date';
  }
  return date.toLocaleDateString('en-NG');
};
