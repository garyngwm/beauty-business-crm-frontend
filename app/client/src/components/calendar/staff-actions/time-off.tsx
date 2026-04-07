import { useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { DateTime } from "luxon";
import { toastManager } from "@/components/shared/toast-manager";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/dialog";
import { Button } from "~/button";
import { Textarea } from "~/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/select";
import { Label } from "~/label";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/form";
import { generateTimeOptions } from "@/lib/utils/date-processing";
import { getBusinessWindow } from "@/lib/utils/business-hours";
import { DatePicker } from "@/components/shared/date-picker";
import { cn } from "@/lib/utils/date-processing";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import {
  formatTimeTo24Hour,
  formatTimeTo12Hour,
} from "@/lib/utils/date-processing";
import { apiRequest } from "@/lib/query-client";
import { Trash2 } from "lucide-react";
import LoadingSpinner from "@/components/shared/loading-spinner";
import { useMinimumLoadingTime } from "@/hooks/use-min-loading";
import { MIN_LOADING } from "@/lib/constants";
import { getErrorDescription } from "@/lib/utils/misc";

import { StaffResponse } from "@/lib/types/staff/staff";
import {
  timeOffSchema,
  type TimeOffFormData,
  type TimeOffUpsert,
  type TimeOffResponse,
} from "@/lib/types/staff/time-off";

interface TimeOffProps {
  isOpen: boolean;
  onClose: () => void;
  staff: StaffResponse;
  shiftDate: string;
  timeOffId: number;
}

export default function TimeOff({
  isOpen,
  onClose,
  staff,
  shiftDate,
  timeOffId,
}: TimeOffProps) {
  const TIME_OPTIONS = useMemo(() => {
    const shiftDT = DateTime.fromISO(shiftDate).setZone("Asia/Singapore");
    const { opening, closing } = getBusinessWindow(shiftDT);
    return generateTimeOptions(opening, closing, 30);
  }, [shiftDate]);

  const form = useForm<TimeOffFormData>({
    resolver: zodResolver(timeOffSchema),
    defaultValues: {
      type: undefined,
      startDate: undefined,
      startTime: undefined,
      endTime: undefined,
      frequency: undefined,
      endsDate: undefined,
      description: undefined,
      approved: false,
    },
  });

  // Edit mode
  const isEditMode = timeOffId !== -1;

  // Fetch the timeOff to edit
  const { data: timeOff, isLoading: isTimeOffLoading } =
    useQuery<TimeOffResponse>({
      queryKey: ["/api/time-offs", timeOffId],
      enabled: isEditMode,
      queryFn: () => apiRequest("GET", `/api/time-offs/${timeOffId}`),
    });

  useEffect(() => {
    // Proper reset
    if (!isOpen) {
      form.reset({
        type: undefined,
        startDate: undefined,
        startTime: undefined,
        endTime: undefined,
        frequency: undefined,
        endsDate: undefined,
        description: undefined,
        approved: false,
      });
      return;
    }

    if (isEditMode && timeOff) {
      // Pre-seeded everything
      form.reset({
        type: timeOff.type,
        startDate: timeOff.startDate,
        startTime: formatTimeTo12Hour(timeOff.startTime),
        endTime: formatTimeTo12Hour(timeOff.endTime),
        frequency: timeOff.frequency,
        endsDate: timeOff.endsDate ?? undefined,
        description: timeOff.description ?? undefined,
        approved: timeOff.approved,
      });
    } else {
      // Nothing
      form.reset({
        type: undefined,
        startDate: undefined,
        startTime: undefined,
        endTime: undefined,
        frequency: undefined,
        endsDate: undefined,
        description: undefined,
        approved: false,
      });
    }
  }, [timeOff, isEditMode, isOpen]);

  const showLoading = useMinimumLoadingTime(isTimeOffLoading);

  // live watches
  const startDate = form.watch("startDate");
  const startTime = form.watch("startTime");
  const endTime = form.watch("endTime");
  const frequency = form.watch("frequency");

  // compute hours (nearest 1dp)
  // startDate -> YYYY-MM-DD format
  // startTime and endTime -> 1:30pm format
  const totalHours = useMemo(() => {
    if (!startDate || !startTime || !endTime) return 0;

    const dtStart = DateTime.fromFormat(
      `${startDate} ${startTime}`,
      "yyyy-MM-dd h:mma",
      { zone: "Asia/Singapore" }
    );
    const dtEnd = DateTime.fromFormat(
      `${startDate} ${endTime}`,
      "yyyy-MM-dd h:mma",
      { zone: "Asia/Singapore" }
    );

    if (!dtStart.isValid || !dtEnd.isValid) {
      console.warn(
        "Invalid date/time parse:",
        dtStart.invalidReason,
        dtEnd.invalidReason
      );
      return 0;
    }

    const diff = dtEnd.diff(dtStart, "hours").hours;
    return diff > 0 ? Math.round(diff * 10) / 10 : 0;
  }, [startDate, startTime, endTime]);

  const queryClient = useQueryClient();

  // Mutations
  const upsertTimeOffMutation = useMutation({
    mutationFn: (data: TimeOffFormData) => {
      // Augment the payload with staffId and duration (not from form)
      const payload: TimeOffUpsert = {
        ...data,
        staffId: staff.id,
        duration: totalHours,

        // Convert to expected format to pass backend validation
        startTime: formatTimeTo24Hour(data.startTime),
        endTime: formatTimeTo24Hour(data.endTime),
      };

      const url = isEditMode ? `/api/time-offs/${timeOffId}` : "/api/time-offs";
      return apiRequest("PUT", url, payload);
    },
    onSuccess: async (serverResponse: string) => {
      const action = isEditMode ? "updated" : "created";
      const title = `Time-off ${action}`;

      const minDelayPromise = new Promise((resolve) =>
        setTimeout(resolve, MIN_LOADING)
      );

      const invalidatePromises = Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/time-offs"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/time-offs/outlet"] }),
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
      const action = isEditMode ? "update" : "create";
      const title = `Time-off ${action} failed`;
      const description = getErrorDescription(error.message);

      toastManager({
        title: title,
        description: description,
        status: "failure",
      });
    },
  });

  const showPendingUpsert = useMinimumLoadingTime(
    upsertTimeOffMutation.isPending
  );

  const deleteTimeOffMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/time-offs/${timeOffId}`),

    onSuccess: async (serverResponse: string) => {
      const title = "Time off deleted";

      const minDelayPromise = new Promise((resolve) =>
        setTimeout(resolve, MIN_LOADING)
      );

      const invalidatePromises = Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/time-offs"] }),
        queryClient.invalidateQueries({
          queryKey: ["/api/time-offs/outlet"],
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
      const title = `Time off delete failed`;
      const description = getErrorDescription(error.message);

      toastManager({
        title: title,
        description: description,
        status: "failure",
      });
    },
  });

  // Submit button calls this
  // Initiates the submission process
  const onSubmit = (data: TimeOffFormData) => {
    upsertTimeOffMutation.mutate(data);
  };

  const onDelete = () => {
    if (confirm("Are you sure you want to delete this time-off?")) {
      deleteTimeOffMutation.mutate();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto p-8">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-slate-800 flex items-center">
            <div>{staff.firstName}&apos;s Time Off</div>
            {isEditMode ? (
              <div
                className="p-2 rounded-md hover:bg-slate-200 flex items-center justify-center mb-1 ml-1.5 cursor-pointer"
                onClick={onDelete}
              >
                <Trash2 className="w-5 h-5 text-red-500 " />
              </div>
            ) : undefined}
          </DialogTitle>
        </DialogHeader>

        {isEditMode && showLoading ? (
          <LoadingSpinner />
        ) : (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-6 text-base text-slate-800"
            >
              {/* Type */}
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-600/93 font-semibold">
                      Type
                    </FormLabel>
                    <FormControl>
                      <Select
                        onValueChange={(value) => field.onChange(value)}
                        value={field.value}
                      >
                        <SelectTrigger
                          className={cn(
                            "w-full text-base py-5",
                            "focus:outline-none focus:ring-0",
                            "active:bg-transparent active:shadow-none",
                            field.value ? "!text-slate-800" : "!text-slate-400",

                            // Make the chevron down always this color
                            "[&>svg]:text-slate-900"
                          )}
                        >
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent
                          sideOffset={8}
                          className="border border-slate-500 shadow-[0px_0.5px_8px_rgba(0,0,0,0.15)]"
                        >
                          <SelectItem
                            value="Annual leave"
                            className="!text-base !text-slate-800 hover:!bg-slate-200"
                          >
                            Annual leave
                          </SelectItem>
                          <SelectItem
                            value="Sick leave"
                            className="!text-base !text-slate-800 hover:!bg-slate-200"
                          >
                            Sick leave
                          </SelectItem>
                          <SelectItem
                            value="Personal"
                            className="!text-base !text-slate-800 hover:!bg-slate-200"
                          >
                            Personal
                          </SelectItem>
                          <SelectItem
                            value="Other"
                            className="!text-base !text-slate-800 hover:!bg-slate-200"
                          >
                            Other
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Start date / Start time / End time */}
              <div className="grid grid-cols-[2.15fr_1fr_1fr] gap-4">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-600/93 font-semibold">
                        Start Date
                      </FormLabel>
                      <FormControl>
                        <DatePicker
                          value={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="startTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-600/93 font-semibold">
                        Start Time
                      </FormLabel>
                      <FormControl className="min-w-0">
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger
                            className={cn(
                              "w-full text-base py-5",
                              field.value
                                ? "!text-slate-800"
                                : "!text-slate-400",
                              "[&>svg]:text-slate-900"
                            )}
                          >
                            <SelectValue placeholder="12:00am" />
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
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-600/93 font-semibold">
                        End Time
                      </FormLabel>
                      <FormControl className="min-w-0">
                        <Select
                          value={field.value}
                          onValueChange={(val) => field.onChange(val)}
                        >
                          <SelectTrigger
                            className={cn(
                              "w-full text-base py-5",
                              field.value
                                ? "!text-slate-800"
                                : "!text-slate-400",
                              "[&>svg]:text-slate-900"
                            )}
                          >
                            <SelectValue placeholder="12:00am" />
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
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Frequency */}
              <FormField
                control={form.control}
                name="frequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-600/93 font-semibold">
                      Frequency
                    </FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={(val) => field.onChange(val)}
                      >
                        <SelectTrigger
                          className={cn(
                            "w-full text-base py-5",
                            field.value ? "!text-slate-800" : "!text-slate-400",
                            "[&>svg]:text-slate-900"
                          )}
                        >
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                        <SelectContent
                          sideOffset={8}
                          className="border border-slate-500 shadow-[0px_0.5px_8px_rgba(0,0,0,0.15)]"
                        >
                          <SelectItem
                            value="None"
                            className="!text-base !text-slate-800 hover:!bg-slate-200"
                          >
                            Doesn&apos;t repeat
                          </SelectItem>
                          <SelectItem
                            value="Repeat"
                            className="!text-base !text-slate-800 hover:!bg-slate-200"
                          >
                            Repeat
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Ends Date */}
              {frequency === "Repeat" && (
                <FormField
                  control={form.control}
                  name="endsDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-600/93 font-semibold">
                        Until
                      </FormLabel>
                      <FormControl>
                        <DatePicker
                          value={field.value ?? ""}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-slate-600/93 font-semibold">
                        Notes (Optional)
                      </FormLabel>
                      <p className="text-sm text-purple-700 mr-1">
                        {field.value?.length || 0} / 255
                      </p>
                    </div>

                    <FormControl>
                      <Textarea
                        className="resize-none !text-base placeholder:text-base placeholder:text-slate-400"
                        rows={3}
                        placeholder="Add notes"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Approved */}
              <FormField
                control={form.control}
                name="approved"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-2 !mt-4">
                    <FormControl>
                      <input
                        id="approved-checkbox"
                        type="checkbox"
                        checked={field.value}
                        onChange={(e) => field.onChange(e.target.checked)}
                        className="h-4 w-4 accent-green-600"
                      />
                    </FormControl>
                    <Label
                      className="text-slate-800 text-[0.95rem]"
                      // So clicking this toggles the checkbox as well
                      htmlFor="approved-checkbox"
                    >
                      Approved
                    </Label>
                  </FormItem>
                )}
              />

              {/* Extra Info */}
              <div className="text-[0.95rem] text-slate-800">
                <p>
                  Time off total:{" "}
                  <span className="text-purple-500 font-semibold">
                    {totalHours}h
                  </span>
                </p>
                <p className="text-sm text-gray-500">
                  Online bookings cannot be placed during time off.
                </p>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onClose}
                  className="text-base hover:bg-slate-200"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-beauty-purple hover:bg-beauty-purple-light text-base"
                  disabled={showPendingUpsert}
                >
                  {showPendingUpsert ? "Saving…" : "Save"}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
