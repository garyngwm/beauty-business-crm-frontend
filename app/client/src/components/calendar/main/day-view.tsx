import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, UsersRound, Frown } from "lucide-react";
import { Button } from "~/button";
import { Checkbox } from "~/checkbox";
import WeekView from "./week-view";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "~/dropdown-menu";
import { CELL_HEIGHT } from "@/lib/constants";
import { Popover, PopoverTrigger, PopoverContent } from "~/popover";
import { Calendar } from "~/calendar"; // shadcn Calendar (react-day-picker under the hood)
import { Calendar as CalendarIcon } from "lucide-react";
import { DateTime } from "luxon";
import { getBusinessWindow } from "@/lib/utils/business-hours";
import {
  calculateAppointmentLayout,
  type LayoutInfo,
} from "@/lib/utils/appointment-layout";
import {
  formatTimeTo24Hour,
  generateTimeOptions,
} from "@/lib/utils/date-processing";
import { cn } from "@/lib/utils/date-processing";
import BlockedTimeModal from "../staff-actions/blocked-time";
import TimeOffModal from "../staff-actions/time-off";
import ShiftModal from "../staff-actions/shift";
import { useLocation } from "wouter";
import LoadingSpinner from "@/components/shared/loading-spinner";
import { useMinimumLoadingTime } from "@/hooks/use-min-loading";
import { useControlledTooltip } from "@/hooks/use-controlled-tooltip";
import { displayGrayRectangle } from "@/lib/utils/misc";
import GrayRect from "./gray-rect";
import CardRect from "./card-rect";
import { apiRequest } from "@/lib/query-client";
import { type ServiceResponse } from "@/lib/types/service/service";
import {
  type AppointmentResponse,
  type AppointmentWithDetails,
} from "@/lib/types/appointment/appointment";
import { type CustomerResponse } from "@/lib/types/customer";
import { type ShiftResponse } from "@/lib/types/staff/shift";
import { type TimeOffResponse } from "@/lib/types/staff/time-off";
import { type BlockedTimeResponse } from "@/lib/types/staff/blocked-time";
import { type StaffResponse } from "@/lib/types/staff/staff";

interface CalendarViewProps {
  selectedOutletId: number; // Outlet 2 -> 1, Outlet 1 -> 2
  selectedDate: string; // YYYY-MM-DD
  onDateChange: (date: string) => void;
  onViewAppointment: (customerId: number, appointmentId: number) => void;
}

