import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/dialog";
import { Button } from "~/button";
import { Textarea } from "~/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/select";
import { RadioGroup, RadioGroupItem } from "~/radio-group";
import { Label } from "~/label";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/form";

import { apiRequest, queryClient } from "@/lib/query-client";
import { DateTime } from "luxon";
import { DateTimePicker } from "@/components/shared/date-time-picker";
import { cn } from "@/lib/utils/date-processing";
import LoadingSpinner from "@/components/shared/loading-spinner";
import { useMinimumLoadingTime } from "@/hooks/use-min-loading";
import { useEffect, useState } from "react";
import { toastManager } from "@/components/shared/toast-manager";
import { radioStyles } from "@/lib/utils/style-processing";
import { MIN_LOADING } from "@/lib/constants";
import { getErrorDescription } from "@/lib/utils/misc";
import {
  bookingFormSchema as baseBookingFormSchema,
  type AppointmentResponse,
} from "@/lib/types/appointment/appointment";

import { type ServiceResponse } from "@/lib/types/service/service";
import { type StaffResponse } from "@/lib/types/staff/staff";
import CustomerModal from "@/components/customer/customer-modal";
import CustomerField from "@/components/customer/customer-field";
import ServiceField from "@/components/service/service-field";

// ---------- Local schema & types (adds serviceIds for multi-select) ----------
const bookingFormSchemaMulti = baseBookingFormSchema
  .omit({ serviceId: true as never })
  .extend({
    serviceItems: z
      .array(
        z.object({
          serviceId: z.number(),
          quantity: z.number().int().min(1).default(1),
        })
      )
      .default([]),
    endTime: z.string().optional(),
    overrideCashPrice: z.number().nonnegative().optional(),
  });

type BookingFormDataMulti = z.infer<typeof bookingFormSchemaMulti>;

export type BookingFormValues = z.infer<typeof bookingFormSchemaMulti>;

// Payload we send to backend for each appointment
type CreateAppointmentPayload = {
  customerId: number;
  serviceId: number;
  quantity: number;
  staffId?: number;
  outletId: number;

  startTime: string; // "YYYY-MM-DDTHH:mm:ss"
  endTime: string;

  paymentMethod: "Credits" | "Card" | "Cash";
  paymentStatus: string; // e.g., "Pending"

  creditsPaid: number;
  cashPaid: number;

  notes?: string;
  status:
  | "Booked"
  | "Confirmed"
  | "Show Up"
  | "Reschedule"
  | "No show"
  | "Cancelled";
};

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedOutletId: number;
  appointmentId: number;
  customerId: number;
  // parent onCreate now receives the final payload
  onCreate: (values: CreateAppointmentPayload) => Promise<AppointmentResponse>;
  intent?: 'edit' | 'create' | 'addToSlot';

}

const EMPTY_SERVICES: ServiceResponse[] = [];
const EMPTY_STAFF: StaffResponse[] = [];

