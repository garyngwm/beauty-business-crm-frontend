import { z } from "zod";

export const outletResponseSchema = z
  .object({
    id: z.number().int().positive(),
    name: z.string().min(1).max(255),
    address: z.string().min(1),
    phone: z.string().max(20).nullish(),
    active: z.boolean(),
  })
  .strict();

export type OutletResponse = z.infer<typeof outletResponseSchema>;
