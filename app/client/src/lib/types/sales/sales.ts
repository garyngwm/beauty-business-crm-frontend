// src/models/sales/sales.ts
import { z } from "zod";
import { CustomerResponse } from "../customer";
import { OutletResponse } from "../outlet/outlet";

export const salesRecordSchema = z.object({
  id: z.number(),

  customerId: z.number(),
  customerName: z.string(),

  appointmentId: z.number().nullable(),
  outletId: z.number().nullable(),
  outletName: z.string().nullable().optional(),

  amount: z.number(),

  type: z.enum(["usage", "refund", "purchase", "stripe_recurring"]),

  description: z.string().nullable().optional(),

  createdAt: z.string(),

  membershipTitle: z.string().nullable().optional(),

  stripeStatus: z.string().nullable().optional(),
  stripeInvoiceId: z.string().nullable().optional(),
  stripeFee: z.number().default(0),
  gstFee: z.number().optional(),
});

export type SalesRecordResponse = z.infer<typeof salesRecordSchema>;

export interface SalesRecordWithDetails extends SalesRecordResponse {
  customer?: CustomerResponse;
  outlet?: OutletResponse | null;
}

export const appointmentSaleSchema = z.object({
  id: z.number().min(1),

  customerId: z.number().min(1),
  customerName: z.string().optional().nullable(),

  serviceId: z.number().min(1),
  serviceName: z.string().optional().nullable(),

  outletId: z.number().optional().nullable(),
  outletName: z.string().optional().nullable(),

  startTime: z.string(),    // ISO
  createdAt: z.string(),    // ISO

  paymentMethod: z.enum(["Credits", "Card", "Cash"]),
  paymentStatus: z.enum(["Pending", "Paid", "Failed", "Refunded"]),

  creditsPaid: z.number(),
  cashPaid: z.number(),

  stripeFee: z.number().default(0),
  gstPercent: z.number().min(0).max(100).optional().default(0),
});

export type AppointmentSaleResponse = z.infer<typeof appointmentSaleSchema>;
