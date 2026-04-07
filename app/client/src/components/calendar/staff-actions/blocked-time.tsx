import { useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/dialog";
import { Button } from "~/button";
import { Input } from "~/input";
import { Textarea } from "~/textarea";
import { Label } from "~/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/form";
import { DatePicker } from "@/components/shared/date-picker";
import { cn } from "@/lib/utils/date-processing";
import { DateTime } from "luxon";
import { getBusinessWindow } from "@/lib/utils/business-hours";
import { generateTimeOptions } from "@/lib/utils/date-processing";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import {
  formatTimeTo24Hour,
  formatTimeTo12Hour,
} from "@/lib/utils/date-processing";
import { apiRequest } from "@/lib/query-client";
import { toastManager } from "@/components/shared/toast-manager";
import { useQuery } from "@tanstack/react-query";
import LoadingSpinner from "@/components/shared/loading-spinner";
import { useMinimumLoadingTime } from "@/hooks/use-min-loading";
import { Trash2 } from "lucide-react";
import { MIN_LOADING } from "@/lib/constants";
import { getErrorDescription } from "@/lib/utils/misc";

import { StaffResponse } from "@/lib/types/staff/staff";
import {
  blockedTimeSchema,
  type BlockedTimeFormData,
  type BlockedTimeUpsert,
  type BlockedTimeResponse,
} from "@/lib/types/staff/blocked-time";

interface BlockedTimeProps {
  isOpen: boolean;
  onClose: () => void;
  staff: StaffResponse;
  shiftDate: string;
  blockedTimeId: number;
}

export default function BlockedTime({
  isOpen,
  onClose,
  staff,
  shiftDate,
  blockedTimeId,
}: BlockedTimeProps) {
  const TIME_OPTIONS = useMemo(() => {
    const shiftDT = DateTime.fromISO(shiftDate).setZone("Asia/Singapore");
    const { opening, closing } = getBusinessWindow(shiftDT);
    return generateTimeOptions(opening, closing, 30);
  }, [shiftDate]);

  const form = useForm<BlockedTimeFormData>({
    resolver: zodResolver(blockedTimeSchema),
    defaultValues: {
      title: undefined,
      startDate: undefined,
      fromTime: undefined,
      toTime: undefined,
      frequency: undefined,
      ends: undefined,
      endsOnDate: undefined,
      endsAfterOccurrences: undefined,
      description: undefined,
      approved: false,
    },
  });

  // Edit mode
  const isEditMode = blockedTimeId !== -1;

  // Fetch the blocked time to edit
  const { data: blockedTime, isLoading: isBlockedTimeLoading } =
    useQuery<BlockedTimeResponse>({
      queryKey: ["/api/blocked-times", blockedTimeId],
      enabled: isEditMode,
      queryFn: () => apiRequest("GET", `/api/blocked-times/${blockedTimeId}`),
    });

  useEffect(() => {
    // Proper reset
    if (!isOpen) {
      form.reset({
        title: undefined,
        startDate: undefined,
        fromTime: undefined,
        toTime: undefined,
        frequency: undefined,
        ends: undefined,
        endsOnDate: undefined,
        endsAfterOccurrences: undefined,
        description: undefined,
        approved: false,
      });
      return;
    }

    if (isEditMode && blockedTime) {
      // Pre-seeded everything
      form.reset({
        title: blockedTime.title,
        startDate: blockedTime.startDate,
        fromTime: formatTimeTo12Hour(blockedTime.fromTime),
        toTime: formatTimeTo12Hour(blockedTime.toTime),
        frequency: blockedTime.frequency,
        ends: blockedTime.ends ?? undefined,
        endsOnDate: blockedTime.endsOnDate ?? undefined,
        endsAfterOccurrences: blockedTime.endsAfterOccurrences ?? undefined,
        description: blockedTime.description ?? undefined,
        approved: blockedTime.approved,
      });
    } else {
      // Nothing
      form.reset({
        title: undefined,
        startDate: undefined,
        fromTime: undefined,
        toTime: undefined,
        frequency: undefined,
        ends: undefined,
        endsOnDate: undefined,
        endsAfterOccurrences: undefined,
        description: undefined,
        approved: false,
      });
    }
  }, [blockedTime, isEditMode, isOpen]);

  const showLoading = useMinimumLoadingTime(isBlockedTimeLoading);

  // live-watch for conditionals
  const freq = form.watch("frequency");
  const ends = form.watch("ends");

  // Mutations
  const queryClient = useQueryClient();

  const upsertBlockedTimeMutation = useMutation({
    mutationFn: (data: BlockedTimeFormData) => {
      // Augment the payload with staffId (not from form)
      const payload: BlockedTimeUpsert = {
        ...data,
        staffId: staff.id,

        // Convert to expected format to pass backend validation
        fromTime: formatTimeTo24Hour(data.fromTime),
        toTime: formatTimeTo24Hour(data.toTime),
      };

      const url = isEditMode
        ? `/api/blocked-times/${blockedTimeId}`
        : "/api/blocked-times";

      return apiRequest("PUT", url, payload);
    },
    onSuccess: async (serverResponse: string) => {
      const action = isEditMode ? "updated" : "created";
      const title = `Blocked time ${action}`;

      const minDelayPromise = new Promise((resolve) =>
        setTimeout(resolve, MIN_LOADING)
      );

      const invalidatePromises = Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/blocked-times"] }),
        queryClient.invalidateQueries({
          queryKey: ["/api/blocked-times/outlet"],
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
      const action = isEditMode ? "update" : "create";
      const title = `Blocked time ${action} failed`;
      const description = getErrorDescription(error.message);

      toastManager({
        title: title,
        description: description,
        status: "failure",
      });
    },
  });

  const showPendingUpsert = useMinimumLoadingTime(
    upsertBlockedTimeMutation.isPending
  );

  const deleteBlockedTimeMutation = useMutation({
    mutationFn: () =>
      apiRequest("DELETE", `/api/blocked-times/${blockedTimeId}`),

    onSuccess: async (serverResponse: string) => {
      const minDelayPromise = new Promise((resolve) =>
        setTimeout(resolve, MIN_LOADING)
      );

      const invalidatePromises = Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/blocked-times"] }),
        queryClient.invalidateQueries({
          queryKey: ["/api/blocked-times/outlet"],
        }),
      ]);

      await Promise.all([minDelayPromise, invalidatePromises]);

      toastManager({
        title: "Blocked time deleted",
        description: serverResponse,
        status: "success",
      });

      onClose();
    },

    onError: (error) => {
      const title = `Blocked time delete failed`;
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
  const onSubmit = (data: BlockedTimeFormData) => {
    upsertBlockedTimeMutation.mutate(data);
  };

  const onDelete = () => {
    if (confirm("Are you sure you want to delete this time-off?")) {
      deleteBlockedTimeMutation.mutate();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto p-8">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-slate-800 flex items-center">
            <div>{staff.firstName}&apos;s Blocked Time</div>
            {isEditMode ? (
              <div
                className="p-2 rounded-md hover:bg-slate-200 flex items-center justify-center mb-1 ml-1.5 cursor-pointer"
                onClick={onDelete}
              >
                <Trash2 className="w-5 h-5 text-red-500" />
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
              {/* Title */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-600/93 font-semibold">
                      Title
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Lunch break"
                        {...field}
                        className="py-5 text-slate-800 placeholder:text-slate-400 !text-base focus:border-[color:hsl(var(--beauty-purple))]"
                      />
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
                  name="fromTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-600/93 font-semibold">
                        From
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
                  name="toTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-600/93 font-semibold">
                        To
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
                        onValueChange={field.onChange}
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
                          <SelectItem
                            value="None"
                            className="!text-base !text-slate-800 hover:!bg-slate-200"
                          >
                            Doesn&apos;t repeat
                          </SelectItem>
                          <SelectItem
                            value="Daily"
                            className="!text-base !text-slate-800 hover:!bg-slate-200"
                          >
                            Daily
                          </SelectItem>
                          <SelectItem
                            value="Weekly"
                            className="!text-base !text-slate-800 hover:!bg-slate-200"
                          >
                            Weekly
                          </SelectItem>
                          <SelectItem
                            value="Monthly"
                            className="!text-base !text-slate-800 hover:!bg-slate-200"
                          >
                            Monthly
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Ends */}
              {freq !== "None" && freq !== undefined && (
                <FormField
                  control={form.control}
                  name="ends"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-600/93 font-semibold">
                        Ends
                      </FormLabel>
                      <FormControl>
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
                            <SelectValue placeholder="Select ending" />
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
                            <SelectItem
                              value="Never"
                              className="!text-base !text-slate-800 hover:!bg-slate-200"
                            >
                              Never
                            </SelectItem>
                            <SelectItem
                              value="On date"
                              className="!text-base !text-slate-800 hover:!bg-slate-200"
                            >
                              On specific date
                            </SelectItem>
                            <SelectItem
                              value="After"
                              className="!text-base !text-slate-800 hover:!bg-slate-200"
                            >
                              After
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {freq !== "None" && ends === "On date" && (
                <FormField
                  control={form.control}
                  name="endsOnDate"
                  render={({ field }) => (
                    <FormItem className="!mt-4">
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
              )}
              {freq !== "None" && ends === "After" && (
                <FormField
                  control={form.control}
                  name="endsAfterOccurrences"
                  render={({ field }) => (
                    <FormItem className="!mt-4">
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          placeholder="5 (occurences)"
                          className="py-5 text-slate-800 placeholder:text-slate-400 !text-base focus:border-[color:hsl(var(--beauty-purple))]"
                          {...field}
                          onChange={(e) =>
                            field.onChange(e.target.valueAsNumber)
                          }
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
                    <div className="flex justify-between items-center">
                      <FormLabel className="text-slate-600/93 font-semibold">
                        Notes (Optional)
                      </FormLabel>
                      <p className="text-sm text-purple-700 mr-1">
                        {form.getValues("description")?.length || 0} / 255
                      </p>
                    </div>

                    <FormControl>
                      <Textarea
                        placeholder="Add notes"
                        className="resize-none text-slate-800 !text-base placeholder:text-slate-400"
                        rows={3}
                        maxLength={255}
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