export default function CalendarView({
  selectedOutletId,
  selectedDate,
  onDateChange,
  onViewAppointment,
}: CalendarViewProps) {
  const [, navigate] = useLocation();
  const { activeTooltipId, showTooltip, hideTooltip } =
    useControlledTooltip(350);

  // Scroll + tooltip interaction for cards
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Store a secondary backup
  // Of the card we were hovering over, and the tooltipId that was being shown
  const tooltipIdRef = useRef<string | null>(null);
  const cardElementRef = useRef<HTMLElement | null>(null);

  // Data fetching
  const { data: staff = [], isLoading: isStaffLoading } = useQuery<
    StaffResponse[]
  >({
    queryKey: ["/api/staffs/outlet", selectedOutletId],
    queryFn: () => apiRequest("GET", `/api/staffs/outlet/${selectedOutletId}`),
  });

  const { data: shifts = [], isLoading: isShiftsLoading } = useQuery<
    ShiftResponse[]
  >({
    queryKey: ["/api/shifts/outlet", selectedOutletId, selectedDate],
    queryFn: () =>
      apiRequest(
        "GET",
        `/api/shifts/outlet/${selectedOutletId}/${selectedDate}`
      ),
  });

  const { data: timeOffs = [], isLoading: isTimeOffsLoading } = useQuery<
    TimeOffResponse[]
  >({
    queryKey: ["/api/time-offs/outlet", selectedOutletId, selectedDate],
    queryFn: () =>
      apiRequest(
        "GET",
        `/api/time-offs/outlet/${selectedOutletId}/${selectedDate}`
      ),
  });

  const { data: blockedTimes = [], isLoading: isBlockedTimesLoading } =
    useQuery<BlockedTimeResponse[]>({
      queryKey: ["/api/blocked-times/outlet", selectedOutletId, selectedDate],
      queryFn: () =>
        apiRequest(
          "GET",
          `/api/blocked-times/outlet/${selectedOutletId}/${selectedDate}`
        ),
    });

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
    queryKey: ["/api/customers/with-appointments", selectedDate],
    queryFn: () =>
      apiRequest(
        "GET",
        `/api/customers/with-appointments?date=${selectedDate}`
      ),
  });

  const { data: services = [], isLoading: isServicesLoading } = useQuery<
    ServiceResponse[]
  >({
    queryKey: ["/api/services"],
    queryFn: () => apiRequest("GET", "/api/services"),
  });

  // Get the other outlet appointments over the same day
  // Then, for each staff, look up the other outlet appointments (if any)
  // Then, for this outlet, display them as greyed out!!
  const otherOutletId = selectedOutletId === 1 ? 2 : 1;
  const {
    data: otherAppointments = [],
    isLoading: isOtherAppointmentsLoading,
  } = useQuery<AppointmentResponse[]>({
    queryKey: ["/api/appointments/outlet", otherOutletId, selectedDate],
    queryFn: () =>
      apiRequest(
        "GET",
        `/api/appointments/outlet/${otherOutletId}/${selectedDate}`
      ),
  });

  const rescheduleAppointmentMutation = useMutation({
    mutationFn: async (payload: {
      id: number;
      staffId: number;
      startTime: string;
      endTime: string;
    }) => {
      const body = {
        appointmentIds: [payload.id],
        newStartTime: payload.startTime,
        newStaffId: payload.staffId,
      };

      return apiRequest("POST", `/api/appointments/reschedule-slot`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/appointments/outlet", selectedOutletId, selectedDate],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/customers/with-appointments"],
      });
    },
  });


  const isLoading =
    isStaffLoading ||
    isShiftsLoading ||
    isTimeOffsLoading ||
    isBlockedTimesLoading ||
    isAppointmentsLoading ||
    isOtherAppointmentsLoading ||
    isCustomersLoading ||
    isServicesLoading;

  // Establish important constants
  const TIME_OPTIONS = useMemo(() => {
    const shiftDT = DateTime.fromISO(selectedDate).setZone("Asia/Singapore");
    const { opening, closing } = getBusinessWindow(shiftDT);
    // 60 minute intervals
    // -1 from closing so we dont get another 1hr starting from closing time
    return generateTimeOptions(opening, closing - 1, 60);
  }, [selectedDate]);

  const [viewType, setViewType] = useState<"day" | "week">("day");

  // Staff action state
  const [editShift, setEditShift] = useState(false);
  const [targetStaff, setTargetStaff] = useState<StaffResponse | null>(null);
  const [blockedTime, setBlockedTime] = useState(false);
  const [timeOff, setTimeOff] = useState(false);

  // Staff selection state
  // Read from localStorage before first render
  const [deselectedStaffIds, setDeselectedStaffIds] = useState<Set<number>>(
    () => {
      if (typeof window === "undefined") return new Set<number>();

      try {
        const raw = localStorage.getItem(
          `calendar:deselectedStaffIds:v1:outlet:${selectedOutletId}`
        );
        if (!raw) return new Set<number>();

        const data: unknown = JSON.parse(raw);
        if (!Array.isArray(data)) return new Set<number>();

        const parsed: number[] = (data as unknown[])
          .map((x): number | null => {
            if (typeof x === "number") return x;
            if (typeof x === "string") {
              const n = Number(x);
              return Number.isFinite(n) ? n : null;
            }
            return null;
          })
          .filter(
            (n): n is number => typeof n === "number" && Number.isFinite(n)
          );

        return new Set<number>(parsed);
      } catch {
        return new Set<number>();
      }
    }
  );

  const storageKey = useMemo(
    () => `calendar:deselectedStaffIds:v1:outlet:${selectedOutletId}`,
    [selectedOutletId]
  );

  const selectedStaff = staff.filter((s) => !deselectedStaffIds.has(s.id));

  // Dropdown visibility state
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);
  const [showStaffDropdown, setShowStaffDropdown] = useState<number | null>(
    null
  );

  const [timeOffId, setTimeOffId] = useState(-1);
  const [blockedTimeId, setBlockedTimeId] = useState(-1);
  const [isDateOpen, setIsDateOpen] = useState(false);

  const [draggingAppointmentId, setDraggingAppointmentId] = useState<number | null>(null);

  // Enhance appointments with related data
  // To be used in card display
  const appointmentsWithDetails: AppointmentWithDetails[] = useMemo(() => {
    return appointments.map((appointment: AppointmentResponse) => ({
      ...appointment,
      customer: customers.find(
        (c: CustomerResponse) => c.id === appointment.customerId
      ),
      staff: staff.find((s: StaffResponse) => s.id === appointment.staffId),
      service: services.find(
        (s: ServiceResponse) => s.id === appointment.serviceId
      ),
    }));
  }, [appointments, customers, staff, services]);

  // Calculate layout for overlapping appointments per staff member
  const appointmentLayoutMap = useMemo(() => {
    const layoutMap = new Map<number, LayoutInfo>();

    // Group appointments by staff member
    const appointmentsByStaff = new Map<number, AppointmentWithDetails[]>();

    appointmentsWithDetails.forEach((appointment) => {
      const staffId = appointment.staffId;
      let staffAppointments = appointmentsByStaff.get(staffId);
      if (!staffAppointments) {
        staffAppointments = [];
        appointmentsByStaff.set(staffId, staffAppointments);
      }
      staffAppointments.push(appointment);
    });

    // Calculate layout for each staff member's appointments
    appointmentsByStaff.forEach((staffAppointments) => {
      const staffLayout = calculateAppointmentLayout(staffAppointments);
      staffLayout.forEach((layout, appointmentId) => {
        layoutMap.set(appointmentId, layout);
      });
    });

    return layoutMap;
  }, [appointmentsWithDetails]);

  // When staff list loads/changes, drop any stale IDs that no longer exist
  useEffect(() => {
    if (!staff || staff.length === 0) return;
    const currentIds = new Set(staff.map((s) => s.id));
    setDeselectedStaffIds((prev) => {
      let changed = false;
      const next = new Set<number>();
      prev.forEach((id) => {
        if (currentIds.has(id)) next.add(id);
        else changed = true;
      });
      return changed ? next : prev;
    });
  }, [staff.map((s) => s.id).join(","), selectedOutletId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(
      storageKey,
      JSON.stringify(Array.from(deselectedStaffIds))
    );
  }, [storageKey, deselectedStaffIds]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = localStorage.getItem(storageKey);
      const data: unknown = raw ? JSON.parse(raw) : [];
      const parsed: number[] = Array.isArray(data)
        ? data
          .map((x): number | null => {
            if (typeof x === "number") return x;
            if (typeof x === "string") {
              const n = Number(x);
              return Number.isFinite(n) ? n : null;
            }
            return null;
          })
          .filter(
            (n): n is number => typeof n === "number" && Number.isFinite(n)
          )
        : [];
      setDeselectedStaffIds(new Set<number>(parsed));
    } catch {
      setDeselectedStaffIds(new Set<number>());
    }
  }, [storageKey]);

  const showLoading = useMinimumLoadingTime(isLoading);

  // Hide tooltip on scroll
  // Show again if necessary
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (showLoading || !container) return;

    const handleScroll = () => {
      hideTooltip();

      // If the original card element is now/still hovering
      // Show it again!!
      if (
        cardElementRef.current?.matches(":hover") &&
        tooltipIdRef.current &&
        !doesTooltipOverlapHeader(cardElementRef.current)
      ) {
        showTooltip(tooltipIdRef.current);
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [showLoading]);

  const queryClient = useQueryClient();

  useEffect(() => {
    queryClient.refetchQueries({
      queryKey: ["/api/appointments/outlet", selectedOutletId, selectedDate],
      exact: true,
    });

    queryClient.refetchQueries({
      queryKey: ["/api/customers/with-appointments", selectedOutletId, selectedDate],
      exact: true,
    });
  }, [selectedOutletId, selectedDate, queryClient]);


  // Wrappers around the hook methods
  const onMouseEnterCard = useCallback(
    (id: string, card: HTMLElement) => {
      tooltipIdRef.current = id;
      cardElementRef.current = card;

      if (!doesTooltipOverlapHeader(card)) {
        showTooltip(id);
      }
    },
    [showTooltip]
  );

  const onMouseLeaveCard = useCallback(() => {
    hideTooltip();
  }, [hideTooltip]);

  // Helper method for DOM calculation
  const doesTooltipOverlapHeader = (card: HTMLElement): boolean => {
    const cardRect = card.getBoundingClientRect();
    const headerElement = document.querySelector(".sticky.top-0");
    const headerBottom = headerElement?.getBoundingClientRect().bottom || 0;

    return cardRect.top < headerBottom;
  };

  if (showLoading) {
    return <LoadingSpinner />;
  }

  const navigateDate = (direction: "prev" | "next") => {
    const currentDate = new Date(selectedDate);
    const newDate = new Date(currentDate);

    if (direction === "prev") {
      newDate.setDate(currentDate.getDate() - 1);
    } else {
      newDate.setDate(currentDate.getDate() + 1);
    }

    onDateChange(newDate.toISOString().split("T")[0]);
  };

  const getAppointmentsForStaffAndTime = (
    staffId: number,
    timeSlot: string
  ): AppointmentWithDetails[] => {
    // timeSlot => 9:00am etc.
    const hour = parseInt(timeSlot.split(":")[0]);
    const isPM = timeSlot.includes("pm");
    const targetHour =
      isPM && hour !== 12 ? hour + 12 : hour === 12 && !isPM ? 0 : hour;

    return appointmentsWithDetails.filter((appointment) => {
      if (appointment.staffId !== staffId) return false;

      // Parse the appointment.startTime from mock db
      // The type is ISOString (ignore the weird type inference)
      const appointmentStartHour = DateTime.fromISO(appointment.startTime).hour;
      return appointmentStartHour === targetHour;
    });
  };

  const getOtherAppointmentsForStaffAndTime = (
    staffId: number,
    timeSlot: string
  ): AppointmentResponse[] => {
    const hour = parseInt(timeSlot.split(":")[0]);
    const isPM = timeSlot.includes("pm");
    const targetHour =
      isPM && hour !== 12 ? hour + 12 : hour === 12 && !isPM ? 0 : hour;

    return otherAppointments.filter((appointment) => {
      if (appointment.staffId !== staffId) return false;

      const appointmentStartHour = DateTime.fromISO(appointment.startTime).hour;
      return appointmentStartHour === targetHour;
    });
  };

  const getTimeOffsForStaffAndTime = (
    staffId: number,
    timeSlot: string
  ): TimeOffResponse[] => {
    // timeSlot => 9:00am etc.
    const hour = parseInt(timeSlot.split(":")[0]);
    const isPM = timeSlot.includes("pm");
    const targetHour =
      isPM && hour !== 12 ? hour + 12 : hour === 12 && !isPM ? 0 : hour;

    return timeOffs.filter((timeOff) => {
      if (timeOff.staffId !== staffId) return false;

      // We only care about start hour
      const timeOffStartHour = Number(timeOff.startTime.slice(0, 2));
      return timeOffStartHour === targetHour;
    });
  };

  const getBlockedTimesForStaffAndTime = (
    staffId: number,
    timeSlot: string
  ): BlockedTimeResponse[] => {
    // timeSlot => 9:00am etc.
    const hour = parseInt(timeSlot.split(":")[0]);
    const isPM = timeSlot.includes("pm");
    const targetHour =
      isPM && hour !== 12 ? hour + 12 : hour === 12 && !isPM ? 0 : hour;

    return blockedTimes.filter((blockedTime) => {
      if (blockedTime.staffId !== staffId) return false;

      // We only care about start hour
      const blockedTimeStartHour = Number(blockedTime.fromTime.slice(0, 2));
      return blockedTimeStartHour === targetHour;
    });
  };

  // Staff selection
  const toggle = (target: StaffResponse) => {
    setDeselectedStaffIds((prev) => {
      const next = new Set(prev);
      if (next.has(target.id)) {
        next.delete(target.id);
      } else {
        next.add(target.id);
      }
      return next;
    });
  };

  const clearAll = () => {
    setDeselectedStaffIds(new Set(staff.map((s) => s.id)));
  };

  const staffLength = selectedStaff.length;
  const getTooltipSide = (staffIndex: number): "left" | "right" => {
    if (staffIndex === 0 || staffIndex < staffLength - 2) {
      return "right";
    }
    return "left";
  };

  // Styling constants
  // minmax(0, 1fr) -> Shrink down to 0 if needed instead of reverting to content's min-width
  // staffColumnCount lower bounds to 1
  // to prevent the time column from expanding to fill everything momentarily when loading
  const staffColumnCount = Math.max(selectedStaff.length, 1);
  const cols = `69px repeat(${staffColumnCount}, minmax(0, 1fr))`;
  const gridStyle = { gridTemplateColumns: cols };

  return (
    <div className="flex-1 flex flex-col pt-3 px-1 pb-3">
      {/* Calendar Header Controls */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            className="hover:bg-slate-200 focus-visible:ring-offset-transparent focus-visible:ring-0"
            onClick={() => navigateDate("prev")}
          >
            <ChevronLeft className="!w-5 !h-5" />
          </Button>
          <Popover open={isDateOpen} onOpenChange={setIsDateOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className="text-xl font-semibold text-gray-800 px-3 py-2 hover:bg-slate-200"
              >
                <CalendarIcon className="mr-2 h-5 w-5" />
                {new Date(selectedDate).toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                  day: "numeric",
                })}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="p-0">
              <Calendar
                mode="single"
                selected={selectedDate ? new Date(selectedDate) : undefined}
                // When a day is picked, convert to YYYY-MM-DD (your prop contract)
                onSelect={(d) => {
                  if (!d) return;

                  const iso = DateTime.fromJSDate(d as Date).toISODate();
                  if (!iso) return; // bail out if conversion failed

                  onDateChange(iso);
                  setIsDateOpen(false);
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <Button
            variant="ghost"
            className="hover:bg-slate-200 focus-visible:ring-offset-transparent focus-visible:ring-0"
            onClick={() => navigateDate("next")}
          >
            <ChevronRight className="!w-5 !h-5" />
          </Button>
        </div>
        <div className="flex items-center space-x-1">
          {showTeamDropdown && (
            <div className="z-30 absolute inset-0 bg-black/40 pointer-events-none" />
          )}
          {showStaffDropdown != null && (
            <div className="z-30 absolute inset-0 bg-black/40 pointer-events-none" />
          )}

          <DropdownMenu
            open={showTeamDropdown}
            onOpenChange={setShowTeamDropdown}
          >
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="hover:bg-slate-200 focus-visible:ring-offset-transparent focus-visible:ring-0"
              >
                <UsersRound className="!w-5 !h-5" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              className="w-[280px] p-2 pb-4 space-y-2 shadow-[0px_0.5px_8px_rgba(0,0,0,0.12)]"
              sideOffset={8}
              align="end"
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
              <div className="flex justify-between items-center px-2 pt-1 pb-2 border-b border-b-slate-500 text-base font-bold text-gray-800 mb-2.5">
                <span>Team Members</span>
                <button
                  className="text-[0.95rem] font-medium text-indigo-700"
                  onClick={clearAll}
                >
                  Clear All
                </button>
              </div>

              {staff.map((staff) => (
                <div
                  key={staff.email}
                  className="flex items-center height-3 px-2 py-1 hover:bg-gray-200 rounded-md"
                  onClick={() => toggle(staff)}
                >
                  <Checkbox
                    checked={selectedStaff.includes(staff)}
                    className="border-green-600/85 data-[state=checked]:bg-green-600/85 mr-2.5"
                  />
                  <div className="w-9 h-9 rounded-full bg-beauty-purple flex items-center justify-center text-[0.95rem] text-white font-normal mr-2.5">
                    {staff.firstName[0]}
                    {staff.lastName[0]}
                  </div>
                  <div className="text-[0.95rem]">
                    {staff.firstName} {staff.lastName}
                  </div>
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant={viewType === "day" ? "default" : "ghost"}
            onClick={() => setViewType("day")}
            className={cn(
              "hover:bg-emerald-400 text-black text-lg focus-visible:ring-offset-transparent focus-visible:ring-0",
              viewType === "day" ? "bg-emerald-400" : ""
            )}
          >
            Day
          </Button>
          <Button
            variant={viewType === "week" ? "default" : "ghost"}
            onClick={() => setViewType("week")}
            className={cn(
              "hover:bg-emerald-400 text-black text-lg focus-visible:ring-offset-transparent focus-visible:ring-0",
              viewType === "week" ? "bg-emerald-400" : ""
            )}
          >
            Week
          </Button>
        </div>
      </div>

      {/* Day View */}

      {/* Overflow-x-auto on parent -> single horizontal scrollbar
          w-full on staff-header grid and time-row grid
          to ensure they always span the full width of parent container
          min-w-0 + truncate on every grid cell
          to ensure they stay within their cell container, whose width is: (minimax(0, 1fr)) 
      */}
      {/* transform-gpu ensures that fast scrolling on minimal overflow remains fast */}
      {viewType === "day" ? (
        <div
          ref={scrollContainerRef}
          className="overflow-auto rounded-xl scrollbar-hide transform-gpu shadow-md"
          tabIndex={-1}
        >
          {/* Staff Header, sticky fixed */}
          <div className="relative sticky top-0 z-20">
            <div
              className="grid w-full border-b border-slate-500 bg-gray-150"
              style={gridStyle}
            >
              <div className="flex items-center justify-center bg-gray-150 border-r border-gray-400/50 min-w-0 rounded-l-xl min-h-[100px]">
                <span className="text-base font-medium text-gray-800 truncate">
                  Time
                </span>
              </div>

              {selectedStaff.map((staffMember, index) => (
                <DropdownMenu
                  key={staffMember.id}
                  open={showStaffDropdown === staffMember.id}
                  onOpenChange={(isOpen) =>
                    setShowStaffDropdown(isOpen ? staffMember.id : null)
                  }
                >
                  <DropdownMenuTrigger asChild>
                    <div
                      className={cn(
                        "min-w-0 p-3 bg-gray-150 text-center hover:cursor-pointer",
                        index < staff.length - 1
                          ? "border-r border-gray-400/50"
                          : "",
                        index == staff.length - 1 ? "rounded-r-xl" : ""
                      )}
                    >
                      <div className="flex flex-col h-full items-center justify-center height-1">
                        <div className="w-11 h-11 bg-beauty-purple rounded-full flex items-center justify-center hover:bg-beauty-purple-light">
                          <span className="text-white text-[1.0625rem]">
                            {`${staffMember.firstName[0]}${staffMember.lastName[0]}`}
                          </span>
                        </div>

                        <p className="text-base text-gray-800">
                          <span className="block md:inline">
                            {staffMember.firstName}
                          </span>
                          <span className="block md:inline md:ml-1">
                            {staffMember.lastName}
                          </span>
                        </p>
                      </div>
                    </div>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent
                    align="center"
                    sideOffset={8}
                    className="p-2 shadow-[0px_0.5px_8px_rgba(0,0,0,0.15)] bg-white"
                  >
                    <DropdownMenuItem
                      onClick={() => {
                        setBlockedTime(true);
                        setTargetStaff(staffMember);
                      }}
                      className="!text-base !text-slate-800 hover:!bg-gray-200"
                    >
                      Add Blocked Time
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setTimeOff(true);
                        setTargetStaff(staffMember);
                      }}
                      className="!text-base !text-slate-800 hover:!bg-gray-200"
                    >
                      Add Time Off
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setEditShift(true);
                        setTargetStaff(staffMember);
                      }}
                      className="!text-base !text-slate-800 hover:!bg-gray-200"
                    >
                      Edit Shift
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="!text-base !text-emerald-800 hover:!bg-gray-200"
                      onClick={() => {
                        navigate(
                          `/staffs/view?staffId=${staffMember.id}&fromCalendar=true`
                        );
                      }}
                    >
                      View Profile
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ))}
            </div>
          </div>

          {/* Time Rows, scrollable part */}
          <div>
            <div>
              {TIME_OPTIONS.map((timeSlot, timeIndex) => (
                // Each time row acts as a grid container!
                <div
                  key={timeIndex}
                  className="grid w-full border-b-2 border-gray-300 last:border-b-0 bg-white"
                  style={{ ...gridStyle, height: `${CELL_HEIGHT}rem` }}
                >
                  <div className="flex items-start justify-center border-r border-gray-300 bg-white min-w-0">
                    <span
                      className={cn(
                        "text-base font-medium text-gray-800 truncate",
                        // Slight visual offset for the top-most time
                        // For better clarity
                        timeIndex === 0 ? "pt-2" : undefined
                      )}
                    >
                      {formatTimeTo24Hour(timeSlot)}
                    </span>
                  </div>

                  {/* For each time row -> look through the staff */}
                  {selectedStaff.map((staffMember, staffIndex) => {
                    // For each staff -> get their appointments STARTING within this time slot
                    const slotAppointments = getAppointmentsForStaffAndTime(
                      staffMember.id,
                      timeSlot
                    );

                    // These are to be displayed similar to out-of-shift hours
                    const otherAppointments =
                      getOtherAppointmentsForStaffAndTime(
                        staffMember.id,
                        timeSlot
                      );

                    const slotBlockedTimes = getBlockedTimesForStaffAndTime(
                      staffMember.id,
                      timeSlot
                    );

                    const slotTimeOffs = getTimeOffsForStaffAndTime(
                      staffMember.id,
                      timeSlot
                    );

                    // Common information
                    const slotStart = Number(
                      formatTimeTo24Hour(timeSlot).replace(":", "")
                    );
                    const slotEnd = slotStart + 100; // represents 1 hour

                    //    SHIFT PROCESSING    //
                    const staffShift = shifts.find(
                      (shift) => shift.staffId === staffMember.id
                    );

                    // Default to something very big
                    const shiftStart = Number(
                      staffShift?.startTime.replace(":", "") ?? 9999
                    );

                    // Default to something very small
                    const shiftEnd = Number(
                      staffShift?.endTime.replace(":", "") ?? 0
                    );

                    // Height1 -> Height of the gray rect, due to shiftStart
                    // Height2 -> Height of the gray rect, due to shiftEnd
                    const {
                      height1: nonShiftHeight1,
                      height2: nonShiftHeight2,
                    } = displayGrayRectangle(
                      slotStart,
                      slotEnd,
                      shiftStart,
                      shiftEnd
                    );

                    let outOfShiftComponent: JSX.Element | null = null;

                    const nonShiftHeightFraction1 = nonShiftHeight1 / 60;
                    const nonShiftHeightActual1 =
                      nonShiftHeightFraction1 * CELL_HEIGHT;

                    const nonShiftHeightFraction2 = nonShiftHeight2 / 60;
                    const nonShiftHeightActual2 =
                      nonShiftHeightFraction2 * CELL_HEIGHT;

                    outOfShiftComponent = (
                      <GrayRect
                        height1={nonShiftHeight1}
                        height1Actual={nonShiftHeightActual1}
                        height2={nonShiftHeight2}
                        height2Actual={nonShiftHeightActual2}
                        onClick={() => {
                          setTargetStaff(staffMember);
                          setEditShift(true);
                        }}
                      />
                    );

                    // Tooltip render side
                    const tooltipSide = getTooltipSide(staffIndex);

                    return (
                      // For each staff, this div is the grid cell!
                      <div
                        key={staffMember.id}
                        // First line of className -> conditional hovering!
                        className={cn(
                          "hover:bg-slate-200 hover:has-[.appointment:hover]:bg-transparent hover:has-[.time-off:hover]:bg-transparent hover:has-[.blocked-time:hover]:bg-transparent hover:has-[.non-shift:hover]:bg-transparent",
                          "relative min-w-0",
                          "transition-colors duration-100 ease-in-out",
                          staffIndex < staff.length - 1
                            ? "border-r border-b border-gray-300"
                            : ""
                        )}
                        style={{ height: `${CELL_HEIGHT}rem` }}
                        onDragOver={(e) => {
                          if (!draggingAppointmentId) return;
                          e.preventDefault();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (!draggingAppointmentId) return;

                          const appointment = appointmentsWithDetails.find(
                            (a) => a.id === draggingAppointmentId
                          );
                          if (!appointment) return;

                          // Keep same duration
                          const oldStart = DateTime.fromISO(appointment.startTime);
                          const oldEnd = DateTime.fromISO(appointment.endTime);
                          const durationMinutes = oldEnd
                            .diff(oldStart, "minutes")
                            .minutes;

                          const hour = parseInt(timeSlot.split(":")[0], 10);
                          const isPM = timeSlot.includes("pm");
                          const targetHour =
                            isPM && hour !== 12 ? hour + 12 : hour === 12 && !isPM ? 0 : hour;

                          const newStart = DateTime.fromISO(selectedDate, {
                            zone: "Asia/Singapore",
                          }).set({
                            hour: targetHour,
                            minute: 0,
                            second: 0,
                            millisecond: 0,
                          });

                          const newEnd = newStart.plus({ minutes: durationMinutes });

                          rescheduleAppointmentMutation.mutate({
                            id: appointment.id,
                            staffId: staffMember.id,
                            startTime: newStart.toISO()!,
                            endTime: newEnd.toISO()!,
                          });
                        }}
                      >
                        {outOfShiftComponent}

                        {otherAppointments.map((otherAppointment) => {
                          // Tooltip stuff
                          const tooltipId = `other-appointment-${otherAppointment.id}`;
                          const isTooltipVisible =
                            activeTooltipId === tooltipId;

                          // Determine visual start and visual end
                          const otherStart = DateTime.fromISO(
                            otherAppointment.startTime
                          );

                          const otherEnd = DateTime.fromISO(
                            otherAppointment.endTime
                          );

                          const startMinute = otherStart.minute;
                          const yTopOffsetPercentage = (startMinute / 60) * 100;

                          const duration = otherEnd.diff(otherStart, "minutes");
                          const yBottomExtend = (duration ?? 0).minutes / 60;
                          const parentHeight = yBottomExtend * CELL_HEIGHT;

                          const onClick = () => { };

                          const onMouseEnter = (
                            e: React.MouseEvent<HTMLElement, MouseEvent>
                          ) => {
                            return onMouseEnterCard(
                              tooltipId,
                              e.currentTarget as HTMLElement
                            );
                          };

                          const onMouseLeave = onMouseLeaveCard;

                          return (
                            <CardRect
                              key={otherAppointment.id}
                              type={"Other Appointment"}
                              entity={otherAppointment}
                              yTopOffsetPercentage={yTopOffsetPercentage}
                              parentHeight={parentHeight}
                              onClick={onClick}
                              onMouseEnter={onMouseEnter}
                              onMouseLeave={onMouseLeave}
                              isTooltipVisible={isTooltipVisible}
                              tooltipSide={tooltipSide}
                              cardElementRef={cardElementRef}
                              draggable
                              onDragStart={() => setDraggingAppointmentId(appointment.id)}
                              onDragEnd={() => setDraggingAppointmentId(null)}
                            />
                          );
                        })}

                        {slotAppointments.map((appointment) => {
                          // Tooltip stuff
                          const tooltipId = `appointment-${appointment.id}`;
                          const isTooltipVisible =
                            activeTooltipId === tooltipId;

                          // Determine visual start and visual end
                          const apptStart = DateTime.fromISO(
                            appointment.startTime
                          );

                          const apptEnd = DateTime.fromISO(appointment.endTime);

                          const startMinute = apptStart.minute;
                          const yTopOffsetPercentage = (startMinute / 60) * 100;

                          const duration = apptEnd.diff(apptStart, "minutes");
                          const yBottomExtend = (duration ?? 0).minutes / 60;
                          const parentHeight = yBottomExtend * CELL_HEIGHT;

                          const onClick = () => {
                            return onViewAppointment(
                              appointment.customerId,
                              appointment.id
                            );
                          };

                          const onMouseEnter = (
                            e: React.MouseEvent<HTMLElement, MouseEvent>
                          ) => {
                            return onMouseEnterCard(
                              tooltipId,
                              e.currentTarget as HTMLElement
                            );
                          };

                          const onMouseLeave = onMouseLeaveCard;

                          // Get layout information for this appointment
                          const layoutInfo = appointmentLayoutMap.get(
                            appointment.id
                          );
                          return (
                            <CardRect
                              key={appointment.id}
                              type={"Appointment"}
                              entity={appointment}
                              yTopOffsetPercentage={yTopOffsetPercentage}
                              parentHeight={parentHeight}
                              onClick={onClick}
                              onMouseEnter={onMouseEnter}
                              onMouseLeave={onMouseLeave}
                              isTooltipVisible={isTooltipVisible}
                              tooltipSide={tooltipSide}
                              cardElementRef={cardElementRef}
                              widthPercentage={layoutInfo?.widthPercentage}
                              leftOffsetPercentage={layoutInfo?.leftOffsetPercentage}
                              draggable
                              onDragStart={() => setDraggingAppointmentId(appointment.id)}
                              onDragEnd={() => setDraggingAppointmentId(null)}
                            />
                          );
                        })}

                        {slotTimeOffs.map((timeOff) => {
                          // Tooltip stuff
                          const tooltipId = `time-offs-${timeOff.id}`;
                          const isTooltipVisible =
                            activeTooltipId === tooltipId;

                          // Establish start and end times in DT
                          const startTime = DateTime.fromISO(
                            `${selectedDate}T${timeOff.startTime}`
                          );
                          const endTime = DateTime.fromISO(
                            `${selectedDate}T${timeOff.endTime}`
                          );

                          // Determine visual start
                          const startMinute = startTime.minute;
                          const yTopOffsetPercentage = (startMinute / 60) * 100;

                          // Determine visual end
                          const duration = endTime.diff(
                            startTime,
                            "minutes"
                          ).minutes;
                          const yBottomExtend = (duration ?? 0) / 60;
                          const parentHeight = yBottomExtend * CELL_HEIGHT;

                          const onClick = () => {
                            setTimeOffId(timeOff.id);
                            setTimeOff(true);
                            setTargetStaff(staffMember);
                          };

                          const onMouseEnter = (
                            e: React.MouseEvent<HTMLElement, MouseEvent>
                          ) => {
                            return onMouseEnterCard(
                              tooltipId,
                              e.currentTarget as HTMLElement
                            );
                          };

                          const onMouseLeave = onMouseLeaveCard;

                          return (
                            <CardRect
                              key={timeOff.id}
                              type={"Time Off"}
                              entity={timeOff}
                              yTopOffsetPercentage={yTopOffsetPercentage}
                              parentHeight={parentHeight}
                              onClick={onClick}
                              onMouseEnter={onMouseEnter}
                              onMouseLeave={onMouseLeave}
                              isTooltipVisible={isTooltipVisible}
                              tooltipSide={tooltipSide}
                              cardElementRef={cardElementRef}
                            />
                          );
                        })}

                        {slotBlockedTimes.map((blockedTime) => {
                          const tooltipId = `blocked-time-${blockedTime.id}`;
                          const isTooltipVisible =
                            activeTooltipId === tooltipId;

                          // Establish start and end times in DT
                          const startTime = DateTime.fromISO(
                            `${selectedDate}T${blockedTime.fromTime}`
                          );
                          const endTime = DateTime.fromISO(
                            `${selectedDate}T${blockedTime.toTime}`
                          );

                          // Determine visual start
                          const startMinute = startTime.minute;
                          const yTopOffsetPercentage = (startMinute / 60) * 100;

                          // Determine visual end
                          const duration = endTime.diff(
                            startTime,
                            "minutes"
                          ).minutes;
                          const yBottomExtend = (duration ?? 0) / 60;
                          const parentHeight = yBottomExtend * CELL_HEIGHT;

                          const onClick = () => {
                            setBlockedTimeId(blockedTime.id);
                            setBlockedTime(true);
                            setTargetStaff(staffMember);
                          };

                          const onMouseEnter = (
                            e: React.MouseEvent<HTMLElement, MouseEvent>
                          ) => {
                            return onMouseEnterCard(
                              tooltipId,
                              e.currentTarget as HTMLElement
                            );
                          };

                          const onMouseLeave = onMouseLeaveCard;

                          return (
                            <CardRect
                              key={blockedTime.id}
                              type={"Blocked Time"}
                              entity={blockedTime}
                              yTopOffsetPercentage={yTopOffsetPercentage}
                              parentHeight={parentHeight}
                              onClick={onClick}
                              onMouseEnter={onMouseEnter}
                              onMouseLeave={onMouseLeave}
                              isTooltipVisible={isTooltipVisible}
                              tooltipSide={tooltipSide}
                              cardElementRef={cardElementRef}
                            />
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))}

              {staff.length === 0 && (
                <div className="p-8 text-xl flex-1 flex-col items-center justify-center text-center text-gray-600">
                  <Frown className="self-center mx-auto w-11 h-11 text-slate-500 mb-2.5" />
                  <p>No staff members found for this outlet</p>
                </div>
              )}
            </div>
          </div>

          {/* Target staff is the staff involved in the staff actions */}
          {targetStaff && (
            <>
              <ShiftModal
                isOpen={editShift}
                onClose={() => {
                  setEditShift(false);
                }}
                staff={targetStaff}
                shiftDate={selectedDate}
              />

              <BlockedTimeModal
                isOpen={blockedTime}
                onClose={() => {
                  setBlockedTimeId(-1);
                  setBlockedTime(false);
                }}
                staff={targetStaff}
                shiftDate={selectedDate}
                blockedTimeId={blockedTimeId}
              />

              <TimeOffModal
                isOpen={timeOff}
                onClose={() => {
                  setTimeOffId(-1);
                  setTimeOff(false);
                }}
                staff={targetStaff}
                shiftDate={selectedDate}
                timeOffId={timeOffId}
              />
            </>
          )}
        </div>
      ) : (
        /* Week View */
        <WeekView
          selectedOutletId={selectedOutletId}
          selectedDate={selectedDate}
          onViewAppointment={onViewAppointment}
        />
      )}
    </div>
  );
}
