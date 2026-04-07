import { useQuery } from "@tanstack/react-query";

import { type AppointmentWithDetails } from "@/lib/types/appointment/appointment";
import { type CustomerResponse } from "@/lib/types/customer";
import { type ServiceResponse } from "@/lib/types/service/service";
import { type AppointmentResponse } from "@/lib/types/appointment/appointment";
import { type StaffResponse } from "@/lib/types/staff/staff";
import { apiRequest } from "@/lib/query-client";

interface WeekViewProps {
  selectedOutletId: number;
  selectedDate: string;
  onViewAppointment: (customerId: number, appointmentId: number) => void;
}

export default function WeekView({
  selectedOutletId,
  selectedDate,
  onViewAppointment,
}: WeekViewProps) {
  // Get the week dates
  const getWeekDates = () => {
    const date = new Date(selectedDate);
    const day = date.getDay();
    const diff = date.getDate() - day + 1; // Monday
    const monday = new Date(date.setDate(diff));

    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const weekDate = new Date(monday);
      weekDate.setDate(monday.getDate() + i);
      weekDates.push(weekDate);
    }
    return weekDates;
  };

  const weekDates = getWeekDates();

  const {
    data: staff = [],
  } = useQuery<StaffResponse[]>({
    queryKey: ["/api/staffs/outlet", selectedOutletId],
    enabled: Number.isFinite(selectedOutletId) && selectedOutletId > 0,
    queryFn: () =>
      apiRequest("GET", `/api/staffs/outlet/${selectedOutletId}`),
  });

  const {
    data: customers = [],
  } = useQuery<CustomerResponse[]>({
    queryKey: ["/api/customers"],
    queryFn: () => apiRequest("GET", "/api/customers"),
  });

  const {
    data: services = [],
  } = useQuery<ServiceResponse[]>({
    queryKey: ["/api/services"],
    queryFn: () => apiRequest("GET", "/api/services"),
  });

  // Fetch appointments for each day of the week
  const weekAppointments = useQuery({
    queryKey: ["/api/appointments/week", selectedOutletId, selectedDate],
    queryFn: async () => {
      const allAppointments: any[] = [];

      for (const date of weekDates) {
        const dateStr = date.toISOString().split("T")[0];

        const dayAppointments = await apiRequest("GET", `/api/appointments/outlet/${selectedOutletId}/${dateStr}`);

        allAppointments.push(...dayAppointments);
      }

      return allAppointments;
    },
  });

  const appointments = weekAppointments.data || [];

  // Enhance appointments with related data
  const appointmentsWithDetails: AppointmentWithDetails[] = appointments.map(
    (appointment: AppointmentResponse) => ({
      ...appointment,
      customer: customers.find(
        (c: CustomerResponse) => c.id === appointment.customerId
      ),
      staff: staff.find((s: StaffResponse) => s.id === appointment.staffId),
      service: services.find(
        (s: ServiceResponse) => s.id === appointment.serviceId
      ),
    })
  );

  const timeSlots = [
    "9:00 AM",
    "10:00 AM",
    "11:00 AM",
    "12:00 PM",
    "1:00 PM",
    "2:00 PM",
    "3:00 PM",
    "4:00 PM",
    "5:00 PM",
    "6:00 PM",
    "7:00 PM",
    "8:00 PM",
    "9:00 PM",
  ];

  const getAppointmentsForDateAndTime = (date: Date, timeSlot: string) => {
    const hour = parseInt(timeSlot.split(":")[0]);
    const isPM = timeSlot.includes("PM");
    const targetHour =
      isPM && hour !== 12 ? hour + 12 : hour === 12 && !isPM ? 0 : hour;

    const dateStr = date.toISOString().split("T")[0];

    return appointmentsWithDetails.filter((appointment) => {
      const appointmentDate = new Date(appointment.startTime);
      const appointmentDateStr = appointmentDate.toISOString().split("T")[0];
      const appointmentHour = appointmentDate.getHours();

      return appointmentDateStr === dateStr && appointmentHour === targetHour;
    });
  };

  const getAppointmentStyle = (appointment: AppointmentWithDetails) => {
    if (appointment.paymentMethod === "Credits") {
      return "bg-beauty-purple-light border-l-4 border-purple-500";
    } else if (appointment.paymentMethod === "Card") {
      return "bg-beauty-pink-light border-l-4 border-pink-500";
    } else {
      return "bg-green-50 border-l-4 border-green-400";
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Week Header */}
      <div
        className="grid border-b border-gray-200"
        style={{ gridTemplateColumns: `120px repeat(7, 1fr)` }}
      >
        <div className="p-4 bg-gray-50 border-r border-gray-200">
          <span className="text-sm font-medium text-gray-600">Time</span>
        </div>
        {weekDates.map((date, index) => (
          <div
            key={date.toISOString()}
            className={`p-3 bg-gray-50 text-center ${index < 6 ? "border-r border-gray-200" : ""}`}
          >
            <div className="flex flex-col items-center">
              <p className="text-sm font-medium text-gray-800">
                {date.toLocaleDateString("en-US", { weekday: "short" })}
              </p>
              <p className="text-lg font-semibold text-gray-900">
                {date.getDate()}
              </p>
              <p className="text-xs text-gray-500">
                {date.toLocaleDateString("en-US", { month: "short" })}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Time Rows */}
      {timeSlots.map((timeSlot) => (
        <div
          key={timeSlot}
          className="grid border-b border-gray-200 last:border-b-0 hover:bg-gray-50"
          style={{ gridTemplateColumns: `120px repeat(7, 1fr)` }}
        >
          <div className="p-4 border-r border-gray-200 bg-white">
            <span className="text-sm font-medium text-gray-700">
              {timeSlot}
            </span>
          </div>

          {/* Day Columns */}
          {weekDates.map((date, dayIndex) => {
            const dayAppointments = getAppointmentsForDateAndTime(
              date,
              timeSlot
            );

            return (
              <div
                key={date.toISOString()}
                className={`p-1 relative min-h-[60px] ${dayIndex < 6 ? "border-r border-gray-200" : ""}`}
              >
                {dayAppointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    className={`${getAppointmentStyle(appointment)} rounded-md p-1 cursor-pointer hover:shadow-sm mb-1 text-xs`}
                    onClick={() =>
                      appointment.customer &&
                      onViewAppointment(appointment.customerId, appointment.id)
                    }
                  >
                    <p className="font-medium text-gray-800 truncate">
                      {appointment.customer?.firstName}{" "}
                      {appointment.customer?.lastName}
                    </p>
                    <p className="text-gray-600 truncate">
                      {appointment.service?.name}
                    </p>
                    <p className="text-gray-500">
                      {appointment.staff?.firstName}
                    </p>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
