import { cn } from "@/lib/utils/date-processing";
import TooltipPortal from "./tooltip-portal";
import React from "react";

import {
  type AppointmentResponse,
  type AppointmentWithDetails,
  type AppointmentStatus,
} from "@/lib/types/appointment/appointment";
import { type TimeOffResponse } from "@/lib/types/staff/time-off";
import { type BlockedTimeResponse } from "@/lib/types/staff/blocked-time";

import { Badge } from "~/badge";
import { getTooltipClasses } from "@/lib/utils/style-processing";
import { DateTime } from "luxon";
import { diagonalStripesStyles } from "@/lib/utils/style-processing";
import { getOutletShortName } from "@/lib/utils/misc";

//      HELPER METHODS       //
const MIN_APPT_HEIGHT_REM = 3.4;   // tune 2.8–3.6
const MIN_OTHER_HEIGHT_REM = 2.8;  // for blocked/timeoff

const getAppointmentStyle = (appointment: AppointmentWithDetails) => {

  switch (appointment.status) {
    case "Show Up":
      return "bg-gray-300 border-l-4 border-gray-600/90";

    case "No show":
      return "bg-red-500 border-l-4 border-red-600 line-through";

    case "Reschedule":
      return "bg-yellow-100 border-l-4 border-yellow-500/90";

    case "Confirmed":
      return "bg-green-100 border-l-4 border-green-500/90";

    default:
      switch (appointment.paymentMethod) {
        case "Credits":
          return "bg-[#C5F8FE] border-l-4 border-cyan-500/90";

        case "Card":
          return "bg-beauty-pink-light border-l-4 border-pink-500/80";

        default:
          return "bg-[#BFF5EB] border-l-4 border-teal-600/80";
      }
  }
};

const statusColorMap: Record<AppointmentStatus, string> = {
  Booked: "bg-green-600 hover:bg-green-600/80",
  Confirmed: "bg-green-600 hover:bg-green-600/80",
  "Show Up": "bg-gray-600 hover:bg-gray-600/80",
  Reschedule: "bg-yellow-600 hover:bg-yellow-600/80",
  "No show": "bg-red-500 hover:bg-red-500/80",
  Cancelled: "bg-red-500 hover:bg-red-500/80",
};

const getAppointmentBadge = (
  appointment: AppointmentWithDetails,
  theme: "light" | "dark"
) => {
  const isDark = theme === "dark";

  const status = appointment.status;
  const statusColor = statusColorMap[status];

  let bgColor: string;
  let amount: number;
  let displayText: string;

  // Case 1
  if (appointment.paymentMethod === "Credits") {
    bgColor = isDark ? "bg-sky-600 hover:bg-sky-600/80" : "bg-sky-200";
    displayText = appointment.creditsPaid.toString() + " credits";

    // Case 2
  } else if (appointment.paymentMethod === "Card") {
    bgColor = isDark ? "bg-pink-500/90 hover:bg-pink-500/80" : "bg-pink-200";
    amount = appointment.cashPaid;
    displayText = "$" + amount.toString() + " card";

    // Case 3
  } else {
    bgColor = isDark ? "bg-teal-500/70 hover:bg-teal-500/60" : "bg-teal-200";
    amount = appointment.cashPaid;
    displayText = "$" + amount.toString() + " cash";
  }


  return (
    <div className="mt-3 mb-1.5 flex flex-1 items-center gap-x-2 pointer-events-none">
      <Badge
        className={cn(statusColor, "font-medium text-sm pointer-events-none")}
      >
        {appointment.status}
      </Badge>
      <Badge className={cn(bgColor, "font-medium text-sm pointer-events-none")}>
        {displayText}
      </Badge>
    </div>
  );
};

// For time off and blocked time
const getOtherBadge = (approved: boolean, frequency: string) => {
  const statusBgColor = approved
    ? "bg-green-600/90 hover:bg-green-600/80"
    : "bg-yellow-600 hover:bg-yellow-600/80";

  const freqBgColor =
    frequency === "none"
      ? "bg-stone-400/75 hover:bg-stone-400/65"
      : "bg-indigo-500 hover:bg-indigo-500/90";

  return (
    <div
      className={cn(
        "mt-3 mb-1.5 flex items-center gap-x-3 pointer-events-none"
      )}
    >
      <Badge
        className={cn("font-medium text-sm pointer-events-none", statusBgColor)}
      >
        {approved ? "Approved" : "Pending"}
      </Badge>
      <Badge
        className={cn("font-medium text-sm pointer-events-none", freqBgColor)}
      >
        {frequency === "none" ? "No Repeat" : getDisplayFrequency(frequency)}
      </Badge>
    </div>
  );
};

const getDisplayFrequency = (frequency: string) => {
  if (frequency === "repeat") {
    return "Repeats";
  } else {
    // daily, weekly, monthly
    return frequency[0].toUpperCase() + frequency.slice(1);
  }
};

type CardType =
  | "Appointment"
  | "Time Off"
  | "Blocked Time"
  | "Other Appointment";

