import { z } from 'zod';

export const createPosOrderSchema = z.object({
  outletId: z.string().min(1),
  orderType: z.enum(['DINE_IN', 'TAKEAWAY', 'DELIVERY', 'ROOM_SERVICE', 'NO_CHARGE']),
  tableNumber: z.string().optional(),
  bookingId: z.string().optional(),
  subtotal: z.coerce.number().min(0),
  tax: z.coerce.number().min(0),
  total: z.coerce.number().min(0)
}).superRefine((value, ctx) => {
  if (value.orderType === 'ROOM_SERVICE' && !value.bookingId?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['bookingId'],
      message: 'Reservation ID is required for room service'
    });
  }
});

export type CreatePosOrderSchema = z.infer<typeof createPosOrderSchema>;
