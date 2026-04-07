import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils/date-processing";
import { Card, CardContent } from "~/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "~/dialog";
import { Button } from "~/button";
import { getPaymentBadge } from "../common/payment";
import {
  getPaymentBorderColor,
  getAvailableBorderColor,
} from "@/lib/utils/style-processing";
import { getOutletFullName } from "@/lib/utils/misc";
import { formatDateToTime } from "@/lib/utils/date-processing";
import LoadingSpinner from "@/components/shared/loading-spinner";
import { useMinimumLoadingTime } from "@/hooks/use-min-loading";
import { MapPin } from "lucide-react";
import { DateTime } from "luxon";
import { useMemo } from "react";

import { type AppointmentWithDetails } from "@/lib/types/appointment/appointment";
import { type CustomerResponse } from "@/lib/types/customer";
import { type StaffResponse } from "@/lib/types/staff/staff";
import { type ServiceResponse } from "@/lib/types/service/service";
import { type AppointmentResponse } from "@/lib/types/appointment/appointment";
import { apiRequest } from "@/lib/query-client";

interface DaySummaryProps {
  isVisible: boolean;
  setIsVisible: React.Dispatch<React.SetStateAction<boolean>>;
  selectedOutletId: number;
  selectedDate: string;
}

export function DaySummary({
  selectedOutletId,
  selectedDate,
  isVisible,
  setIsVisible,
}: DaySummaryProps) {
  // All appointments from this date and this outlet
  const { data: appointments = [], isLoading: isAppointmentsLoading } =
    useQuery<AppointmentResponse[]>({
      queryKey: ["/api/appointments/outlet", selectedOutletId, selectedDate],
      queryFn: () =>
        apiRequest(
          "GET",
          `/api/appointments/outlet/${selectedOutletId}/${selectedDate}`
        ),
    });

  const { data: customers = [], isLoading: isCustomersLoading } = useQuery<
    CustomerResponse[]
  >({
    queryKey: ["/api/customers"],
    queryFn: () => apiRequest("GET", "/api/customers"),
  });

  const { data: services = [], isLoading: isServicesLoading } = useQuery<
    ServiceResponse[]
  >({
    queryKey: ["/api/services"],
    queryFn: () => apiRequest("GET", "/api/services"),
  });

  const { data: staff = [], isLoading: isStaffLoading } = useQuery<
    StaffResponse[]
  >({
    queryKey: ["/api/staffs/outlet", selectedOutletId],
    queryFn: () => apiRequest("GET", `/api/staffs/outlet/${selectedOutletId}`),
  });

  const isLoading =
    isAppointmentsLoading ||
    isCustomersLoading ||
    isServicesLoading ||
    isStaffLoading;

  const showLoading = useMinimumLoadingTime(isLoading);

  // Enhance appointments
  const appointmentsWithDetails = useMemo(
    (): AppointmentWithDetails[] =>
      appointments.map((appt) => ({
        ...appt,
        customer: customers.find((c) => c.id === appt.customerId),
        staff: staff.find((s) => s.id === appt.staffId),
        service: services.find((s) => s.id === appt.serviceId),
      })),
    [appointments, customers, staff, services]
  );

  // Today stats
  const now = DateTime.local();
  const todayBookings = appointmentsWithDetails.length;

  const todayRevenue = useMemo(() => {
    return appointmentsWithDetails.reduce((total, appt) => {
      if (["cash", "card"].includes(appt.paymentMethod)) {
        return total + parseFloat(appt.cashPaid?.toString() || "0");
      }
      return total;
    }, 0);
  }, [appointmentsWithDetails]);

  // Get the upcoming appoinments, in ascending time
  const upcomingAppointments = useMemo(() => {
    return appointmentsWithDetails
      .filter((a) => DateTime.fromISO(a.startTime) > now)
      .sort(
        (a, b) =>
          DateTime.fromISO(a.startTime).toMillis() -
          DateTime.fromISO(b.startTime).toMillis()
      )
      .slice(0, 3);
  }, [appointmentsWithDetails, now]);

  // Get the staff status and number of bookings
  const staffStats = useMemo(() => {
    return staff.map((member) => {
      const current = appointmentsWithDetails.find((a) => {
        const start = DateTime.fromISO(a.startTime);
        const end = DateTime.fromISO(a.endTime);

        return a.staffId === member.id && now >= start && now <= end;
      });

      const numBookings = appointmentsWithDetails.filter(
        (a) => a.staffId === member.id
      ).length;

      return {
        staff: member,
        status: current ? "Busy" : "Free",
        numBookings: numBookings,
      };
    });
  }, [appointmentsWithDetails, staff, now]);

  return (
    <Dialog open={isVisible} onOpenChange={setIsVisible}>
      <DialogContent className="bg-white max-w-xl max-h-[80vh] overflow-auto p-8 bg-slate-200">
        <DialogHeader>
          <DialogTitle className="text-xl text-slate-800 mb-1.5">
            <div>Today&apos;s Summary</div>
            <div className="flex items-center gap-1.5 mt-1 text-lg font-medium text-slate-600">
              <MapPin className="w-5 h-5" />
              {getOutletFullName(selectedOutletId)}
            </div>
          </DialogTitle>
        </DialogHeader>

        {showLoading ? (
          <LoadingSpinner />
        ) : (
          <>
            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              {/* Between purple-50 and purple-100, leaning more towards the latter */}
              <Card className="bg-[#F7F0FF] shadow-md">
                <CardContent className="p-4">
                  <p className="text-base text-slate-800">Total Bookings</p>
                  <p className="text-3xl font-bold beauty-purple">
                    {todayBookings}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-green-50 shadow-md">
                <CardContent className="p-4">
                  <p className="text-base text-slate-800">Revenue</p>
                  <p className="text-3xl font-bold text-green-600">
                    ${todayRevenue.toFixed(0)}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Upcoming Bookings */}
            <div className="mb-6">
              <h4 className="text-[1.0625rem] font-semibold text-slate-800 mb-3">
                Next Bookings
              </h4>
              <div>
                {upcomingAppointments.length > 0 ? (
                  upcomingAppointments.map((appointment) => (
                    <Card
                      key={appointment.id}
                      className="bg-gray-50 shadow-md mb-3 rounded-lg hover:bg-purple-200 transition-colors"
                      style={{
                        borderLeft: `6px solid ${getPaymentBorderColor(appointment)}`,
                      }}
                    >
                      <CardContent className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="flex-1">
                            <div>
                              <span className="text-base text-gray-800">
                                {appointment.service?.name}
                              </span>

                              <div className="text-[0.95rem] text-gray-500 flex items-center">
                                <span>
                                  {formatDateToTime(appointment.startTime)} -{" "}
                                  {formatDateToTime(appointment.endTime)}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div>{getPaymentBadge(appointment)}</div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <p className="text-base text-gray-600 -mt-1">
                    No upcoming bookings
                  </p>
                )}
              </div>
            </div>

            {/* Staff Availability */}
            <div>
              <h4 className="text-[1.0625rem] font-semibold text-slate-800 mb-3">
                Staff Status
              </h4>
              <div>
                {staffStats.length > 0 ? (
                  staffStats.map(({ staff, status, numBookings }) => (
                    <Card
                      key={staff.id}
                      className="bg-gray-50 shadow-md mb-3 rounded-lg hover:bg-purple-200 transition-colors"
                      style={{
                        borderLeft: `6px solid ${getAvailableBorderColor(status as "Busy" | "Free")}`,
                      }}
                    >
                      <CardContent className="px-6 py-3.5">
                        <div className="flex items-center justify-between">
                          <div className="flex-col">
                            <div className="text-base text-gray-800">
                              {staff.firstName} {staff.lastName}
                            </div>
                            <div className="text-[0.95rem] text-gray-500">
                              {numBookings} bookings
                            </div>
                          </div>

                          <div
                            className={cn(
                              "text-base",
                              status === "Busy"
                                ? "text-red-700"
                                : "text-green-700"
                            )}
                          >
                            {status}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <p className="text-base text-gray-600 -mt-1">
                    No staff members found for this outlet
                  </p>
                )}
              </div>
            </div>

            <DialogFooter className="mt-7">
              <DialogClose asChild>
                <Button className="text-base hover:bg-beauty-purple-light">
                  Close
                </Button>
              </DialogClose>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
