import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/dialog";
import { Button } from "~/button";
import { useState, useMemo, useEffect } from "react";
import { generateTimeOptions } from "@/lib/utils/date-processing";
import { getBusinessWindow } from "@/lib/utils/business-hours";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/select";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  formatTimeTo12Hour,
  formatTimeTo24Hour,
  isBefore,
  formatDateToDayLabel,
} from "@/lib/utils/date-processing";
import { toastManager } from "@/components/shared/toast-manager";
import { DateTime } from "luxon";
import { cn } from "@/lib/utils/date-processing";
import { useMinimumLoadingTime } from "@/hooks/use-min-loading";
import LoadingSpinner from "@/components/shared/loading-spinner";
import { CalendarIcon } from "lucide-react";
import { MIN_LOADING } from "@/lib/constants";
import { apiRequest } from "@/lib/query-client";
import { getErrorDescription } from "@/lib/utils/misc";

import { type StaffResponse } from "@/lib/types/staff/staff";
import { type ShiftResponse, type ShiftUpsert } from "@/lib/types/staff/shift";

interface ShiftViewProps {
  isOpen: boolean;
  onClose: () => void;
  staff: StaffResponse;
  shiftDate: string; // YYYY-MM-DD
}

export default function ShiftView({
  isOpen,
  onClose,
  staff,
  shiftDate,
}: ShiftViewProps) {
  // Establish important constants
  const TIME_OPTIONS = useMemo(() => {
    const shiftDT = DateTime.fromISO(shiftDate).setZone("Asia/Singapore");
    const { opening, closing } = getBusinessWindow(shiftDT);

    return generateTimeOptions(opening, closing, 30);
  }, [shiftDate]);

  // Fetch data and fill into local state
  const queryClient = useQueryClient();

  const { data: shift, isLoading: isShiftLoading } = useQuery<ShiftResponse>({
    queryKey: ["/api/shifts", staff.id, shiftDate],
    queryFn: () =>
      apiRequest("GET", `/api/shifts/staff/${staff.id}/${shiftDate}`),

    enabled: !!staff.id && !!shiftDate,
  });

  const showLoading = useMinimumLoadingTime(isShiftLoading);

  // State for controlled selects
  const [startTime, setStartTime] = useState<string | null>(null);
  const [endTime, setEndTime] = useState<string | null>(null);

  // Computed default start and end times
  const defaults = useMemo(() => {
    if (!shift?.startTime || !shift?.endTime) return { start: null, end: null };
    return {
      start: formatTimeTo12Hour(shift.startTime),
      end: formatTimeTo12Hour(shift.endTime),
    };
  }, [shift?.startTime, shift?.endTime]);

  useEffect(() => {
    if (!isOpen) {
      // Proper reset
      setStartTime(null);
      setEndTime(null);
      return;
    }

    // Whenever start and/or end time changes
    // We reseed the display values
    setStartTime(defaults.start);
    setEndTime(defaults.end);
  }, [isOpen, defaults.start, defaults.end]);

  // Upsert
  const upsertShift = useMutation({
    mutationFn: (payload: { startTime: string; endTime: string }) => {
      const url = shift ? `/api/shifts/${shift.id}` : "/api/shifts";

      const data: ShiftUpsert = {
        staffId: staff.id,
        startTime: payload["startTime"],
        endTime: payload["endTime"],
        shiftDate: shiftDate,
      };

      return apiRequest("PUT", url, data);
    },
    onSuccess: async (serverResponse: string) => {
      const title = "Shift updated";

      const minDelayPromise = new Promise((resolve) =>
        setTimeout(resolve, MIN_LOADING)
      );

      const invalidatePromises = Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["/api/shifts"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["/api/shifts/staff"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["/api/shifts/outlet"],
        }),
      ]);

      await Promise.all([minDelayPromise, invalidatePromises]);

      toastManager({
        title: title,
        description: serverResponse,
        status: "success",
      });

      onClose();
    },
    onError: (error) => {
      const title = `Shift update failed`;
      const description = getErrorDescription(error.message);

      toastManager({
        title: title,
        description: description,
        status: "failure",
      });
    },
  });

  const showPendingUpsert = useMinimumLoadingTime(upsertShift.isPending);

  const [startError, setStartError] = useState("");
  const [endError, setEndError] = useState("");
  const hasError = startError || endError;

  const validateValues = (start: string | null, end: string | null) => {
    const errors = { start: "", end: "" };

    if (!start) {
      errors.start = "Required";
    }

    if (!end) {
      errors.end = "Required";
    }

    if (start && end && !isBefore(start, end)) {
      errors.start = "Must be before end time";
    }

    return errors;
  };

  const handleSave = () => {
    const errors = validateValues(startTime, endTime);
    setStartError(errors.start);
    setEndError(errors.end);

    // If there are any errors, don't proceed
    if (errors.start || errors.end) {
      return;
    }

    // Perform the update
    upsertShift.mutate({
      startTime: formatTimeTo24Hour(startTime as string),
      endTime: formatTimeTo24Hour(endTime as string),
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-slate-800">
            <div>{staff.firstName}&apos;s Shift </div>
            <div className="flex items-center gap-1.5 mt-1 text-lg font-medium text-slate-600">
              <CalendarIcon className="w-5 h-5" />
              {formatDateToDayLabel(shiftDate)}
            </div>
          </DialogTitle>
        </DialogHeader>

        {showLoading ? (
          <LoadingSpinner />
        ) : (
          <div className="space-y-4 mt-2.5">
            <div>
              {/* Start and end time fields */}
              <div className="relative flex items-center gap-4">
                {/* Start time */}
                <div className="w-full">
                  <label className="block text-sm font-semibold text-slate-600/93 mb-[2px]">
                    Start Time
                  </label>
                  <Select
                    value={startTime ?? undefined}
                    onValueChange={(value) => {
                      setStartTime(value);
                      // Validate both values when start time changes
                      const errors = validateValues(value, endTime);
                      setStartError(errors.start);
                      setEndError(errors.end);
                    }}
                  >
                    <SelectTrigger
                      className={cn(
                        "w-full text-base py-5",
                        startTime ? "!text-slate-800" : "!text-slate-400",
                        "[&>svg]:text-slate-900"
                      )}
                    >
                      <SelectValue
                        placeholder={
                          DateTime.fromISO(shiftDate).weekday > 5
                            ? "10:00am"
                            : "11:00am"
                        }
                      />
                    </SelectTrigger>

                    <SelectContent
                      sideOffset={8}
                      className="
                      bg-white
                      border border-slate-500
                      rounded-md
                      shadow-[0px_0.5px_8px_rgba(0,0,0,0.15)]
                      overflow-auto
                      max-h-60
                    "
                    >
                      {TIME_OPTIONS.map((option) => (
                        <SelectItem
                          key={option}
                          value={option}
                          className="!text-base !text-slate-800 hover:!bg-slate-200"
                        >
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {hasError && (
                    <p
                      className={cn(
                        "text-sm text-red-500 mt-1",
                        startError ? "opacity-100" : "opacity-0"
                      )}
                    >
                      {startError || "test"}
                    </p>
                  )}
                </div>

                {/* Dash separator */}
                <div
                  className={cn(
                    "flex items-center justify-between text-lg font-medium text-slate-600/93",
                    startError || endError ? "pb-3" : "pt-5"
                  )}
                >
                  -
                </div>

                {/* End time */}
                <div className="w-full">
                  <label className="block text-sm font-semibold text-slate-600/93 mb-[2px]">
                    End Time
                  </label>
                  <Select
                    value={endTime ?? undefined}
                    onValueChange={(value) => {
                      setEndTime(value);
                      // Validate both values when end time changes
                      const errors = validateValues(startTime, value);
                      setStartError(errors.start);
                      setEndError(errors.end);
                    }}
                  >
                    <SelectTrigger
                      className={cn(
                        "w-full text-base py-5",
                        endTime ? "!text-slate-800" : "!text-slate-400",
                        "[&>svg]:text-slate-900"
                      )}
                    >
                      <SelectValue
                        placeholder={
                          DateTime.fromISO(shiftDate).weekday > 5
                            ? "7:00pm"
                            : "8:00pm"
                        }
                      />
                    </SelectTrigger>

                    <SelectContent
                      sideOffset={8}
                      className="
                      bg-white
                      border border-slate-500
                      rounded-md
                      shadow-[0px_0.5px_8px_rgba(0,0,0,0.15)]
                      overflow-auto
                      max-h-60
                      w-full
                    "
                    >
                      {TIME_OPTIONS.map((option) => (
                        <SelectItem
                          key={option}
                          value={option}
                          className="!text-base !text-slate-800 hover:!bg-slate-200"
                        >
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {hasError && (
                    <p
                      className={cn(
                        "text-sm text-red-500 mt-1",
                        endError ? "opacity-100" : "opacity-0"
                      )}
                    >
                      {endError || "test"}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <p className="text-[0.95rem] text-gray-600">
              Click here to{" "}
              <a href="#" className="text-purple-700 underline">
                view all shifts
              </a>
              .
            </p>

            <div className="flex justify-end gap-2 ml-auto pt-4">
              <Button
                variant="ghost"
                onClick={onClose}
                className="text-base hover:bg-slate-200"
              >
                Cancel
              </Button>
              <Button
                className="bg-beauty-purple hover:bg-beauty-purple-light text-white text-base"
                disabled={showPendingUpsert}
                onClick={handleSave}
              >
                {" "}
                {showPendingUpsert ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
