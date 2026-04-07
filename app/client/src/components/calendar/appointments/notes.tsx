import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/dialog";
import {
  User,
  MapPin,
  AlertTriangle,
  Bell,
  CircleDollarSign,
  Info,
} from "lucide-react";

import { type CustomerResponse } from "@/lib/types/customer";
import { type StaffResponse } from "@/lib/types/staff/staff";
import { type AppointmentResponse } from "@/lib/types/appointment/appointment";

interface NotesViewProps {
  showNotes: boolean;
  setShowNotes: React.Dispatch<React.SetStateAction<boolean>>;
  thisCustomer: CustomerResponse;
  thisAppointment: AppointmentResponse;
  preferredStaff: StaffResponse | undefined;
  parentHeight: number;
}

// Helper
const getPaymentInfo = (appointment: AppointmentResponse): string => {
  const paymentMethod = appointment.paymentMethod;

  // May become undefined when appointment deleted!!
  const cashPaid = appointment?.cashPaid?.toString();
  const creditsPaid = appointment?.creditsPaid?.toString();

  let result: string;

  if (paymentMethod === "Credits") {
    result = creditsPaid + " credits";
  } else if (paymentMethod === "Card") {
    result = "$" + cashPaid + " card";
  } else {
    result = "$" + cashPaid + " cash";
  }

  return result;
};

export default function NotesView({
  showNotes,
  setShowNotes,
  thisCustomer,
  thisAppointment,
  preferredStaff,
  parentHeight,
}: NotesViewProps) {
  return (
    <>
      {showNotes && (
        <div className="z-30 absolute inset-0 bg-black/60 pointer-events-none" />
      )}
      <Dialog open={showNotes} onOpenChange={setShowNotes}>
        <DialogContent
          className="max-w-lg max-h-[85vh] overflow-auto bg-slate-50"
          style={{ maxHeight: parentHeight * 0.9 }} // Some buffer, don't match exactly
          showOverlay={false}
        >
          <DialogHeader>
            <DialogTitle className="text-xl text-slate-800">Notes</DialogTitle>
          </DialogHeader>

          <div className="text-sm text-slate-800">
            <div className="mt-1 mb-7">
              <p className="font-semibold mb-2 text-[1.0625rem]">Preferences</p>
              <div className="pl-2.5 space-y-2.5 text-[0.95rem]">
                {/* Therapist */}
                <p className="flex items-center">
                  <User
                    className="mr-2.5 h-5 w-5 text-gray-500"
                    aria-hidden="true"
                  />
                  <span className="font-medium">
                    {thisCustomer.preferredTherapistId === null
                      ? "None"
                      : preferredStaff?.firstName +
                      " " +
                      preferredStaff?.lastName}
                  </span>
                </p>

                {/* Outlet */}
                <p className="flex items-center">
                  <MapPin
                    className="mr-2.5 h-5 w-5 text-gray-500"
                    aria-hidden="true"
                  />
                  <span className="font-medium">
                    {thisCustomer.preferredOutletId === 1
                      ? "Outlet 2"
                      : thisCustomer.preferredOutletId === 2
                        ? "Outlet 1"
                        : "None"}
                  </span>
                </p>

                {/* Reminder */}
                <p className="flex items-center">
                  <Bell
                    className="mr-2.5 h-5 w-5 text-gray-500"
                    aria-hidden="true"
                  />
                  {thisCustomer.reminders}
                </p>

                {/* Allergies */}
                <p className="flex items-center">
                  <AlertTriangle
                    className="mr-2.5 h-5 w-5 text-amber-600"
                    aria-hidden="true"
                  />
                  {thisCustomer.allergies?.length
                    ? thisCustomer.allergies.join(", ")
                    : "None"}
                </p>
              </div>
            </div>

            <div className="mb-3">
              <p className="font-semibold mb-2 text-[1.0625rem]">Booking</p>

              <div className="pl-2.5 space-y-2.5 text-[0.95rem]">
                {/* Payment */}
                <p className="flex items-center">
                  <CircleDollarSign
                    className="mr-2.5 h-5 w-5 text-green-600"
                    aria-hidden="true"
                  />
                  {getPaymentInfo(thisAppointment)}
                </p>

                {/* Information */}
                <p className="flex items-center">
                  <Info
                    className="mr-2.5 h-5 w-5 text-amber-600"
                    aria-hidden="true"
                  />
                  {thisAppointment.notes || "No extra info"}
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
