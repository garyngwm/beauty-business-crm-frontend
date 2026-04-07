import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/dialog";
import { Button } from "~/button";
import { Card, CardContent } from "~/card";
import {
  Calendar,
  Clock,
  UserRound,
  BookOpen,
  Mail,
  Phone,
  ChevronDown,
  MoreVertical,
  ExternalLink,
  Pencil,
  Trash2,
  Plus,
  Users,
} from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";
import {
  cn,
  formatDateToStandardLabel,
  formatDateToTime,
} from "@/lib/utils/date-processing";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "~/dropdown-menu";
import { useMinimumLoadingTime } from "@/hooks/use-min-loading";
import LoadingSpinner from "@/components/shared/loading-spinner";
import NotesView from "./notes";
import RecentBookings from "./recent-bookings";
import { toastManager } from "@/components/shared/toast-manager";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { MIN_LOADING } from "@/lib/constants";

import {
  type AppointmentStatus,
  type AppointmentResponse,
  type AppointmentWithDetails,
} from "@/lib/types/appointment/appointment";

import { type CustomerResponse } from "@/lib/types/customer";
import {
  type ServiceResponse,
} from "@/lib/types/service/service";

import {
  type StaffResponse,
  type StaffWithLocationsResponse,
} from "@/lib/types/staff/staff";
import { apiRequest } from "@/lib/query-client";
import { getErrorDescription } from "@/lib/utils/misc";
import { useLocation } from "wouter";
import { DateTimePicker } from "@/components/shared/date-time-picker";
import { DateTime } from "luxon";

const bubbleBtn =
  "group/bubble inline-grid place-items-center w-6 h-6 rounded-full " +
  "border border-black text-black transition-colors duration-200 " +
  "hover:bg-black hover:text-white";
const countCls =
  "col-start-1 row-start-1 text-[11px] font-medium " +
  "motion-safe:transition-opacity motion-safe:transition-transform " +
  "motion-safe:duration-200 motion-safe:ease-out " +
  "group-hover/bubble:opacity-0 group-hover/bubble:scale-75";
const plusCls =
  "col-start-1 row-start-1 w-3.5 h-3.5 opacity-0 scale-75 rotate-0 " +
  "motion-safe:transition-opacity motion-safe:transition-transform " +
  "motion-safe:duration-200 motion-safe:ease-out " +
  "group-hover/bubble:opacity-100 group-hover/bubble:scale-100 group-hover/bubble:rotate-90";

type ApptWithDetails = AppointmentResponse & {
  service?: ServiceResponse | null;
  staffMember?: StaffResponse | null;
};

const getSameHourAppointments = (
  rep: AppointmentResponse,
  allAppointments: AppointmentResponse[],
  services: ServiceResponse[],
  staff: StaffResponse[]
): ApptWithDetails[] => {
  const source = allAppointments.some((a) => a.id === rep.id)
    ? allAppointments
    : [...allAppointments, rep];

  const repHourStart = DateTime.fromISO(rep.startTime).startOf("hour");
  const windowStart = repHourStart;
  const windowEnd = repHourStart.plus({ hours: 1 });

  const inSameHourSameStaff = source.filter((a) => {
    if (a.customerId !== rep.customerId) return false;
    if (a.staffId !== rep.staffId) return false;
    const aStart = DateTime.fromISO(a.startTime);
    const aEnd = DateTime.fromISO(a.endTime);
    return aStart < windowEnd && aEnd > windowStart;
  });

  return inSameHourSameStaff.map((a) => ({
    ...a,
    service: services.find((s) => s.id === a.serviceId) ?? null,
    staffMember: staff.find((st) => st.id === a.staffId) ?? null,
  }));
};

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId: number;
  appointmentId: number;
  setCustomerId: React.Dispatch<React.SetStateAction<number>>;
  setAppointmentId: React.Dispatch<React.SetStateAction<number>>;
  setIsBookingModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setBookingIntent: React.Dispatch<React.SetStateAction<'edit' | 'create' | 'addToSlot'>>;
}

