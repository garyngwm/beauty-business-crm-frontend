import { z } from "zod";

const HEX_RE = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/;

export const CategoryColorResponseSchema = z
  .object({
    id: z.number().int().positive(),
    name: z.string().min(1).max(100),
    hex: z
      .string()
      .regex(HEX_RE, "Hex must be in format #RRGGBB or #RRGGBBAA")
      .transform((s) => s.toUpperCase()),
  })
  .strict();

export type CategoryColorResponse = z.infer<typeof CategoryColorResponseSchema>;
