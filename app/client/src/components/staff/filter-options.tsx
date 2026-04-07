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
import { Form, FormControl, FormField, FormItem, FormLabel } from "~/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/select";
import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils/date-processing";
import { useQuery } from "@tanstack/react-query";
import LoadingSpinner from "../shared/loading-spinner";
import { useMinimumLoadingTime } from "@/hooks/use-min-loading";
import { filterFormSchema, FilterFormData } from "@/lib/types/staff/staff";
import { type OutletResponse } from "@/lib/types/outlet/outlet";

interface FilterOptionsProps {
  setSelectedOutletId: React.Dispatch<React.SetStateAction<number>>;
  setIsBookable: React.Dispatch<React.SetStateAction<boolean | null>>;
  selectedOutletId: number;
  isBookable: boolean | null;
}

export default function FilterOptions({
  setSelectedOutletId,
  setIsBookable,
  selectedOutletId,
  isBookable,
}: FilterOptionsProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Get outlets
  const { data: outlets = [], isLoading: isOutletLoading } = useQuery<
    OutletResponse[]
  >({
    queryKey: ["/api/outlets"],
    queryFn: () =>
      fetch("/api/outlets").then((res) => {
        if (!res.ok) throw new Error("Failed to fetch outlets");
        return res.json();
      }),
  });

  const showLoading = useMinimumLoadingTime(isOutletLoading);

  // Construct initial values
  // "Any" or -1 will be the default, since it effectively has no filter
  const initialValues = {
    location: selectedOutletId,
    type:
      isBookable === null ? "Any" : isBookable ? "Bookable" : "Non-bookable",
  };

  const form = useForm<FilterFormData>({
    resolver: zodResolver(filterFormSchema),
    defaultValues: initialValues,
  });

  const onApply = (data: FilterFormData) => {
    // Apply filters, convert to booleans
    setIsBookable(
      data.type === "Bookable"
        ? true
        : data.type === "Non-bookable"
          ? false
          : null
    );

    setSelectedOutletId(data.location);
    setIsOpen(false);
  };

  const onCancel = () => {
    form.reset(initialValues);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button className="cursor-pointer hover:bg-gray-100 p-2 rounded-lg">
          <SlidersHorizontal className="w-5 h-5 text-slate-600" />
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-lg max-h-[90vh] overflow-auto p-8">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-slate-800">
            Staff Filters
          </DialogTitle>
        </DialogHeader>

        {showLoading ? (
          <LoadingSpinner />
        ) : (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onApply)}
              className="space-y-6 text-base text-slate-800"
            >
              {/* Locations */}
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-600/93 font-semibold">
                      Location
                    </FormLabel>
                    <FormControl>
                      <Select
                        onValueChange={(value) => field.onChange(Number(value))}
                        value={field.value?.toString()}
                      >
                        <SelectTrigger
                          className={cn(
                            "w-full text-base py-5",
                            "focus:outline-none focus:ring-0",
                            "active:bg-transparent active:shadow-none",
                            field.value === -1
                              ? "text-slate-400"
                              : "text-slate-800",

                            "[&>svg]:text-slate-900"
                          )}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent
                          sideOffset={8}
                          className="border border-slate-500 shadow-[0px_0px_8px_rgba(0,0,0,0.20)]"
                        >
                          <SelectItem
                            value="-1"
                            className="!text-base !text-slate-800 hover:!bg-slate-200"
                          >
                            Any
                          </SelectItem>
                          {outlets.map((o) => (
                            <SelectItem
                              key={o.id}
                              value={o.id.toString()}
                              className="!text-base !text-slate-800 hover:!bg-slate-200"
                            >
                              {o.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                  </FormItem>
                )}
              />

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
                          className="border border-slate-500 shadow-[0px_0px_8px_rgba(0,0,0,0.20)]"
                        >
                          <SelectItem
                            value="Any"
                            className="!text-base !text-slate-800 hover:!bg-slate-200"
                          >
                            Any
                          </SelectItem>
                          <SelectItem
                            value="Bookable"
                            className="!text-base !text-slate-800 hover:!bg-slate-200"
                          >
                            Bookable
                          </SelectItem>
                          <SelectItem
                            value="Non-bookable"
                            className="!text-base !text-slate-800 hover:!bg-slate-200"
                          >
                            Non-bookable
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
        )}
      </DialogContent>
    </Dialog>
  );
}
