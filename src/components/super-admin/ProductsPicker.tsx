import { Box, Checkbox, Chip, FormControlLabel, Stack, Switch, Tooltip, Typography } from '@mui/material';
import type { AddOnRecord } from '../../services/addons';

export type Products = { pms: boolean; pos: boolean; hr: boolean };

/**
 * Core products and add-ons for a business. Finance is always on. A business
 * needs the PMS, the POS or both: PMS + Finance for a hotel without outlets,
 * POS + Finance for a standalone restaurant. Minibar and events work on rooms,
 * so they need the PMS.
 */
export const ProductsPicker = ({
  products,
  onProducts,
  catalogue,
  selected,
  onToggleAddOn,
  busy
}: {
  products: Products;
  onProducts: (next: Products) => void;
  catalogue: AddOnRecord[];
  selected: (addOn: AddOnRecord) => boolean;
  onToggleAddOn: (addOn: AddOnRecord, enabled: boolean) => void;
  busy?: boolean;
}) => {
  const set = (key: keyof Products, value: boolean) => {
    const next = { ...products, [key]: value };
    if (!next.pms && !next.pos) return;
    onProducts(next);
  };
  const needsPms = (a: AddOnRecord) => a.behavior === 'MINIBAR' || a.behavior === 'EVENTS';

  return (
    <Stack spacing={1.5}>
      <Box>
        <Typography variant="subtitle2" fontWeight={800}>Products</Typography>
        <Stack direction="row" flexWrap="wrap" useFlexGap columnGap={2} alignItems="center">
          <FormControlLabel control={<Switch checked={products.pms} disabled={busy || (products.pms && !products.pos)} onChange={(e) => set('pms', e.target.checked)} />} label="PMS" />
          <FormControlLabel control={<Switch checked={products.pos} disabled={busy || (products.pos && !products.pms)} onChange={(e) => set('pos', e.target.checked)} />} label="POS" />
          <FormControlLabel control={<Switch checked={products.hr} disabled={busy} onChange={(e) => set('hr', e.target.checked)} />} label="HR & payroll" />
          <Tooltip title="Every business has Finance">
            <Chip size="small" color="success" label="Finance: always on" />
          </Tooltip>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'none' }}>
          A business needs the PMS, the POS or both.
        </Typography>
      </Box>
      <Box>
        <Typography variant="subtitle2" fontWeight={800}>Add-ons</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, columnGap: 1 }}>
          {catalogue.filter((a) => a.isActive).map((addOn) => {
            const blocked = needsPms(addOn) && !products.pms;
            return (
              <Tooltip key={addOn.id} title={blocked ? `${addOn.name} needs the PMS` : addOn.description ?? ''} placement="top-start">
                <FormControlLabel
                  control={<Checkbox size="small" checked={selected(addOn)} disabled={busy || (blocked && !selected(addOn))} onChange={(e) => onToggleAddOn(addOn, e.target.checked)} />}
                  label={<Typography variant="body2">{addOn.name}{!addOn.isBuiltIn ? ' (custom)' : ''}</Typography>}
                />
              </Tooltip>
            );
          })}
        </Box>
      </Box>
    </Stack>
  );
};

export default ProductsPicker;