const statusColorMap: Record<AppointmentStatus, string> = {
  Booked: "bg-green-600",
  Confirmed: "bg-green-600",
  "Show Up": "bg-gray-600",
  Reschedule: "bg-yellow-500",
  "No show": "bg-red-500",
  Cancelled: "bg-red-500",
};

// Between shadow-sm and shadow-md
const OTHERS_SHADOW =
  "shadow-[0_2px_3px_rgba(0,0,0,0.08),_0_1px_1px_rgba(0,0,0,0.04)]";

const getMembershipStatus = (customer: CustomerResponse | undefined) => {
  if (!customer) return;

  if (customer.membershipStatus === "Active") {
    return (
      <div className="bg-green-50 shadow-md rounded-lg p-4">
        <h4 className="text-lg font-semibold text-green-700 mb-2">Member</h4>
        <p className="text-2xl font-bold text-green-700 mb-1.5">Active</p>
        <p className="text-base text-gray-600 mb-1">Billing: Next month</p>
      </div>
    );
  } else {
    return (
      <div className="bg-green-50 shadow-md rounded-lg p-4">
        <h4 className="text-lg font-semibold text-green-700 mb-2">Member</h4>
        <p className="text-2xl font-bold text-slate-500 mb-1.5">Inactive</p>
        <p className="text-sm text-gray-600 mb-1">Pay per service</p>
      </div>
    );
  }
};