interface CardRectProps {
  type: CardType;
  entity:
  | AppointmentWithDetails
  | TimeOffResponse
  | BlockedTimeResponse
  | AppointmentResponse;
  yTopOffsetPercentage: number;
  parentHeight: number;
  onClick: () => void;
  onMouseEnter: (event: React.MouseEvent<HTMLElement, MouseEvent>) => void;
  onMouseLeave: () => void;
  isTooltipVisible: boolean;
  tooltipSide: "left" | "right";
  cardElementRef: React.MutableRefObject<HTMLElement | null>;
  // Layout props for handling overlapping appointments
  widthPercentage?: number;
  leftOffsetPercentage?: number;
  onDragStart?: React.DragEventHandler<HTMLElement>;
  onDragEnd?: React.DragEventHandler<HTMLElement>;
  draggable?: boolean;
}

export default function CardRect({
  type,
  entity,
  yTopOffsetPercentage,
  parentHeight,
  onClick,
  onMouseEnter,
  onMouseLeave,
  isTooltipVisible,
  tooltipSide,
  cardElementRef,
  widthPercentage,
  leftOffsetPercentage,
  onDragStart,
  onDragEnd,
  draggable,
}: CardRectProps) {
  let outerDivStyle: string;

  if (type === "Appointment") {
    outerDivStyle = cn(
      getAppointmentStyle(entity as AppointmentWithDetails),
      "appointment"
    );
  } else if (type === "Time Off") {
    outerDivStyle = "bg-amber-150 border-l-4 border-yellow-500 time-off";
  } else {
    outerDivStyle = "bg-[#ffe4c0] border-l-4 border-orange-500/70 blocked-time";
  }

  const getBadge = () => {
    if (type === "Appointment") {
      const appointment = entity as AppointmentWithDetails;
      return getAppointmentBadge(appointment, "dark");
    } else {
      const other = entity as BlockedTimeResponse | TimeOffResponse;
      return getOtherBadge(other.approved, other.frequency);
    }
  };

  const getCardContent = (display: "card" | "tooltip", containerHeight?: number) => {
    let row1: string;
    let row2: string;
    let row3: string;

    if (type === "Appointment") {
      const appointment = entity as AppointmentWithDetails;

      const startDT = DateTime.fromISO(appointment.startTime).setZone(
        "Asia/Singapore"
      );

      const endDT = startDT.plus({
        minutes: appointment.service?.duration,
      });

      const timeRange = `${startDT.toFormat("HH:mm")} - ${endDT.toFormat("HH:mm")}`;

      row1 = `${appointment.customer?.firstName} ${appointment.customer?.lastName}`;
      row2 = appointment.service?.name ?? "";
      row3 = timeRange;
    } else if (type === "Time Off") {
      const timeOff = entity as TimeOffResponse;

      row1 = "Time Off";
      row2 = `${timeOff.startTime} - ${timeOff.endTime}`;
      row3 = timeOff.type;
    } else if (type === "Blocked Time") {
      const blockedTime = entity as BlockedTimeResponse;

      row1 = "Blocked Time";
      row2 = `${blockedTime.fromTime} - ${blockedTime.toTime}`;
      row3 = blockedTime.title;
    } else {
      const otherAppointment = entity as AppointmentResponse;
      const otherOutletName = getOutletShortName(otherAppointment.outletId);

      const otherStart = DateTime.fromISO(otherAppointment.startTime).toFormat(
        "HH:mm"
      );

      const otherEnd = DateTime.fromISO(otherAppointment.endTime).toFormat(
        "HH:mm"
      );

      row1 = "Other Appointment";
      row2 = `${otherStart} - ${otherEnd}`;
      row3 = otherOutletName;
    }

    // Smart content rendering based on available height (for card display only)
    if (display === "card" && containerHeight) {
      // Calculate how many lines can fit (assuming ~1.5rem per line with padding)
      const availableHeight = containerHeight - 1; // Subtract outer padding
      const lineHeight = 1.5; // rem
      const maxLines = Math.floor(availableHeight / lineHeight);

      // Priority: row1 (name) > row2 (time) > row3 (service/type)
      const lines = [
        { content: row1, className: "text-[0.95rem] font-semibold leading-tight min-h-[1.4rem]" },
        { content: row2, className: "text-[0.95rem] font-medium leading-tight min-h-[1.4rem]" },
        { content: row3, className: cn("text-[0.95rem] leading-tight min-h-[1.4rem]", type === "Other Appointment" ? "text-green-400" : undefined) }
      ];

      const linesToShow = lines.slice(0, Math.max(2, maxLines)); // Always show at least the first line

      return (
        <div className={cn(display === "card" ? "text-gray-800" : "text-gray-200")}>
          {linesToShow.map((line, index) => (
            <p key={index} className={line.className}>
              {line.content}
            </p>
          ))}
        </div>
      );
    }

    // Original layout for tooltips and sufficient height
    return (
      <div
        className={cn(display === "card" ? "text-gray-800" : "text-gray-200")}
      >
        <p
          className={cn(
            "text-[0.95rem] font-semibold leading-tight min-h-[1.4rem]",
            type === "Other Appointment" ? "mb-2" : "mb-1"
          )}
        >
          {row1}
        </p>
        <p className="text-[0.95rem] font-medium leading-tight min-h-[1.4rem]">{row2}</p>
        <p
          className={cn(
            "text-[0.95rem] leading-tight min-h-[1.4rem] mb-2",
            type === "Other Appointment" ? "text-green-400" : undefined
          )}
        >
          {row3}
        </p>
      </div>
    );
  };

  // Early return
  if (type === "Other Appointment") {
    const maxHeight = ((100 - yTopOffsetPercentage) / 100) * 7.5;
    const crossesBoundary = parentHeight >= maxHeight;

    if (crossesBoundary) {
      // We render as 2 separate div's
      // So the grid bottom border still shows
      const heightDiv1 = ((100 - yTopOffsetPercentage) / 100) * 7.5;
      const topOffsetDiv1 = yTopOffsetPercentage;

      const heightDiv2 = parentHeight - heightDiv1;

      return (
        <div
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          className="relative"
          style={{
            top: `${topOffsetDiv1}%`,
          }}
        >
          <div
            className={cn(
              "z-10 bg-gray-150 w-full text-base absolute appointment border-b border-gray-400/50"
            )}
            style={{
              top: 0, // Relative to parent, so start at 0
              height: `${heightDiv1}rem`,
              backgroundImage: diagonalStripesStyles,
            }}
          />
          <div
            className={cn(
              "z-10 bg-gray-150 w-full text-base absolute appointment"
            )}
            style={{
              top: `${heightDiv1}rem`, // Position below first div
              height: `${heightDiv2}rem`,
              backgroundImage: diagonalStripesStyles,
            }}
          />
          <TooltipPortal
            side={tooltipSide}
            targetElement={isTooltipVisible ? cardElementRef.current : null}
          >
            <div
              className={getTooltipClasses({
                isOpen: isTooltipVisible,
                side: tooltipSide,
              })}
            >
              {getCardContent("tooltip")}
            </div>
          </TooltipPortal>
        </div>
      );
    } else {
      return (
        <div
          className={cn(
            "z-10 bg-gray-150 w-full text-base absolute appointment"
          )}
          style={{
            top: `${yTopOffsetPercentage}%`,
            height: `${parentHeight}rem`,
            backgroundImage: diagonalStripesStyles,
          }}
          // Tooltip feature
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        >
          <TooltipPortal
            side={tooltipSide}
            targetElement={
              isTooltipVisible
                ? // Take reference from the card to position it
                cardElementRef.current
                : null
            }
          >
            <div
              className={getTooltipClasses({
                isOpen: isTooltipVisible,
                side: tooltipSide,
              })}
            >
              {getCardContent("tooltip")}
            </div>
          </TooltipPortal>
        </div>
      );
    }
  }

  // Calculate dynamic positioning based on layout props
  const hasLayoutInfo = widthPercentage !== undefined && leftOffsetPercentage !== undefined;
  const dynamicStyles = hasLayoutInfo
    ? {
      left: `${leftOffsetPercentage}%`,
      width: `${widthPercentage}%`,
    }
    : {
      left: '2px',
      right: '2px',
    };

  const minHeightRem =
    type === "Appointment" ? MIN_APPT_HEIGHT_REM : MIN_OTHER_HEIGHT_REM;

  return (
    // Card content itself
    // Outer div -> set the padding + parentHeight
    // Inner div -> set the parentHeight - 1rem (cuz top and bottom p-2)
    // To emulate vertical padding!
    <div
      className={cn(
        outerDivStyle,
        "p-2 rounded-md cursor-pointer absolute z-10 select-none",
        hasLayoutInfo ? "" : "left-[2px] right-[2px]"
      )}
      style={{
        top: `${yTopOffsetPercentage}%`,
        height: `${parentHeight}rem`,
        minHeight: `${minHeightRem}rem`,
        ...dynamicStyles,
      }}
      onClick={onClick}
      // Tooltip feature
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="overflow-hidden h-full flex flex-col justify-start">
        {getCardContent("card", parentHeight)}
      </div>

      <TooltipPortal
        side={tooltipSide}
        targetElement={
          isTooltipVisible
            ? // Take reference from the card to position it
            cardElementRef.current
            : null
        }
      >
        <div
          className={getTooltipClasses({
            isOpen: isTooltipVisible,
            side: tooltipSide,
          })}
        >
          {getCardContent("tooltip")}

          {type === "Appointment" &&
            (entity as AppointmentWithDetails).notes?.trim() && (
              <div className="mt-2 border-t pt-2">
                <div className="text-xs font-medium text-slate-400 mb-1">Notes</div>
                <div className="text-sm text-white whitespace-pre-wrap max-h-40 overflow-auto">
                  {(entity as AppointmentWithDetails).notes}
                </div>
              </div>
            )}

          <div className="pointer-events-none">{getBadge()}</div>
        </div>
      </TooltipPortal>
    </div>
  );
}
