import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { MIN_LOADING } from "@/lib/constants";
import { getErrorDescription } from "@/lib/utils/misc";
import { toastManager } from "@/components/shared/toast-manager";
import Sidebar from "@/components/shared/sidebar";
import CalendarView from "@/components/calendar/main/day-view";
import { DaySummary } from "@/components/calendar/main/day-summary";
import BookingModal from "@/components/calendar/appointments/booking-modal";
import AppointmentModal from "@/components/calendar/appointments/appointment-view";
import {
  type BookingFormData,
  type AppointmentResponse,
} from "@/lib/types/appointment/appointment";
import { Button } from "~/button";
import { Plus, ClipboardCheck, ChevronDown } from "lucide-react";
import { getSingaporeDateString } from "@/lib/utils/date-processing";
import { cn } from "@/lib/utils/date-processing";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "~/dropdown-menu";
import { getOutletShortName } from "@/lib/utils/misc";
import { DateTime } from "luxon";

import { type OutletResponse } from "@/lib/types/outlet/outlet";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/query-client";
import MembershipModal from "@/components/calendar/memberships/membership-modal";
import { supabase } from "../lib/supabase";

export default function Dashboard() {
  const OUTLET_KEY = "dashboard:selectedOutletId:v1";

  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(getSingaporeDateString());
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isMembershipModalOpen, setIsMembershipModalOpen] = useState(false);
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [isDaySummaryOpen, setIsDaySummaryOpen] = useState(false);
  const [isOutletToggleOpen, setIsOutletToggleOpen] = useState(false);
  const [selectedOutletId, setSelectedOutletId] = useState<number>(() => {
    if (typeof window === "undefined") return 1; // SSR fallback
    const raw = localStorage.getItem(OUTLET_KEY);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : 1;
  });
  const otherOutletId = selectedOutletId === 1 ? 2 : 1;
  const [bookingIntent, setBookingIntent] = useState<'edit' | 'create' | 'addToSlot'>('create');

  // For booking modal
  const [appointmentId, setAppointmentId] = useState(-1);
  const [customerId, setCustomerId] = useState(-1);

  // For appointment modal
  const [selectedCustomerId, setSelectedCustomerId] = useState(-1);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState(-1);

  const { data: outlets = [] } = useQuery<OutletResponse[]>({
    queryKey: ["/api/outlets"],
    queryFn: () => apiRequest("GET", "/api/outlets"),
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };


  const handleViewAppointment: (
    customerId: number,
    appointmentId: number
  ) => void = (customerId, appointmentId) => {
    setSelectedCustomerId(customerId);
    setSelectedAppointmentId(appointmentId);
    setIsAppointmentModalOpen(true);
  };

  const handleNewBooking = () => {
    setBookingIntent('create');
    setCustomerId(-1);
    setAppointmentId(-1);
    setIsBookingModalOpen(true);
  };

  const handlePurchaseMembership = () => {
    setIsMembershipModalOpen(true);
  };

  const createAppointment = useMutation<
    AppointmentResponse,
    Error,
    BookingFormData
  >({
    mutationFn: (payload) => apiRequest("POST", "/api/appointments", payload),
    onSuccess: async () => {
      const minDelayPromise = new Promise((r) => setTimeout(r, MIN_LOADING));

      const invalidatePromises = Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/appointments"] }),
        queryClient.invalidateQueries({
          queryKey: [
            "/api/appointments/outlet",
            selectedOutletId,
            selectedDate,
          ],
        }),
        queryClient.invalidateQueries({
          queryKey: ["/api/appointments/outlet", otherOutletId, selectedDate],
        }),
        queryClient.invalidateQueries({
          queryKey: ["/api/customers/with-appointments", selectedDate],
        }),
      ]);

      await Promise.all([minDelayPromise, invalidatePromises]);

      toastManager({
        title: "Booking created",
        description: "Booking created successfully",
        status: "success",
      });
    },

    onError: (error: Error) => {
      toastManager({
        title: "Booking create failed",
        description: getErrorDescription(error.message),
        status: "failure",
      });
    },
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(OUTLET_KEY, String(selectedOutletId)); // write to local storage when outlet is changed
  }, [selectedOutletId]);

  // 3) (Optional) If outlets load and the stored id isn’t valid anymore, fall back gracefully
  useEffect(() => {
    if (!outlets?.length) return;
    if (!outlets.some((o) => o.id === selectedOutletId)) {
      setSelectedOutletId(outlets[0].id);
    }
  }, [outlets, selectedOutletId]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <h2 className="text-2xl font-semibold text-gray-800">
                {DateTime.fromISO(selectedDate, { zone: "Asia/Singapore" })
                  .setLocale("en-US")
                  .toFormat("cccc")}
              </h2>
              <div
                className="cursor-pointer hover:bg-gray-200 ml-1 p-1.5 rounded-lg"
                onClick={() => setIsDaySummaryOpen(true)}
                tabIndex={0}
              >
                <ClipboardCheck className="w-5 h-5" />
              </div>
            </div>

            <div className="flex items-center pb-[4px]">
              {isOutletToggleOpen && (
                <div className="z-30 absolute inset-0 bg-black/40 pointer-events-none" />
              )}
              <DropdownMenu
                open={isOutletToggleOpen}
                onOpenChange={setIsOutletToggleOpen}
              >
                {/* DropdownMenuTrigger must be asChild so it doesn’t render its own element */}
                <DropdownMenuTrigger asChild>
                  <div
                    className="cursor-pointer hover:bg-gray-200 mr-4 p-2 pl-3 rounded-lg border border-slate-500/85 flex items-center gap-2"
                    tabIndex={0}
                  >
                    {getOutletShortName(selectedOutletId)}
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  align="end"
                  sideOffset={8}
                  className="min-w-[120px] px-2 shadow-[0px_0.5px_8px_rgba(0,0,0,0.12)]"
                  onCloseAutoFocus={(e) => e.preventDefault()}
                >
                  {outlets.map((o) => (
                    <DropdownMenuItem
                      key={o.id}
                      onClick={() => setSelectedOutletId(o.id)}
                      className={cn(
                        "text-base hover:!bg-gray-200",
                        o.id === selectedOutletId
                          ? "font-semibold text-green-700 hover:!text-green-700"
                          : ""
                      )}
                    >
                      {o.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="flex items-center space-x-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="bg-beauty-purple hover:bg-beauty-purple-light text-white text-lg font-medium !py-6">
                      <Plus className="!w-5 !h-5 mr-1" />
                      Add
                      <ChevronDown className="!w-4 !h-4 ml-2 opacity-80" />
                    </Button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent
                    align="start"
                    sideOffset={8}
                    className="shadow-[0px_0.5px_8px_rgba(0,0,0,0.20)] min-w-[220px]"
                    onCloseAutoFocus={(e) => e.preventDefault()}
                  >
                    <DropdownMenuItem
                      className="text-base text-slate-800 hover:!bg-gray-200"
                      onClick={handleNewBooking}
                    >
                      Add Booking
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      className="text-base text-slate-800 hover:!bg-gray-200"
                      onClick={handlePurchaseMembership}
                    >
                      Purchase Membership
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="outline"
                  className="text-lg font-medium !py-6 border-slate-300 hover:bg-gray-100"
                  onClick={handleLogout}
                >
                  Logout
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden bg-slate-300">
          <CalendarView
            selectedOutletId={selectedOutletId}
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            onViewAppointment={handleViewAppointment}
          />

          <DaySummary
            selectedOutletId={selectedOutletId}
            selectedDate={selectedDate}
            isVisible={isDaySummaryOpen}
            setIsVisible={setIsDaySummaryOpen}
          />
        </div>
      </div>

      {/* Modals */}
      <BookingModal
        isOpen={isBookingModalOpen}
        onClose={() => {
          setIsBookingModalOpen(false);
          if (appointmentId !== -1) {
            setIsAppointmentModalOpen(true);
          }

          setAppointmentId(-1);
          setCustomerId(-1);
          setBookingIntent('create');
        }}
        selectedOutletId={selectedOutletId}
        // Args to identify new/edit from the appointment modal!!
        appointmentId={appointmentId}
        customerId={customerId}
        intent={bookingIntent}
        onCreate={(values) => {
          if (values.staffId !== undefined) {
            return createAppointment.mutateAsync(values as AppointmentResponse);
          }
          return Promise.resolve({} as AppointmentResponse);
        }}
      />

      <MembershipModal
        isOpen={isMembershipModalOpen}
        onClose={() => setIsMembershipModalOpen(false)}
        outletId={selectedOutletId}
      />

      {selectedCustomerId !== -1 && selectedAppointmentId !== -1 && (
        <AppointmentModal
          isOpen={isAppointmentModalOpen}
          onClose={() => setIsAppointmentModalOpen(false)}
          customerId={selectedCustomerId}
          appointmentId={selectedAppointmentId}
          // Args for new and edit mechanisms
          setCustomerId={setCustomerId}
          setAppointmentId={setAppointmentId}
          setIsBookingModalOpen={setIsBookingModalOpen}
          setBookingIntent={setBookingIntent}
        />
      )}
    </div>
  );
}
