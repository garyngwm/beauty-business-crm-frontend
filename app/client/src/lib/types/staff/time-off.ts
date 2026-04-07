import { z } from "zod";
import { DateTime } from "luxon";
import { formatTimeTo24Hour } from "@/lib/utils/date-processing";

// Enum types
const timeOffTypeEnum = z.enum([
  "Annual leave",
  "Sick leave",
  "Personal",
  "Other",
]);

const frequencyTypeEnum = z.enum(["None", "Repeat"]);

const timeOffCore = z.object({
  type: timeOffTypeEnum,
  startDate: z.string().min(1, "Required"), // YYYY-MM-DD
  startTime: z.string().min(1, "Required"), // 10:00am
  endTime: z.string().min(1, "Required"), // 6:30pm
  frequency: frequencyTypeEnum,
  endsDate: z.string().optional(), // YYYY-MM-DD
  description: z.string().max(255).optional(),
  approved: z.boolean(),
});

const validationRules = (
  v: z.infer<typeof timeOffCore>,
  ctx: z.RefinementCtx
) => {
  // end time must be after start time
  if (!v.startTime || !v.endTime) return;

  const startTime24Hr = formatTimeTo24Hour(v.startTime);
  const endTime24Hr = formatTimeTo24Hour(v.endTime);

  if (startTime24Hr >= endTime24Hr) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "After start time",
      path: ["endTime"],
    });
  }

  // if repeating
  if (v.frequency === "Repeat") {
    // ends date must be present
    if (!v.endsDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Required",
        path: ["endsDate"],
      });
    }

    // ends date must be after start date
    if (v.endsDate) {
      const start = DateTime.fromISO(v.startDate);
      const end = DateTime.fromISO(v.endsDate);

      if (end <= start) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "After start date",
          path: ["endsDate"],
        });
      }
    }
  }
};

export const timeOffSchema = timeOffCore.superRefine(validationRules);

export type TimeOffFormData = z.infer<typeof timeOffSchema>;
export type TimeOffUpsert = TimeOffFormData & {
  duration: number;
  staffId: number;
};

const timeOffResponseSchema = timeOffCore.extend({
  id: z.number().int().positive(),

  duration: z.number().positive(),
  staffId: z.number().int().positive(),

  created_at: z.string(), // ISO datetime
  updated_at: z.string(), // ISO datetime
});

export type TimeOffResponse = z.infer<typeof timeOffResponseSchema>;