export default function BookingModal({
  isOpen,
  onClose,
  selectedOutletId,
  appointmentId,
  customerId,
  onCreate,
  intent,
}: BookingModalProps) {
  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchemaMulti),
    defaultValues: {
      customerId: customerId !== -1 ? customerId : undefined,
      serviceItems: [],
      staffId: undefined,
      startTime: undefined,
      endTime: undefined,
      paymentMethod: undefined,
      notes: undefined,
      overrideCashPrice: undefined,
    },
  });

  const mode: 'edit' | 'create' | 'addToSlot' =
    intent ??
    (appointmentId !== -1 && customerId !== -1
      ? 'edit'
      : appointmentId !== -1
        ? 'addToSlot'
        : 'create');

  const isEditMode = mode === 'edit';
  const isAddToSameSlot = mode === 'addToSlot';

  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);

  type AppointmentWithPayment = AppointmentResponse & {
    paymentMethod?: "Credits" | "Card" | "Cash" | null;
    cashPaid?: number | null;
  };

  // If edit intention, fetch the target appointment
  const { data: appointment, isLoading: isAppointmentLoading } =
    useQuery<AppointmentWithPayment>({
      queryKey: ["/api/appointments", appointmentId],
      enabled: isEditMode,
      queryFn: () => apiRequest("GET", `/api/appointments/${appointmentId}`),
    });

  const { data: sourceAppt } = useQuery<AppointmentResponse>({
    queryKey: ["/api/appointments", appointmentId],
    enabled: isAddToSameSlot && appointmentId !== -1,  // use computed mode
    queryFn: () => apiRequest("GET", `/api/appointments/${appointmentId}`),
  });

  // Other queries
  const { data: servicesData, isLoading: isServicesLoading } = useQuery<ServiceResponse[]>({
    queryKey: ["/api/services"],
    queryFn: () => apiRequest("GET", "/api/services"),
  });
  const services = servicesData ?? EMPTY_SERVICES;

  const { data: staffData, isLoading: isStaffLoading } = useQuery<StaffResponse[]>({
    queryKey: ["/api/staffs/outlet", selectedOutletId],
    queryFn: () => apiRequest("GET", `/api/staffs/outlet/${selectedOutletId}`),
  });
  const staff = staffData ?? EMPTY_STAFF;


  useEffect(() => {
    if (!isOpen) {
      form.reset({
        customerId: undefined,
        serviceItems: [],
        staffId: undefined,
        startTime: undefined,
        paymentMethod: undefined,
        notes: undefined,
        overrideCashPrice: undefined,
      });
      return;
    }

    if (isEditMode && appointment && services.length) {
      const svc = services.find((s) => s.id === appointment.serviceId);
      form.reset({
        customerId: appointment.customerId,
        serviceItems: [{ serviceId: appointment.serviceId, quantity: 1 }],
        staffId: appointment.staffId,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        paymentMethod: appointment.paymentMethod ?? undefined,
        notes: appointment.notes ?? undefined,
        overrideCashPrice: appointment.cashPaid ?? svc?.cashPrice ?? 0,
      });
      return;
    }

    if (isAddToSameSlot && sourceAppt) {
      form.reset({
        customerId,
        serviceItems: [],
        staffId: sourceAppt.staffId,
        startTime: sourceAppt.startTime,
        endTime: sourceAppt.endTime,
        paymentMethod: undefined,
        notes: undefined,
        overrideCashPrice: undefined,
      });
      return;
    }

    if (!isEditMode && customerId !== -1) {
      form.reset({
        customerId,
        serviceItems: [],
        staffId: undefined,
        startTime: undefined,
        paymentMethod: undefined,
        notes: undefined,
        overrideCashPrice: undefined,
      });
    }
  }, [
    isOpen,
    isEditMode,
    isAddToSameSlot,
    appointment,
    services,
    sourceAppt,
    customerId,
    form,
  ]);

  const isOthersLoading = isServicesLoading || isStaffLoading;

  const isLoading = isEditMode
    ? isAppointmentLoading || isOthersLoading
    : isOthersLoading;

  const showLoading = useMinimumLoadingTime(isLoading);

  const currCustomerId = form.watch("customerId");
  const {
    data: selectedCustomer,
  } = useQuery({
    queryKey: ["customer-one", currCustomerId],
    enabled: !!currCustomerId,
    queryFn: () =>
      apiRequest("GET", `/api/customers/${currCustomerId}`),
  });

  // ---------- helper: build payload shared by create/edit ----------
  const buildAppointmentPayload = (
    data: BookingFormDataMulti,
    serviceId: number
  ): CreateAppointmentPayload => {
    if (!data.customerId) throw new Error("Customer ID is required");

    const paymentMethod = data.paymentMethod;
    const service = services.find((s) => s.id === serviceId);
    if (!service) throw new Error("Service not found");

    const start = DateTime.fromISO(data.startTime, { zone: "Asia/Singapore" });
    if (!start.isValid) throw new Error(`Invalid startTime: ${data.startTime}`);

    let end: DateTime;

    if (isEditMode && data.endTime) {
      const parsedEnd = DateTime.fromISO(data.endTime, { zone: "Asia/Singapore" });
      if (!parsedEnd.isValid) throw new Error(`Invalid endTime: ${data.endTime}`);
      end = parsedEnd;
    } else {
      end = start.plus({ minutes: service.duration });
    }

    if (end <= start) throw new Error("End time must be after start time");

    const startTime = start.toISO({ suppressMilliseconds: true, includeOffset: true });
    const endTime = end.toISO({ suppressMilliseconds: true, includeOffset: true });
    if (!startTime || !endTime) throw new Error("Failed to format start/end time");

    let unitPrice = 0;

    if (paymentMethod === "Credits") {
      unitPrice = 0;
    } else {
      const basePrice = service.cashPrice ?? 0;
      unitPrice =
        typeof data.overrideCashPrice === "number" && Number.isFinite(data.overrideCashPrice)
          ? data.overrideCashPrice
          : basePrice;
    }

    return {
      customerId: data.customerId,
      serviceId,
      staffId: data.staffId,
      outletId: selectedOutletId,

      startTime,
      endTime,

      paymentMethod: data.paymentMethod,
      paymentStatus: "Pending",

      // ✅ single row = single unit
      quantity: 1,
      creditsPaid: 0,
      cashPaid: unitPrice,

      notes: data.notes,
      status: "Booked",
    };
  };


  // Update (single existing appointment)
  const updateAppointmentMutation = useMutation<
    string,
    Error,
    CreateAppointmentPayload
  >({
    mutationFn: async (payload) => {
      const url = `/api/appointments/${appointmentId}`;
      return apiRequest("PUT", url, payload);
    },
    onSuccess: async (serverResponse: string) => {
      const minDelayPromise = new Promise((r) => setTimeout(r, MIN_LOADING));
      const invalidatePromises = Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/appointments"] }),
        queryClient.invalidateQueries({
          queryKey: ["/api/appointments/outlet"],
        }),
        queryClient.invalidateQueries({ queryKey: ["/api/customers"] }),
      ]);
      await Promise.all([minDelayPromise, invalidatePromises]);
      toastManager({
        title: "Booking updated",
        description: serverResponse,
        status: "success",
      });
      onClose();
    },
    onError: (error: Error) => {
      toastManager({
        title: "Booking update failed",
        description: getErrorDescription(error.message),
        status: "failure",
      });
    },
  });

  // create path uses parent onCreate; manage local pending state for UX
  const showPendingUpdate = useMinimumLoadingTime(
    updateAppointmentMutation.isPending
  );
  const [isCreating, setIsCreating] = useState(false);
  const showPendingCreate = useMinimumLoadingTime(isCreating);

  const onSubmit = async (data: BookingFormDataMulti) => {
    if (!data.startTime) {
      toastManager({
        title: "Missing start time",
        description: "Please set a start time.",
        status: "failure",
      });
      return;
    }

    if (!data.customerId) {
      toastManager({
        title: "Missing customer",
        description: "Please select a customer.",
        status: "failure",
      });
      return;
    }


    if (isEditMode) {
      const chosenServiceId = data.serviceItems?.[0]?.serviceId;
      if (!chosenServiceId) {
        toastManager({
          title: "Missing service",
          description: "Please select at least one service to update.",
          status: "failure",
        });
        return;
      }
      const payload = buildAppointmentPayload(data, chosenServiceId);
      updateAppointmentMutation.mutate(payload);
      return;
    }
    try {
      const items = data.serviceItems ?? [];
      if (items.length === 0) {
        toastManager({ title: "No services selected", description: "Please choose at least one service.", status: "failure" });
        return;
      }

      // Build a duration lookup (serviceId -> duration minutes)
      const durationByServiceId = new Map<number, number>();
      for (const s of services) {
        durationByServiceId.set(s.id, Number(s.duration ?? 0));
      }

      // cursor = the start time for the next appointment to be created; initially the form's start time
      let cursor = DateTime.fromISO(data.startTime as string, { zone: "Asia/Singapore" });
      if (!cursor.isValid) {
        toastManager({
          title: "Invalid start time",
          description: "Start time could not be parsed.",
          status: "failure",
        });
        return;
      }

      setIsCreating(true);

      for (const item of items) {
        const qty = item.quantity ?? 1;

        const durMin = durationByServiceId.get(item.serviceId);
        if (!durMin || durMin <= 0) {
          toastManager({
            title: "Missing service duration",
            description: `Service ${item.serviceId} has no valid duration.`,
            status: "failure",
          });
          return;
        }

        for (let i = 0; i < qty; i++) {
          const start = cursor;
          const end = cursor.plus({ minutes: durMin });

          const dataForThisAppt = {
            ...data,
            startTime: start.toISO({ suppressMilliseconds: true }),
            endTime: end.toISO({ suppressMilliseconds: true }),
          };

          const payload = buildAppointmentPayload(dataForThisAppt, item.serviceId);
          await onCreate(payload);

          cursor = end;
        }
      }

      await queryClient.invalidateQueries({ queryKey: ["customer-one", data.customerId] });
      onClose();
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto p-8">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-slate-800">
            {isEditMode ? "Edit Booking" : "New Booking"}
          </DialogTitle>
        </DialogHeader>

        {showLoading ? (
          <LoadingSpinner />
        ) : (
          <>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6 text-base text-slate-800"
              >
                {/* Customer Selection */}
                <CustomerField
                  control={form.control}
                  name="customerId"
                  disabled={customerId !== -1}
                  onClickAdd={() => setIsCustomerModalOpen(true)}
                />

                {/* Services field */}
                <ServiceField
                  control={form.control}
                  name="serviceItems"
                  services={services}
                  isEditMode={isEditMode}
                />
                {/* Time + Staff + Price Section */}
                <div className="space-y-4" id="datepicker-portal">

                  {/* Row 1: Start + End */}
                  <div className={cn("grid gap-4", isEditMode ? "grid-cols-2" : "grid-cols-1")}>
                    <FormField
                      control={form.control}
                      name="startTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-600/93 font-semibold">
                            Start
                          </FormLabel>
                          <FormControl>
                            <DateTimePicker
                              value={field.value}
                              onChange={field.onChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {isEditMode && (
                      <FormField
                        control={form.control}
                        name="endTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-600/93 font-semibold">
                              End
                            </FormLabel>
                            <FormControl>
                              <DateTimePicker
                                value={field.value}
                                onChange={field.onChange}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>

                  {/* Staff + Price (edit mode only) */}
                  <div className={cn("grid gap-4", isEditMode ? "grid-cols-2" : "grid-cols-1")}>

                    {/* Staff */}
                    <FormField
                      control={form.control}
                      name="staffId"
                      render={({ field }) => {
                        const staffValue =
                          typeof field.value === "number" && Number.isFinite(field.value)
                            ? String(field.value)
                            : undefined;

                        return (
                          <FormItem>
                            <FormLabel className="text-slate-600/93 font-semibold">
                              Staff
                            </FormLabel>

                            <FormControl>
                              <Select
                                disabled={isAddToSameSlot}
                                value={staffValue}
                                onValueChange={(v) => field.onChange(parseInt(v, 10))}
                              >
                                <SelectTrigger
                                  className={cn(
                                    "w-full text-base py-5",
                                    staffValue ? "!text-slate-800" : "!text-slate-400",
                                    isAddToSameSlot && "opacity-70 cursor-not-allowed"
                                  )}
                                >
                                  <SelectValue placeholder="Select staff" />
                                </SelectTrigger>

                                <SelectContent className="max-h-48 overflow-y-auto bg-white">
                                  {staff.map((member: StaffResponse) => (
                                    <SelectItem
                                      key={member.id}
                                      value={member.id.toString()}
                                      className="text-base"
                                    >
                                      {member.firstName} {member.lastName}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />

                    {/* Service Price (EDIT MODE ONLY) */}
                    {isEditMode && (
                      <FormField
                        control={form.control}
                        name="overrideCashPrice"
                        render={({ field }) => {
                          const value: number | "" =
                            typeof field.value === "number" && Number.isFinite(field.value)
                              ? field.value
                              : "";
                          const selectedItems = form.getValues("serviceItems") ?? [];
                          const firstServiceId = selectedItems?.[0]?.serviceId;
                          const svc = services.find((s) => s.id === firstServiceId);
                          return (
                            <FormItem>
                              <div className="flex items-center justify-between mb-1">
                                <FormLabel className="text-slate-600/93 font-semibold">
                                  Service Price
                                </FormLabel>

                                <div className="text-sm text-slate-500">
                                  {svc
                                    ? `Default price: $${(svc.cashPrice ?? 0).toFixed(2)}`
                                    : "Select a service"}
                                </div>
                              </div>
                              <FormControl>
                                <input
                                  type="number"
                                  step="0.01"
                                  min={0}
                                  value={value}
                                  onChange={(e) => {
                                    const v = e.currentTarget.value;
                                    if (v === "") {
                                      field.onChange(undefined);
                                    } else {
                                      const n = parseFloat(v);
                                      field.onChange(Number.isFinite(n) ? n : undefined);
                                    }
                                  }}
                                  className="w-full text-base py-2 px-3 rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-300"
                                  placeholder={
                                    svc
                                      ? `Default $${svc.cashPrice?.toFixed?.(2) ?? svc.cashPrice}`
                                      : "Enter price"
                                  }
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          );
                        }}
                      />
                    )}
                  </div>
                </div>
                {/* Payment Method */}
                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-600/93 font-semibold">
                        Payment
                      </FormLabel>
                      <FormControl>
                        <RadioGroup
                          value={field?.value ?? undefined}
                          onValueChange={(
                            newVal: "Credits" | "Card" | "Cash"
                          ) => field.onChange(newVal)}
                          className="grid grid-cols-3 gap-3"
                        >
                          {/* Credits */}
                          <Label
                            htmlFor="Credits"
                            className="flex items-center space-x-2 p-3 border border-input rounded-lg cursor-pointer"
                          >
                            <RadioGroupItem
                              value="Credits"
                              id="Credits"
                              className={radioStyles}
                            />
                            <div className="flex-1">
                              <p className="text-base text-slate-800 -mb-0.5">
                                Credits
                              </p>
                              <p className="text-sm text-slate-600">
                                Balance: {selectedCustomer?.creditBalance ?? 0}
                              </p>
                            </div>
                          </Label>

                          {/* Card */}
                          <Label
                            htmlFor="Card"
                            className="flex items-center space-x-2 p-3 border border-input rounded-lg cursor-pointer"
                          >
                            <RadioGroupItem
                              value="Card"
                              id="Card"
                              className={radioStyles}
                            />
                            <div className="flex-1">
                              <p className="text-base text-slate-800 -mb-0.5">
                                Card
                              </p>
                              <p className="text-sm text-slate-600">Stripe</p>
                            </div>
                          </Label>

                          {/* Cash */}
                          <Label
                            htmlFor="Cash"
                            className="flex items-center space-x-2 p-3 border border-input rounded-lg cursor-pointer"
                          >
                            <RadioGroupItem
                              value="Cash"
                              id="Cash"
                              className={radioStyles}
                            />
                            <div className="flex-1">
                              <p className="text-base text-slate-800 -mb-0.5">
                                Cash
                              </p>
                              <p className="text-sm text-slate-600">
                                In-person
                              </p>
                            </div>
                          </Label>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Notes */}
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-600/93 font-semibold">
                        Notes (Optional)
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Any extra notes"
                          className="resize-none !text-base !text-slate-800 placeholder:text-base placeholder:text-slate-400"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Action Buttons */}
                <div className="flex justify-end space-x-3 pt-3">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={onClose}
                    className="text-base hover:bg-slate-200"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-beauty-purple hover:bg-beauty-purple-light text-base"
                    disabled={showPendingCreate || showPendingUpdate}
                  >
                    {showPendingCreate || showPendingUpdate
                      ? "Saving..."
                      : "Save"}
                  </Button>
                </div>
              </form>
            </Form>
            <CustomerModal
              isOpen={isCustomerModalOpen}
              onClose={() => setIsCustomerModalOpen(false)}
              customerId={customerId}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
