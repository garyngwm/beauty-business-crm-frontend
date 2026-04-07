import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/dialog";
import { Card, CardContent } from "~/card";
import { useMemo, Fragment } from "react";
import { DateTime } from "luxon";
import {
  cn,
  formatDateToStandardLabel,
  formatDateToTime,
} from "@/lib/utils/date-processing";
import { getPaymentBadge } from "../common/payment";
import { getPaymentBorderColor } from "@/lib/utils/style-processing";
import type { AppointmentWithDetails } from "@/lib/types/appointment/appointment";

interface RecentBookingsProps {
  showRecentBookings: boolean;
  setShowRecentBookings: React.Dispatch<React.SetStateAction<boolean>>;
  appointmentsWithDetails: AppointmentWithDetails[];
  parentHeight: number;
}

export default function RecentBookings({
  showRecentBookings,
  setShowRecentBookings,
  appointmentsWithDetails,
  parentHeight,
}: RecentBookingsProps) {
  // Group by date
  const groupedCustomerAppointments = useMemo(
    () =>
      appointmentsWithDetails.reduce<Record<string, AppointmentWithDetails[]>>(
        (acc, appt) => {
          // YYYY-MM-DD
          const apptDate = DateTime.fromISO(
            appt.startTime
          ).toISODate() as string;

          if (!acc[apptDate]) {
            acc[apptDate] = [];
          }

          acc[apptDate].push(appt);
          return acc;
        },
        {}
      ),
    [appointmentsWithDetails]
  );

  // Sort by descending date
  const sortedCustomerAppointments = useMemo(() => {
    const sortedByDate = Object.entries(groupedCustomerAppointments)
      .sort(
        ([dateA], [dateB]) =>
          DateTime.fromISO(dateB).toMillis() -
          DateTime.fromISO(dateA).toMillis()
      )
      .map(([date, appts]) => ({
        date,
        // within each date, sort descending by start time
        appointments: appts.sort(
          (a, b) =>
            DateTime.fromISO(b.startTime).toMillis() -
            DateTime.fromISO(a.startTime).toMillis()
        ),
      }));

    return sortedByDate;
  }, [groupedCustomerAppointments]);

  const dataLength = sortedCustomerAppointments.length;

  return (
    <>
      {showRecentBookings && (
        <div className="z-30 absolute inset-0 bg-black/65 pointer-events-none" />
      )}
      <Dialog open={showRecentBookings} onOpenChange={setShowRecentBookings}>
        <DialogContent
          className="max-w-lg  overflow-auto bg-slate-200 p-7"
          style={{ maxHeight: parentHeight * 0.9 }} // Some buffer, don't match exactly
          showOverlay={false}
        >
          <DialogHeader>
            <DialogTitle className="text-xl text-slate-800 mb-1">
              Recent Bookings
            </DialogTitle>
          </DialogHeader>

          <div className="w-full">
            {/* 
              Interestingly, there will always be at least one recent booking
              Which is this current booking itself!!
              So, we don't need to have a non-bookings display
            */}
            {sortedCustomerAppointments.map(({ date, appointments }, index) => {
              return (
                <Fragment key={date}>
                  <div className="text-[1.0625rem] mb-3 text-slate-800">
                    {formatDateToStandardLabel(date)}
                  </div>
                  <div
                    className={cn(index === dataLength - 1 ? "mb-6" : "mb-10")}
                  >
                    {appointments.map((appointment) => {
                      return (
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
                                  <div className="text-[0.95rem] text-gray-500 flex gap-2">
                                    <span>
                                      {formatDateToTime(appointment.startTime)}{" "}
                                      - {formatDateToTime(appointment.endTime)}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div>{getPaymentBadge(appointment)}</div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </Fragment>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
