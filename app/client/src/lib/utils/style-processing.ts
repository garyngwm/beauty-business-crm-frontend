import { cn } from "@/lib/utils/date-processing";
import { type AppointmentWithDetails } from "../types/appointment/appointment";

type TooltipSide = "left" | "right";

interface TooltipClassOptions {
  isOpen: boolean;
  side: TooltipSide;
}

// These are all used by the calendar page
export const getTooltipClasses = ({ isOpen, side }: TooltipClassOptions) =>
  cn(
    // base styles
    "bg-gray-700 rounded-md p-3.5 pr-6 text-gray-200",
    "pointer-events-none select-none shadow-lg",

    // base animations
    "transition-all duration-200 ease-out transform-gpu",

    // open vs closed
    isOpen
      ? "opacity-100 translate-x-0"
      : side === "right"
        ? "opacity-0 -translate-x-2" // slide from left to right
        : "opacity-0 translate-x-2" // slide from right to left
  );

export const getPaymentBorderColor = (
  appointment: AppointmentWithDetails
): string => {
  if (appointment.paymentMethod === "Credits") {
    return "#4AC7B4FF";
  } else if (appointment.paymentMethod === "Card") {
    return "#DF84B6FF";
  } else {
    return "#6CB0B9FF";
  }
};

export const getAvailableBorderColor = (
  availability: "Busy" | "Free"
): string => {
  if (availability === "Busy") {
    return "#a75050ff";
  } else {
    return "#63b17fff";
  }
};

export const radioStyles = [
  "relative h-4 w-4 rounded-full border border-green-600",
  "data-[state=checked]:bg-green-600",
  "data-[state=checked]:after:content-['']",
  "data-[state=checked]:after:absolute",
  "data-[state=checked]:after:top-1/2",
  "data-[state=checked]:after:left-1/2",
  "data-[state=checked]:after:-translate-x-1/2",
  "data-[state=checked]:after:-translate-y-1/2",
  "data-[state=checked]:after:h-2",
  "data-[state=checked]:after:w-2",
  "data-[state=checked]:after:rounded-full",
  "data-[state=checked]:after:bg-white",
].join(" ");

export const diagonalStripesStyles = `repeating-linear-gradient(
    45deg,
    rgba(0,0,0,0.1) 0px,
    rgba(0,0,0,0.1) 2px,
    transparent 2px,
    transparent 20px
)`;
