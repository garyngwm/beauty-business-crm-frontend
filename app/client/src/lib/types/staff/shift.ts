import { z } from "zod";

const shiftUpsertSchema = z.object({
  staffId: z.number().int().positive(),
  startTime: z.string(), // HH:mm
  endTime: z.string(), // HH:mm
  shiftDate: z.string(), // YYYY-MM-DD
});
export type ShiftUpsert = z.infer<typeof shiftUpsertSchema>;

const shiftResponseSchema = shiftUpsertSchema.extend({
  id: z.number().int().positive(),
});

export type ShiftResponse = z.infer<typeof shiftResponseSchema>;
