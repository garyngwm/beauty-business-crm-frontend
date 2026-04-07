import { AppointmentWithDetails } from "@/lib/types/appointment/appointment";

export const getPaymentBadge = (appointment: AppointmentWithDetails) => {
  if (appointment.paymentMethod === "Credits") {
    return (
      <div className="text-cyan-700 text-base">
        {appointment.creditsPaid} credits
      </div>
    );
  } else if (appointment.paymentMethod === "Card") {
    return (
      <div className="text-pink-700 text-base">
        ${appointment.cashPaid} card
      </div>
    );
  } else {
    return (
      <div className="text-teal-700 text-base">
        ${appointment.cashPaid} cash
      </div>
    );
  }
};
