import { z } from "zod";
import { apiRequest } from "@/lib/query-client";
import { CustomerResponse } from "../customer";
import { ServiceResponse } from "../service/service";
import { StaffResponse } from "../staff/staff";

export const bookingFormSchema = z.object({
  customerId: z.coerce.number().optional(),
  serviceId: z.number().min(1, "Required"),
  staffId: z.number().min(1, "Required"),
  startTime: z.string().min(1, "Required"), // ISO string
  paymentMethod: z.enum(["Credits", "Card", "Cash"]),
  notes: z.string().optional(),
});

export type BookingFormData = z.infer<typeof bookingFormSchema>;

const appointmentStatusEnum = z.enum([
  "Booked",
  "Confirmed",
  "Show Up",
  "Reschedule",
  "No show",
  "Cancelled",
]);
export type AppointmentStatus = z.infer<typeof appointmentStatusEnum>;

const paymentStatusEnum = z.enum(["Pending", "Paid", "Failed", "Refunded"]);

export const appointmentResponseSchema = bookingFormSchema.extend({
  outletId: z.number().min(1),
  endTime: z.string(), // ISO string
  paymentStatus: paymentStatusEnum,
  creditsPaid: z.number().min(0),
  cashPaid: z.number().min(0),
  status: appointmentStatusEnum,
  id: z.number().min(1),
  createdAt: z.string(), // ISO string
});

export type AppointmentResponse = z.infer<typeof appointmentResponseSchema>;

export interface AppointmentWithDetails extends AppointmentResponse {
  staffMember: any;
  customer?: CustomerResponse;
  staff?: StaffResponse | null;
  service?: ServiceResponse | null;
}

export type SalesPerformancePoint = {
  date: string;
  revenue: number;
  count: number;
};

export type SalesPerformanceResponse = {
  groupBy: "day" | "month";
  points: SalesPerformancePoint[];
  totalRevenue: number;
  totalCount: number;
};


export async function fetchAppointmentSalesPerformance(params: {
  from: string;
  to: string;
  groupBy: "day" | "month";
  dateField?: "start_time" | "created_at";
  outletId?: number;
}) {
  const qs = new URLSearchParams();
  qs.set("from", params.from);
  qs.set("to", params.to);
  qs.set("groupBy", params.groupBy);
  qs.set("dateField", params.dateField ?? "start_time");

  if (params.outletId != null) {
    qs.set("outletId", String(params.outletId));
  }

  return apiRequest(
    "GET",
    `/api/appointments/appointment-sales-performance?${qs.toString()}`
  );
}

