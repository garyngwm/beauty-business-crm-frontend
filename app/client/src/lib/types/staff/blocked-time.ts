import { z } from "zod";
import { DateTime } from "luxon";
import { formatTimeTo24Hour } from "@/lib/utils/date-processing";

// Enum types
const frequencyTypeEnum = z.enum(["None", "Daily", "Weekly", "Monthly"]);
const endsTypeEnum = z.enum(["Never", "On date", "After"]);

const blockedTimeCore = z.object({
  title: z.string().nonempty("Required"),

  startDate: z.string().min(1, "Required"), // YYYY-MM-DD
  fromTime: z.string().min(1, "Required"), // 10:00am
  toTime: z.string().min(1, "Required"), // 6:30pm

  frequency: frequencyTypeEnum,
  ends: endsTypeEnum.optional(),
  endsOnDate: z.string().optional(),
  endsAfterOccurrences: z.number().min(1).optional(),

  description: z.string().max(255).optional(),
  approved: z.boolean(),
});

/*
    
    [I'll write this just once]

    refine and superRefine validations are triggered AFTER the initial ones (defined above) are satisfied 
    there is a workaround to ensure they trigger at the same time on submit 

    https://codesandbox.io/p/sandbox/rhf-interactive-field-forked-yb7jo?file=%2Fsrc%2FApp.js%3A41%2C12-49%2C16
    manually registering and using validate or deps property

    this would require a refactor away from Shadcn's Form Field
    feel free to embark on this in future (@current maintainer)

  */
const validationRules = (
  v: z.infer<typeof blockedTimeCore>,
  ctx: z.RefinementCtx
) => {
  // toTime must be after fromTime
  const fromTime24Hr = formatTimeTo24Hour(v.fromTime);
  const toTime24Hr = formatTimeTo24Hour(v.toTime);

  if (fromTime24Hr >= toTime24Hr) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "After start time",
      path: ["toTime"],
    });
  }

  // if repeating, ends must be provided
  if (v.frequency !== "None" && !v.ends) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Required",
      path: ["ends"],
    });
  }

  // if ends === "On date"
  if (v.ends === "On date") {
    // endsOnDate is required
    if (!v.endsOnDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endsOnDate"],
        message: "Required",
      });
    }

    // end date must be after start date
    if (v.endsOnDate && v.startDate) {
      const start = DateTime.fromISO(v.startDate);
      const end = DateTime.fromISO(v.endsOnDate);

      if (end <= start) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "After start date",
          path: ["endsOnDate"],
        });
      }
    }
  }

  // if ends === "After", endsAfterOccurrences is required
  if (v.ends === "After") {
    if (v.endsAfterOccurrences === undefined || isNaN(v.endsAfterOccurrences)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endsAfterOccurrences"],
        message: "Required",
      });
    }
  }
};

export const blockedTimeSchema = blockedTimeCore.superRefine(validationRules);

export type BlockedTimeFormData = z.infer<typeof blockedTimeSchema>;
export type BlockedTimeUpsert = BlockedTimeFormData & { staffId: number };

const blockedTimeResponseSchema = blockedTimeCore.extend({
  id: z.number().int().positive(),
  staffId: z.number().int().positive(),

  created_at: z.string(), // ISO datetime
  updated_at: z.string(), // ISO datetime
});

export type BlockedTimeResponse = z.infer<typeof blockedTimeResponseSchema>;
