import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/dialog";
import { Button } from "~/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/select";
import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils/date-processing";
import {
  filterFormSchema,
  type FilterFormData,
} from "@/lib/types/service/service";

interface FilterOptionsProps {
  setIsActive: React.Dispatch<React.SetStateAction<boolean | null>>;
  setIsOnlineBooking: React.Dispatch<React.SetStateAction<boolean | null>>;
  setIsComission: React.Dispatch<React.SetStateAction<boolean | null>>;
  isActive: boolean | null;
  isOnlineBooking: boolean | null;
  isComission: boolean | null;
}

export default function FilterOptions({
  setIsActive,
  setIsOnlineBooking,
  setIsComission,
  isActive,
  isOnlineBooking,
  isComission,
}: FilterOptionsProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Construct initial values
  // "Any" will be the default, since it effectively has no filter
  const initialValues = {
    status: isActive === null ? "Any" : isActive ? "Active" : "Inactive",
    onlineBookings:
      isOnlineBooking === null
        ? "Any"
        : isOnlineBooking
          ? "Enabled"
          : "Disabled",
    commissions:
      isComission === null ? "Any" : isComission ? "Enabled" : "Disabled",
  };

  const form = useForm<FilterFormData>({
    resolver: zodResolver(filterFormSchema),
    defaultValues: initialValues,
  });

  const onApply = (data: FilterFormData) => {
    // Apply filters, convert to booleans
    setIsActive(
      data.status === "Active"
        ? true
        : data.status === "Inactive"
          ? false
          : null
    );
    setIsOnlineBooking(
      data.onlineBookings === "Enabled"
        ? true
        : data.onlineBookings === "Disabled"
          ? false
          : null
    );
    setIsComission(
      data.commissions === "Enabled"
        ? true
        : data.commissions === "Disabled"
          ? false
          : null
    );
    setIsOpen(false);
  };

  const onCancel = () => {
    form.reset(initialValues);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button className="cursor-pointer hover:bg-gray-200 p-2 rounded-lg">
          <SlidersHorizontal className="w-5 h-5 text-slate-600" />
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-lg max-h-[90vh] overflow-auto p-8">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-slate-800">
            Service Filters
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onApply)}
            className="space-y-6 text-base text-slate-800"
          >
            {/* Status */}
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-600/93 font-semibold">
                    Status
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
                          field.value === "Any"
                            ? "text-slate-400"
                            : "text-slate-800",

                          // Make the chevron down always this color
                          "[&>svg]:text-slate-900"
                        )}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent
                        sideOffset={8}
                        className="border border-slate-500 shadow-[0px_0.5px_8px_rgba(0,0,0,0.15)]"
                      >
                        <SelectItem
                          value="Any"
                          className="!text-base !text-slate-800 hover:!bg-slate-200"
                        >
                          Any
                        </SelectItem>
                        <SelectItem
                          value="Active"
                          className="!text-base !text-slate-800 hover:!bg-slate-200"
                        >
                          Active
                        </SelectItem>
                        <SelectItem
                          value="Inactive"
                          className="!text-base !text-slate-800 hover:!bg-slate-200"
                        >
                          Inactive
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Online bookings */}
            <FormField
              control={form.control}
              name="onlineBookings"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-600/93 font-semibold">
                    Online Bookings
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
                          field.value === "Any"
                            ? "text-slate-400"
                            : "text-slate-800",

                          "[&>svg]:text-slate-900"
                        )}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent
                        sideOffset={8}
                        className="border border-slate-500 shadow-[0px_0.5px_8px_rgba(0,0,0,0.15)]"
                      >
                        <SelectItem
                          value="Any"
                          className="!text-base !text-slate-800 hover:!bg-slate-200"
                        >
                          Any
                        </SelectItem>
                        <SelectItem
                          value="Enabled"
                          className="!text-base !text-slate-800 hover:!bg-slate-200"
                        >
                          Enabled
                        </SelectItem>
                        <SelectItem
                          value="Disabled"
                          className="!text-base !text-slate-800 hover:!bg-slate-200"
                        >
                          Disabled
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Commissions */}
            <FormField
              control={form.control}
              name="commissions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-600/93 font-semibold">
                    Commissions
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
                          field.value === "Any"
                            ? "text-slate-400"
                            : "text-slate-800",

                          "[&>svg]:text-slate-900"
                        )}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent
                        sideOffset={8}
                        className="border border-slate-500 shadow-[0px_0.5px_8px_rgba(0,0,0,0.15)]"
                      >
                        <SelectItem
                          value="Any"
                          className="!text-base !text-slate-800 hover:!bg-slate-200"
                        >
                          Any
                        </SelectItem>
                        <SelectItem
                          value="Enabled"
                          className="!text-base !text-slate-800 hover:!bg-slate-200"
                        >
                          Enabled
                        </SelectItem>
                        <SelectItem
                          value="Disabled"
                          className="!text-base !text-slate-800 hover:!bg-slate-200"
                        >
                          Disabled
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                </FormItem>
              )}
            />

            {/** Actions */}
            <div className="flex justify-end space-x-2 pt-4">
              <Button
                variant="ghost"
                onClick={onCancel}
                className="text-base hover:bg-slate-200"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="text-base hover:bg-beauty-purple-light"
              >
                Apply
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
