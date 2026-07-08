import { Card, CardContent, Grid, Typography } from '@mui/material';

export interface KPIItem {
  label: string;
  value: string | number;
  helperText?: string;
}

interface KPICardsProps {
  items?: KPIItem[];
}

const defaultItems: KPIItem[] = [
  { label: 'Occupancy', value: '0%' },
  { label: 'Revenue (Today)', value: '₦0' },
  { label: 'ADR', value: '₦0' },
  { label: 'RevPAR', value: '₦0' }
];

const KPICards = ({ items = defaultItems }: KPICardsProps) => {
  return (
    <Grid container spacing={2}>
      {items.map((item) => (
        <Grid item xs={12} sm={6} md={3} key={item.label}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                {item.label}
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {item.value}
              </Typography>
              {item.helperText && (
                <Typography variant="caption" color="text.secondary">
                  {item.helperText}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
};

export default KPICards;