export default function AppointmentModal({
  isOpen,
  onClose,
  customerId,
  appointmentId,
  setCustomerId,
  setAppointmentId,
  setIsBookingModalOpen,
  setBookingIntent
}: AppointmentModalProps) {
  const [, navigate] = useLocation();
  const [showNotes, setShowNotes] = useState(false);
  const [showRecentBookings, setShowRecentBookings] = useState(false);

  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [rescheduleDateTime, setRescheduleDateTime] = useState<string | undefined>(undefined);
  const [isChangeStaffOpen, setIsChangeStaffOpen] = useState(false);
  const [newStaffId, setNewStaffId] = useState<number | null>(null);
  // For nested modals to take reference to
  const modalContentRef = useRef<HTMLDivElement>(null);
  const [modalHeight, setModalHeight] = useState<number | null>(null);

  // All customer appointments
  const { data: appointments = [], refetch: refetchAppointments } = useQuery<
    AppointmentResponse[]
  >({
    queryKey: ["/api/customers", customerId, "appointments"],
    queryFn: () =>
      apiRequest("GET", `/api/customers/${customerId}/appointments`),
  });

  // All staff
  const { data: staff = [], isLoading: isStaffLoading } = useQuery<
    StaffResponse[]
  >({
    queryKey: ["/api/staffs"],
    queryFn: () => apiRequest("GET", "/api/staffs"),
  });

  // All services
  const { data: services = [], isLoading: isServicesLoading } = useQuery<
    ServiceResponse[]
  >({
    queryKey: ["/api/services"],
    queryFn: () => apiRequest("GET", "/api/services"),
  });

  // This appointment
  const { data: thisAppointment, isLoading: isThisAppointmentLoading } =
    useQuery<AppointmentResponse>({
      queryKey: ["/api/appointments", appointmentId],
      queryFn: () => apiRequest("GET", `/api/appointments/${appointmentId}`),
    });

  // This customer
  const { data: thisCustomer, isLoading: isThisCustomerLoading } =
    useQuery<CustomerResponse>({
      queryKey: ["/api/customers", customerId],
      enabled: isOpen && customerId !== -1,
      queryFn: () => apiRequest("GET", `/api/customers/${customerId}`),
      staleTime: 0,
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
    });

  // Specific staff for this appointment
  const { data: apptStaff, isLoading: isApptStaffLoading } =
    useQuery<StaffWithLocationsResponse>({
      queryKey: ["/api/staffs", thisAppointment?.staffId],
      queryFn: () =>
        apiRequest("GET", `/api/staffs/${thisAppointment?.staffId}`),

      enabled: !!thisAppointment?.staffId,
    });

  // Specific preferred staff for this customer
  const { data: preferredStaff, isLoading: isPreferredStaffLoading } =
    useQuery<StaffWithLocationsResponse>({
      queryKey: ["/api/staffs", thisCustomer?.preferredTherapistId],
      queryFn: () =>
        apiRequest("GET", `/api/staffs/${thisCustomer?.preferredTherapistId}`),

      enabled: !!thisCustomer?.preferredTherapistId,
    });

  const isLoading =
    isStaffLoading ||
    isServicesLoading ||
    isThisAppointmentLoading ||
    isThisCustomerLoading ||
    isApptStaffLoading ||
    isPreferredStaffLoading;

  const showLoading = useMinimumLoadingTime(isLoading);

  // Handle delete appointment
  const queryClient = useQueryClient();
  const deleteAppointmentMutation = useMutation({
    mutationFn: (appointmentId: number) => {
      return apiRequest("DELETE", `/api/appointments/${appointmentId}`);
    },
    onSuccess: async (serverResponse: string) => {
      const minDelayPromise = new Promise((resolve) =>
        setTimeout(resolve, MIN_LOADING)
      );

      const invalidatePromises = Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["/api/appointments/outlet"],
        }),
        queryClient.invalidateQueries({ queryKey: ["/api/customers"] }),
      ]);

      await Promise.all([minDelayPromise, invalidatePromises]);

      toastManager({
        title: "Booking delete success",
        description: serverResponse,
        status: "success",
      });

      onClose();
    },

    onError: (error: Error) => {
      const description = getErrorDescription(error.message);

      toastManager({
        title: "Appointment delete failed",
        description: description,
        status: "failure",
      });
    },
  });

  const rescheduleSlotMutation = useMutation<
    string,
    Error,
    { appointmentIds: number[]; newStartTime: string }
  >({
    mutationFn: async ({ appointmentIds, newStartTime }) => {
      return apiRequest("POST", "/api/appointments/reschedule-slot", {
        appointmentIds,
        newStartTime,
      });
    },

    onSuccess: async (serverResponse: string) => {
      const minDelayPromise = new Promise((resolve) =>
        setTimeout(resolve, MIN_LOADING)
      );

      const invalidatePromises = Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/appointments"] }),
        queryClient.invalidateQueries({
          queryKey: ["/api/appointments/outlet"],
        }),
        queryClient.invalidateQueries({ queryKey: ["/api/customers"] }),
      ]);

      await Promise.all([minDelayPromise, invalidatePromises, refetchAppointments()]);

      toastManager({
        title: "Reschedule success",
        description: serverResponse,
        status: "success",
      });

      setIsRescheduleOpen(false);

      onClose();
    },
    onError: (error: Error) => {
      toastManager({
        title: "Reschedule failed",
        description: getErrorDescription(error.message),
        status: "failure",
      });
    },
  });

  // Handle update appointment status
  const updateAppointmentStatusMutation = useMutation({
    mutationFn: ({
      appointmentId,
      status,
    }: {
      appointmentId: number;
      status: AppointmentStatus;
    }) => {
      return apiRequest(
        "PUT",
        `/api/appointments/status/${appointmentId}?status=${status}`
      );
    },
    onSuccess: async (serverResponse: string) => {
      const minDelayPromise = new Promise((resolve) =>
        setTimeout(resolve, MIN_LOADING)
      );

      const invalidatePromises = Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["/api/appointments"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["/api/appointments/outlet"],
        }),
        queryClient.invalidateQueries({ queryKey: ["/api/customers"] }),
      ]);

      await Promise.all([minDelayPromise, invalidatePromises]);

      toastManager({
        title: "Status update success",
        description: serverResponse,
        status: "success",
      });
    },

    onError: (error: Error) => {
      const description = getErrorDescription(error.message);

      toastManager({
        title: "Status update failed",
        description: description,
        status: "failure",
      });
    },
  });

  const changeStaffSlotMutation = useMutation<
    string,
    Error,
    { appointmentIds: number[]; staffId: number }
  >({
    mutationFn: async ({ appointmentIds, staffId }) => {
      return apiRequest("PUT", "/api/appointments/change-staff-slot", {
        appointmentIds,
        newStaffId: staffId,
      });
    },

    onSuccess: async (serverResponse: string) => {
      const minDelayPromise = new Promise((resolve) =>
        setTimeout(resolve, MIN_LOADING)
      );

      const invalidatePromises = Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/appointments"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/appointments/outlet"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/customers"] }),
        queryClient.invalidateQueries({
          queryKey: ["/api/customers", customerId, "appointments"],
        }),
      ]);

      await Promise.all([minDelayPromise, invalidatePromises, refetchAppointments()]);

      toastManager({
        title: "Staff updated",
        description: serverResponse,
        status: "success",
      });

      setIsChangeStaffOpen(false);
    },

    onError: (error: Error) => {
      toastManager({
        title: "Change staff failed",
        description: getErrorDescription(error.message),
        status: "failure",
      });
    },
  });

  const handleConfirmReschedule = () => {
    if (!rescheduleDateTime || slotApptIds.length === 0) return;

    rescheduleSlotMutation.mutate({
      appointmentIds: slotApptIds,
      newStartTime: rescheduleDateTime,
    });
  };

  const handleStatusChange = (newStatus: AppointmentStatus) => {
    if (!thisAppointment) return;

    if (newStatus === "Cancelled") {
      const ok = window.confirm("Cancel this appointment? Credits will be refunded if it was paid by credits.");
      if (!ok) return;
    }

    const toUpdate =
      slotAppointments.length > 0 ? slotAppointments : [thisAppointment];
    toUpdate.forEach((appt) => {
      updateAppointmentStatusMutation.mutate({
        appointmentId: appt.id,
        status: newStatus,
      });
    });
  };

  const isShowUp = thisAppointment?.status === "Show Up";

  // [NOTE]: appointmentsWithDetails: All customer appointments with related staff and service data
  // [NOTE]: appointment argument: This specific appointment
  const appointmentsWithDetails: AppointmentWithDetails[] = appointments.map(
    (appointment) => ({
      ...appointment,
      staffMember: staff.find((s) => s.id === appointment.staffId) ?? null,
      service: services.find((s) => s.id === appointment.serviceId) ?? null,
    })
  );

  const handleConfirmChangeStaff = () => {
    if (!newStaffId) return;
    if (slotApptIds.length === 0) return;

    const ok = window.confirm(
      `Change staff for ${slotApptIds.length} appointment(s) in this slot?`
    );
    if (!ok) return;

    changeStaffSlotMutation.mutate({
      appointmentIds: slotApptIds,
      staffId: newStaffId,
    });
  };

  const onAddService = (e?: React.MouseEvent) => {
    e?.stopPropagation?.();
    if (!thisAppointment) return;
    setCustomerId(customerId);
    setAppointmentId(thisAppointment.id);
    setBookingIntent('addToSlot');
    onClose();
    setIsBookingModalOpen(true);
  };

  const onNewAppointment = () => {
    setCustomerId(customerId);
    setAppointmentId(-1);
    setBookingIntent('create');
    onClose();
    setIsBookingModalOpen(true);
  };

  const onEditAppointment = () => {
    setCustomerId(customerId);
    setAppointmentId(appointmentId);
    setBookingIntent('edit');
    onClose();
    setIsBookingModalOpen(true);
  };

  const onEditFromSlot = (apptId: number, custId: number) => {
    setCustomerId(custId);
    setAppointmentId(apptId);
    setBookingIntent('edit');
    onClose();
    setIsBookingModalOpen(true);
  };

  const onDeleteFromSlot = (apptId: number) => {
    if (window.confirm("Are you sure you want to delete this appointment?")) {
      deleteAppointmentMutation.mutate(apptId, {
        onSuccess: () => {
          setTimeout(() => {
            onClose();
          }, 50);
        },
      });
    }
  };

  // Compute all services in the same slot as 'thisAppointment'
  const slotAppointments: AppointmentWithDetails[] = useMemo(() => {
    if (!thisAppointment) return [];
    return getSameHourAppointments(
      thisAppointment,
      appointments,
      services,
      staff
    );
  }, [thisAppointment, appointments, services, staff]);

  const payableSlotAppointments = useMemo(
    () =>
      slotAppointments.filter(
        (a) => (a as any).paymentMethod !== "Credits"
      ),
    [slotAppointments]
  );

  const payableSlotApptIds = payableSlotAppointments.map((a) => a.id);

  const allSlotPaidWithCredits =
    slotAppointments.length > 0 && payableSlotAppointments.length === 0;

  const slotTotalCash = slotAppointments.reduce(
    (sum, a) => sum + (((a as any).cashPaid ?? a.service?.cashPrice ?? 0)),
    0
  );

  const slotTotalCredits = slotAppointments.reduce(
    (sum, a) => sum + (a.service?.creditCost ?? 0),
    0
  );

  const slotApptIds = slotAppointments.map((a) => a.id);

  // Track this modal's height
  useEffect(() => {
    if (isOpen && modalContentRef.current) {
      // Update height function
      const updateHeight = () => {
        const height = modalContentRef.current?.offsetHeight;
        if (height) {
          setModalHeight((_prev) => height);
        }
      };

      // Initial update
      updateHeight();

      // Use ResizeObserver for dynamic content changes
      const resizeObserver = new ResizeObserver(updateHeight);
      resizeObserver.observe(modalContentRef.current);

      return () => {
        resizeObserver.disconnect();
      };
    }
  }, [isOpen, showLoading]);

  useEffect(() => {
    if (isOpen) refetchAppointments();
  }, [isOpen, refetchAppointments]);

  useEffect(() => {
    if (isRescheduleOpen && thisAppointment?.startTime) {
      const raw = thisAppointment.startTime;

      let dt = DateTime.fromISO(raw, { zone: "Asia/Singapore" });

      if (!dt.isValid) {
        const js = new Date(raw);
        if (!Number.isNaN(js.getTime())) {
          dt = DateTime.fromJSDate(js, { zone: "Asia/Singapore" });
        } else {
          console.error("Unable to parse startTime for reschedule:", raw);
          return;
        }
      }

      setRescheduleDateTime(
        dt.toISO({ suppressMilliseconds: true }) as string
      );
    }
  }, [isRescheduleOpen, thisAppointment]);

  useEffect(() => {
    if (isChangeStaffOpen && thisAppointment?.staffId) {
      setNewStaffId(thisAppointment.staffId);
    }
  }, [isChangeStaffOpen, thisAppointment?.staffId]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-w-5xl max-h-[85vh] overflow-auto p-8 bg-slate-200 !border-none"
        ref={modalContentRef}
      >
        <VisuallyHidden.Root>
          <DialogTitle>Fucking accessibility</DialogTitle>
        </VisuallyHidden.Root>

        {showLoading || !thisCustomer || !thisAppointment ? (
          <LoadingSpinner />
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center">
                <div className="w-14 h-14 bg-beauty-purple rounded-full flex items-center justify-center mr-4">
                  <span className="text-xl text-white">
                    {thisCustomer.firstName[0]}
                    {thisCustomer.lastName[0]}
                  </span>
                </div>

                <div>
                  <div className="flex">
                    <div className="flex items-center">
                      <DialogTitle className="text-xl">
                        {thisCustomer.firstName} {thisCustomer.lastName}
                      </DialogTitle>
                      <ExternalLink
                        className="w-8 h-8 text-grey-600 cursor-pointer ml-1 p-2 hover:bg-gray-300 rounded-lg"
                        onClick={() => console.log("To customer profile")}
                      />
                    </div>
                    <div className="absolute top-3 right-10 z-10 flex items-center gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className={cn(
                              "flex items-center gap-2 px-4 py-1.5 text-white text-base rounded-full font-medium transition",
                              statusColorMap[thisAppointment.status],
                              "border-1 border-white"
                            )}
                          >
                            {thisAppointment?.status}
                            <ChevronDown className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent
                          align="start"
                          sideOffset={8}
                          className="shadow-[0px_0.5px_8px_rgba(0,0,0,0.20)]"
                          onCloseAutoFocus={(e) => e.preventDefault()}
                        >
                          <DropdownMenuItem
                            onClick={() => handleStatusChange("Booked")}
                            className="text-base text-slate-800 hover:!bg-gray-200"
                          >
                            Booked
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={() => handleStatusChange("Confirmed")}
                            className="text-base text-slate-800 hover:!bg-gray-200"
                          >
                            Confirmed
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={() => handleStatusChange("Show Up")}
                            className="text-base text-slate-800 hover:!bg-gray-200"
                          >
                            Show-Up
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={() => handleStatusChange("Reschedule")}
                            className="text-base text-slate-800 hover:!bg-gray-200"
                          >
                            Reschedule
                          </DropdownMenuItem>

                          <DropdownMenuSeparator className="my-2 bg-slate-500 w-[90%] mx-auto" />
                          <DropdownMenuItem
                            onClick={() => handleStatusChange("No show")}
                            className="text-base text-red-600 hover:!bg-gray-200 hover:!text-red-600"
                          >
                            No-Show
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleStatusChange("Cancelled")}
                            className="text-base text-red-600 hover:!bg-gray-200 hover:!text-red-600"
                          >
                            Cancelled
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-10 h-10 p-0 border-0 flex items-center justify-center shadow-sm hover:bg-gray-300"
                          >
                            <MoreVertical className="!w-5 !h-5 text-gray-600" />
                          </Button>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent
                          align="start"
                          sideOffset={8}
                          className="shadow-[0px_0.5px_8px_rgba(0,0,0,0.20)]"
                          onCloseAutoFocus={(e) => e.preventDefault()}
                        >
                          <DropdownMenuItem
                            onClick={onNewAppointment}
                            className="text-base text-slate-800 hover:!bg-gray-200"
                          >
                            New
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={onEditAppointment}
                            className="text-base text-slate-800 hover:!bg-gray-200"
                          >
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setIsRescheduleOpen(true)}
                            className="text-base text-slate-800 hover:!bg-gray-200"
                          >
                            Reschedule
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              if (
                                window.confirm(
                                  "Are you sure you want to delete this appointment?"
                                )
                              ) {
                                deleteAppointmentMutation.mutate(appointmentId, {
                                  onSuccess: () => {
                                    setTimeout(() => {
                                      onClose(); // Defer so UI unmounts cleanly
                                    }, 50);
                                  },
                                });
                              }
                            }}
                            className="text-base text-red-600 hover:!bg-gray-200 hover:!text-red-600"
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <p className="text-base text-gray-600">
                    {thisCustomer.membershipStatus === "Active"
                      ? "Premium Member"
                      : "Regular Customer"}{" "}
                    since {formatDateToStandardLabel(thisCustomer.createdAt)}
                  </p>
                </div>
              </div>
            </DialogHeader>
            <div className={cn(isShowUp && "grayscale opacity-60")}>
              <div className="grid grid-cols-3 mt-3">
                <div className="col-span-2 mr-12">
                  <div className="bg-white shadow-md rounded-lg p-6">
                    {/* Booking Details */}
                    <div className="mb-7">
                      <h4 className="text-lg font-semibold text-gray-800 mb-2">
                        Booking Details
                      </h4>

                      <div className="grid grid-cols-2 gap-x-5 gap-y-3.5 pl-3">
                        <div className="flex items-center">
                          <Calendar className="w-5 h-5 mr-3 text-slate-600" />
                          {thisAppointment?.startTime && (
                            <p className="text-base text-gray-800">
                              {formatDateToStandardLabel(
                                thisAppointment.startTime
                              )}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center">
                          <Clock className="w-5 h-5 mr-3 text-slate-600" />
                          <p className="text-base text-gray-800">
                            {formatDateToTime(thisAppointment?.startTime)} -{" "}
                            {formatDateToTime(thisAppointment?.endTime)}
                          </p>
                        </div>

                        <div className="flex items-center">
                          <UserRound className="w-5 h-5 mr-3 text-slate-600" />
                          <p className="text-base text-gray-700">
                            {apptStaff?.firstName} {apptStaff?.lastName}
                          </p>

                          <Button
                            type="button"
                            variant="outline"
                            className="ml-3 h-9 px-3 text-sm border-gray-200 hover:bg-gray-100"
                            onClick={() => setIsChangeStaffOpen(true)}
                            disabled={slotApptIds.length === 0}
                            title="Change staff for all appointments in this slot"
                          >
                            <Users className="w-4 h-4 ml-2" />
                            Change Staff
                          </Button>
                        </div>

                        <div className="col-span-2">
                          <div className="flex items-center mb-2">
                            <BookOpen className="w-5 h-5 mr-3 text-slate-600" />
                            <h5 className="text-base font-semibold text-gray-800">
                              Services in this slot
                            </h5>
                            <div className="ml-2">
                              <button
                                type="button"
                                onClick={(e) => onAddService(e)}
                                title="Add a service to this time slot"
                                className={`${bubbleBtn} ml-0`} // you can keep ml-2 on wrapper or add here
                              >
                                <span className={countCls}>
                                  {slotAppointments.length}
                                </span>
                                <Plus className={plusCls} aria-hidden="true" />
                                <span className="sr-only">Add service</span>
                              </button>
                            </div>
                            <div className="mt-3 flex items-center justify-end text-sm text-slate-700 ml-auto">
                              <span className="rounded-full px-2 py-0.5 bg-slate-100 mr-2">
                                Total cash: ${slotTotalCash.toFixed(2)}
                              </span>
                              <span className="rounded-full px-2 py-0.5 bg-slate-100">
                                Total credits: {slotTotalCredits}
                              </span>
                            </div>
                          </div>
                          <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 overflow-hidden">
                            {slotAppointments.map((a) => (
                              <li
                                key={a.id}
                                className="group flex items-start justify-between gap-3 p-3 bg-white hover:bg-gray-50 transition-colors"
                              >
                                <div>
                                  <p className="font-medium text-gray-900">
                                    {a.service?.name ?? "Unknown Service"}
                                  </p>
                                  <p className="text-sm text-gray-600">
                                    {a.staffMember
                                      ? `${a.staffMember.firstName} ${a.staffMember.lastName}`
                                      : "Unknown staff"}
                                    {a.service?.duration
                                      ? ` • ${a.service.duration} min`
                                      : ""}
                                  </p>
                                </div>

                                <div className="flex items-center gap-2">
                                  {(((a as any).cashPaid ?? a.service?.cashPrice) != null) && (
                                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-700">
                                      ${(((a as any).cashPaid ?? a.service?.cashPrice) as number).toFixed(2)}
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onEditFromSlot(a.id, a.customerId);
                                    }}
                                    className="hidden group-hover:inline-flex items-center rounded-md px-2.5 py-1 text-sm font-medium
                     border border-gray-200 hover:bg-gray-100 text-gray-700 transition"
                                    aria-label={`Edit ${a.service?.name ?? "appointment"}`}
                                    title="Edit"
                                  >
                                    <Pencil className="w-4 h-4 mr-1" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDeleteFromSlot(a.id);
                                    }}
                                    className="hidden group-hover:inline-flex items-center rounded-md px-2.5 py-1 text-sm font-medium
                       border border-gray-200 hover:bg-red-50 text-red-600"
                                    aria-label={`Delete ${a.service?.name ?? "appointment"}`}
                                    title="Delete"
                                  >
                                    <Trash2 className="w-4 h-4 mr-1" />
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* Contact */}
                    <div className="mb-5">
                      <h4 className="text-lg font-semibold text-gray-800 mb-2">
                        Contact
                      </h4>
                      <div className="grid grid-cols-2 gap-5 pl-3">
                        <div className="flex items-center">
                          <Mail className="w-5 h-5 mr-3 text-slate-600" />
                          <p className="text-base text-gray-700">
                            {thisCustomer?.email}
                          </p>
                        </div>
                        <div className="flex items-center">
                          <Phone className="w-5 h-5 mr-3 text-slate-600" />
                          <p className="text-base text-gray-700">
                            {thisCustomer?.phone || "Not provided"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <Card className="bg-[#F7F0FF] mb-6 shadow-md">
                    <CardContent className="p-4">
                      <h4 className="text-lg font-semibold beauty-purple mb-2">
                        Credits
                      </h4>
                      <p className="text-3xl font-bold beauty-purple">
                        {thisCustomer.creditBalance}
                      </p>
                      <p className="text-base text-gray-600 mt-1">
                        Available credits
                      </p>
                    </CardContent>
                  </Card>

                  {/* Membership Details */}
                  <div className="mb-6">
                    {getMembershipStatus(thisCustomer)}
                  </div>

                  <div>
                    <h4 className="text-lg font-semibold text-gray-800 mb-2">
                      Others
                    </h4>

                    <Button
                      onClick={() => modalHeight && setShowNotes(true)}
                      variant="outline"
                      className={`w-full border-0 text-black text-base mb-3 hover:bg-gray-300 ${OTHERS_SHADOW}`}
                    >
                      Notes
                    </Button>

                    {modalHeight && (
                      <NotesView
                        showNotes={showNotes}
                        setShowNotes={setShowNotes}
                        thisAppointment={thisAppointment}
                        thisCustomer={thisCustomer}
                        preferredStaff={preferredStaff}
                        parentHeight={modalHeight}
                      />
                    )}

                    <Button
                      onClick={() => modalHeight && setShowRecentBookings(true)}
                      variant="outline"
                      className={`w-full border-0 text-black text-base hover:bg-gray-300 ${OTHERS_SHADOW}`}
                    >
                      Recent Bookings
                    </Button>

                    {modalHeight && (
                      <RecentBookings
                        showRecentBookings={showRecentBookings}
                        setShowRecentBookings={setShowRecentBookings}
                        appointmentsWithDetails={appointmentsWithDetails}
                        parentHeight={modalHeight}
                      />
                    )}
                  </div>

                  {/* Payment Row */}
                  <div className="flex items-center justify-between gap-2 mt-3">
                    {!allSlotPaidWithCredits && (
                      <Button
                        className="flex-1 h-11 bg-beauty-purple hover:bg-beauty-purple-light text-white text-lg"
                        onClick={() => {
                          if (payableSlotApptIds.length === 1) {
                            const onlyAppt = payableSlotAppointments[0];
                            navigate(
                              `/checkout?serviceId=${onlyAppt.service?.id}&appointmentId=${onlyAppt.id}`
                            );
                            return;
                          }

                          const ids = payableSlotApptIds.join(",");
                          navigate(`/checkout?appointmentIds=${ids}`);
                        }}
                      >
                        Checkout
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
        {isRescheduleOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-5">
              <h3 className="text-lg font-semibold mb-2">
                Reschedule appointment slot
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Choose a new date & time for this slot. All{" "}
                <span className="font-semibold">{slotAppointments.length}</span>{" "}
                services in this slot will be shifted.
              </p>

              <div className="mb-4">
                <DateTimePicker
                  value={rescheduleDateTime}
                  onChange={(iso) => setRescheduleDateTime(iso)}
                />
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsRescheduleOpen(false)}
                  disabled={rescheduleSlotMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-beauty-purple hover:bg-beauty-purple-light text-white"
                  onClick={handleConfirmReschedule}
                  disabled={!rescheduleDateTime || rescheduleSlotMutation.isPending}
                >
                  {rescheduleSlotMutation.isPending ? "Rescheduling..." : "Confirm"}
                </Button>
              </div>
            </div>
          </div>
        )}
        {isChangeStaffOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-5">
              <h3 className="text-lg font-semibold mb-2">Change staff for this slot</h3>

              <p className="text-sm text-gray-600 mb-4">
                This will update all{" "}
                <span className="font-semibold">{slotAppointments.length}</span>{" "}
                services in this slot.
              </p>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select staff
                </label>

                <select
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  value={newStaffId ?? ""}
                  onChange={(e) => setNewStaffId(Number(e.target.value))}
                  disabled={changeStaffSlotMutation.isPending}
                >
                  <option value="" disabled>
                    Select staff...
                  </option>

                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.firstName} {s.lastName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsChangeStaffOpen(false)}
                  disabled={changeStaffSlotMutation.isPending}
                >
                  Cancel
                </Button>

                <Button
                  className="bg-beauty-purple hover:bg-beauty-purple-light text-white"
                  onClick={handleConfirmChangeStaff}
                  disabled={!newStaffId || changeStaffSlotMutation.isPending}
                >
                  {changeStaffSlotMutation.isPending ? "Updating..." : "Confirm"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
