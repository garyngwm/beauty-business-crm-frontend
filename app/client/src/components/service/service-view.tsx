import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "~/button";
import { Input } from "~/input";
import { Textarea } from "~/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/select";
import { Card } from "~/card";
import { Checkbox } from "~/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/form";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "wouter";
import { cn } from "@/lib/utils/date-processing";
import {
  generateDurationOptions,
  parseDurationLabel,
} from "@/lib/utils/date-processing";
import LoadingSpinner from "@/components/shared/loading-spinner";
import { useMinimumLoadingTime } from "@/hooks/use-min-loading";
import { toastManager } from "../shared/toast-manager";
import { apiRequest, queryClient } from "@/lib/query-client";
import { MIN_LOADING } from "@/lib/constants";
import { getErrorDescription } from "@/lib/utils/misc";
import { OUTLET_1_IMAGE, OUTLET_2_IMAGE } from "@/lib/constants";
import {
  serviceFormSchema,
  type ServiceFormData,
  type ServiceWithLocationsResponse,
} from "@/lib/types/service/service";

import { type CategoryWithCountResponse } from "@/lib/types/service/category";
import { type CategoryColorResponse } from "@/lib/types/service/category-color";
import { type OutletResponse } from "@/lib/types/outlet/outlet";

type UpsertData = ServiceFormData & {
  active: boolean;
  onlineBookings: boolean;
  comissions: boolean;
  gstPercent?: number;
  gstOutletIds: number[];
};

type ServiceFormExtra = { gstPercent: number; gstOutletIds: number[] };

const sidebarItems = [
  // Basic
  { label: "Main", isSection: true },
  { label: "Basics" },
  { label: "Locations" },

  // Others
  { label: "Settings", isSection: true },
  { label: "Active" },
  { label: "Online booking" },
  { label: "Commissions" },
];

// 15 min - 2 hours, in 5 min intervals
const DURATION_OPTIONS = generateDurationOptions(15, 120, 5);

export default function ServiceView() {
  // Navigation related stuff
  const [, navigate] = useLocation();
  const searchParams = new URLSearchParams(useSearch());
  const serviceId = searchParams.get("serviceId");
  const categoryId = searchParams.get("categoryId");

  // Check what mode we are in
  const isEditMode = !!serviceId;
  const [activeSection, setActiveSection] = useState("Basics");

  const { data: outlets = [], isLoading: isOutletLoading } = useQuery<
    OutletResponse[]
  >({
    queryKey: ["/api/outlets"],
    queryFn: () => apiRequest("GET", "/api/outlets"),
  });

  const { data: serviceCategories = [], isLoading: isCategoryLoading } =
    useQuery<CategoryWithCountResponse[]>({
      queryKey: ["/api/service-categories"],
      queryFn: () => apiRequest("GET", "/api/service-categories"),
    });

  const { data: categoryColors = [], isLoading: isColorsLoading } = useQuery<
    CategoryColorResponse[]
  >({
    queryKey: ["/api/category-colors"],
    queryFn: () => apiRequest("GET", "/api/category-colors"),
  });

  const colorMap = useMemo(
    () =>
      categoryColors.reduce<Record<string, string>>((acc, categoryColor) => {
        acc[categoryColor.name] = categoryColor.hex;
        return acc;
      }, {}),
    [categoryColors]
  );

  const form = useForm<ServiceFormData & ServiceFormExtra>({
    resolver: zodResolver(serviceFormSchema),
    defaultValues: {
      // Basic Details
      name: undefined,
      categoryId: categoryId ? Number(categoryId) : undefined,
      duration: undefined,
      description: undefined,

      // Pricing
      priceType: undefined,
      cashPrice: undefined,
      creditCost: undefined,
      gstPercent: 0,

      // Location
      gstOutletIds: [1],
      locations: outlets.map((outlet) => outlet.id),
    },
  });

  // If edit mode, fetch the target service
  // Then, pre-seed the form
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { data: service, isLoading: isTargetServiceLoading } =
    useQuery<ServiceWithLocationsResponse>({
      queryKey: ["/api/services", serviceId],
      enabled: isEditMode,
      queryFn: async () => {
        const service: ServiceWithLocationsResponse = await apiRequest(
          "GET",
          `/api/services/${serviceId}`
        );

        form.reset({
          name: service.name,
          categoryId: service.categoryId,
          duration: service.duration,
          description: service.description ?? undefined,

          priceType: service.priceType,
          cashPrice: service.cashPrice,
          creditCost: service.creditCost,

          gstPercent: service.gstPercent ?? 0,
          gstOutletIds: service.gstOutletIds?.length ? service.gstOutletIds : [1],

          locations: service.locations ?? [],
        });
        return service;
      },

      // Ensures that data is always there, even in subsequent edit clicks
      refetchOnMount: "always",
    });

  // Loading flag
  const isLoading =
    isOutletLoading ||
    isCategoryLoading ||
    isColorsLoading ||
    (isEditMode ? isTargetServiceLoading : false);

  const showLoading = useMinimumLoadingTime(isLoading);

  // Monitoring certain fields onChange
  const locations = form.watch("locations");
  const priceType = form.watch("priceType");
  const isFree = priceType === "Free";

  // Watch for last column errors
  const hasPricingError = !!(
    form.formState.errors.priceType ||
    form.formState.errors.cashPrice ||
    form.formState.errors.creditCost
  );

  const hasDetailsError = !!(
    form.formState.errors.name ||
    form.formState.errors.categoryId ||
    form.formState.errors.duration ||
    form.formState.errors.description
  );

  // Watch for section errors
  const hasBasicErrors = hasPricingError || hasDetailsError;
  const hasLocationErrors = !!form.formState.errors.locations;
  const errorSections = [
    ...(hasBasicErrors ? ["Basics"] : []),
    ...(hasLocationErrors ? ["Locations"] : []),
  ];

  const upsertServiceMutation = useMutation({
    mutationFn: (data: UpsertData) => {
      const url = serviceId ? `/api/services/${serviceId}` : `/api/services`;
      return apiRequest("PUT", url, data);
    },
    onSuccess: async (serverResponse: string) => {
      const action = serviceId ? "updated" : "created";
      const title = `Service ${action}`;

      const minDelayPromise = new Promise((resolve) =>
        setTimeout(resolve, MIN_LOADING)
      );

      const invalidatePromises = Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/services"] }),
        queryClient.invalidateQueries({
          queryKey: ["/api/service-categories"],
        }),
        queryClient.invalidateQueries({ queryKey: ["/api/appointments"] }),
      ]);

      await Promise.all([minDelayPromise, invalidatePromises]);

      toastManager({
        title: title,
        description: serverResponse,
        status: "success",
      });

      navigate("/services");
    },
    onError: (error: Error) => {
      const action = serviceId ? "update" : "create";
      const title = `Service ${action} failed`;
      const description = getErrorDescription(error.message);

      toastManager({
        title: title,
        description: description,
        status: "failure",
      });
    },
  });

  const showPendingUpsert = useMinimumLoadingTime(
    upsertServiceMutation.isPending
  );

  // Initiate the form submission process
  const onSubmit = (data: ServiceFormData & ServiceFormExtra) => {
    const safeGstOutletIds = (data.gstOutletIds ?? [1]).filter((id) =>
      data.locations.includes(id)
    );

    const mutationData: UpsertData = {
      ...data,
      // Data enforcing
      cashPrice: isFree ? 0 : data.cashPrice,
      creditCost: isFree ? 0 : data.creditCost,

      gstPercent: data.gstPercent ?? 0,
      gstOutletIds: safeGstOutletIds.length ? safeGstOutletIds : [1],
      locations: data.locations,

      // Hardcoded defaults
      // Maybe can properly implement in future
      active: true,
      onlineBookings: true,
      comissions: true,
    };

    upsertServiceMutation.mutate(mutationData);
  };

  return (
    <div className="min-h-screen bg-slate-300 flex justify-center items-center p-7">
      <Card
        // Fixed size card, so fixed size content
        className={cn(
          "w-[1024px] bg-white rounded-lg overflow-hidden shadow-[0px_0px_8px_rgba(0,0,0,0.25)] flex flex-col",
          hasPricingError ? "h-[800px]" : "h-[740px]"
        )}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-6 rounded-t-lg border-b border-b-slate-500 flex-shrink-0 bg-gray-200/85">
          <h1 className="text-2xl font-semibold mt-1">
            {isEditMode ? "Edit Service" : "New Service"}
          </h1>
          <div className="flex justify-end space-x-3">
            <Link to="/services">
              <Button
                type="button"
                variant="ghost"
                className="text-lg hover:bg-gray-300 py-6"
              >
                Cancel
              </Button>
            </Link>

            <Button
              type="submit"
              form="service-form"
              className="bg-beauty-purple hover:bg-beauty-purple-light text-lg py-6"
              disabled={showPendingUpsert}
            >
              {showPendingUpsert ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>

        {showLoading ? (
          <LoadingSpinner />
        ) : (
          <Form {...form}>
            <form
              id="service-form"
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex-1 flex min-h-0"
            >
              {/* Sidebar */}
              <div className="w-64 border-r border-r-slate-500 rounded-bl-lg bg-gray-200/85">
                <nav className="p-4 pt-2">
                  {sidebarItems.map((item) => (
                    <div key={item.label}>
                      {item.isSection ? (
                        <h3 className="text-base font-semibold text-gray-900 mt-6 mb-2 ml-[2px]">
                          {item.label}
                        </h3>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => setActiveSection(item.label)}
                            className={cn(
                              "w-full text-left px-4 py-[0.4rem] rounded-md flex items-center justify-between mb-[0.4rem] transition-colors",
                              activeSection === item.label
                                ? "bg-green-300/90 text-gray-900"
                                : "hover:bg-gray-300 text-gray-900",
                              errorSections.includes(item.label)
                                ? "bg-red-200 text-red-900 font-semibold"
                                : undefined
                            )}
                          >
                            <span className="text-base">{item.label}</span>
                            {item.label === "Locations" && (
                              <span className="text-base">
                                {locations.length}
                              </span>
                            )}
                          </button>
                          {item.label === "Locations" && (
                            <div className="h-px bg-slate-500 my-6" />
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </nav>
              </div>

              {/* Main Content */}
              <div className="flex-1 min-h-0 overflow-y-auto p-8">
                {activeSection === "Basics" && (
                  <div className="space-y-9">
                    <div>
                      <div className="text-lg text-slate-800 font-semibold mb-4">
                        Basic Details
                      </div>

                      <div className="space-y-6">
                        {/* Name */}
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-slate-600/93 font-semibold">
                                Name
                              </FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Men's haircut"
                                  {...field}
                                  className="h-10 text-slate-800 !text-base placeholder:text-slate-400 py-5 focus:border-[color:hsl(var(--beauty-purple))]"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-2 gap-6">
                          {/* Category */}
                          <FormField
                            control={form.control}
                            name="categoryId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-slate-600/93 font-semibold">
                                  Category
                                </FormLabel>
                                <Select
                                  disabled={!!categoryId}
                                  // Pass back to the field as number!!
                                  onValueChange={(val) =>
                                    field.onChange(Number(val))
                                  }
                                  value={field.value?.toString()}
                                >
                                  <FormControl>
                                    <SelectTrigger
                                      className={cn(
                                        "w-full text-base py-5",
                                        field.value
                                          ? "!text-slate-800"
                                          : "!text-slate-400",
                                        "[&>svg]:text-slate-900"
                                      )}
                                    >
                                      <SelectValue placeholder="Select category" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent
                                    sideOffset={8}
                                    className="border border-slate-500 shadow-[0px_0.5px_8px_rgba(0,0,0,0.15)]"
                                  >
                                    {serviceCategories.map((cat) => (
                                      <SelectItem
                                        key={cat.id}
                                        value={cat.id.toString()}
                                        className="!text-base !text-slate-800 hover:!bg-slate-200"
                                      >
                                        <div className="flex items-center gap-2">
                                          <div
                                            className="h-4 w-4 rounded-full"
                                            style={{
                                              backgroundColor:
                                                colorMap[cat.color],
                                            }}
                                          />
                                          <span>{cat.title}</span>
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {/* Duration */}
                          <FormField
                            control={form.control}
                            name="duration"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-slate-600/93 font-semibold">
                                  Duration
                                </FormLabel>
                                <Select
                                  // Pass back to the field as number!!
                                  onValueChange={(val) =>
                                    field.onChange(Number(val))
                                  }
                                  value={field.value?.toString()}
                                >
                                  <FormControl>
                                    <SelectTrigger
                                      className={cn(
                                        "w-full text-base py-5",
                                        field.value
                                          ? "!text-slate-800"
                                          : "!text-slate-400",
                                        "[&>svg]:text-slate-900"
                                      )}
                                    >
                                      <SelectValue placeholder="Select duration" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent
                                    sideOffset={8}
                                    className="border border-slate-500 shadow-[0px_0.5px_8px_rgba(0,0,0,0.15)]"
                                  >
                                    {DURATION_OPTIONS.map((duration) => (
                                      <SelectItem
                                        key={duration}
                                        value={parseDurationLabel(
                                          duration
                                        ).toString()}
                                        className="!text-base !text-slate-800 hover:!bg-slate-200"
                                      >
                                        {duration}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Description */}
                        <FormField
                          control={form.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex items-center justify-between">
                                <FormLabel className="text-slate-600/93 font-semibold">
                                  Description
                                </FormLabel>
                                <p className="text-sm text-purple-600 mr-1">
                                  {field.value?.length || 0} / 255
                                </p>
                              </div>

                              <FormControl>
                                <Textarea
                                  className="resize-none !text-base placeholder:text-base placeholder:text-slate-400"
                                  rows={4}
                                  placeholder="Add description"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <div>
                      <h2 className="text-lg text-slate-800 font-semibold mb-4">
                        Pricing
                      </h2>

                      <div className="grid grid-cols-3 gap-6">
                        {/* Price Type */}
                        <FormField
                          control={form.control}
                          name="priceType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-slate-600/93 font-semibold">
                                Type
                              </FormLabel>
                              <Select
                                onValueChange={(val) => {
                                  field.onChange(val);
                                  if (val === "Free") {
                                    form.setValue("cashPrice", 0);
                                    form.setValue("creditCost", 0);

                                    // For that one edge case
                                    // Where error state -> set to free -> clear errors for all
                                    form.clearErrors([
                                      "cashPrice",
                                      "creditCost",
                                    ]);
                                  }
                                }}
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger
                                    className={cn(
                                      "w-full text-base py-5",
                                      field.value
                                        ? "!text-slate-800"
                                        : "!text-slate-400",
                                      "[&>svg]:text-slate-900"
                                    )}
                                  >
                                    <SelectValue placeholder="Select type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent
                                  sideOffset={8}
                                  className="border border-slate-500 shadow-[0px_0.5px_8px_rgba(0,0,0,0.15)]"
                                >
                                  <SelectItem
                                    value="Free"
                                    className="!text-base !text-slate-800 hover:!bg-slate-200"
                                  >
                                    Free
                                  </SelectItem>
                                  <SelectItem
                                    value="Fixed"
                                    className="!text-base !text-slate-800 hover:!bg-slate-200"
                                  >
                                    Fixed
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Price */}
                        <FormField
                          control={form.control}
                          name="cashPrice"
                          render={({ field }) => {
                            return (
                              <FormItem>
                                <FormLabel className="text-slate-600/93 font-semibold">
                                  Price (SGD)
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    placeholder="100"
                                    className="h-10 text-slate-800 !text-base placeholder:text-slate-400 py-5 focus:border-[color:hsl(var(--beauty-purple))]"
                                    disabled={isFree}
                                    {...field}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      // Handing from field value -> form value
                                      field.onChange(
                                        value === "" ? undefined : Number(value)
                                      );
                                    }}
                                    value={field?.value}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            );
                          }}
                        />

                        {/* Credits */}
                        <FormField
                          control={form.control}
                          name="creditCost"
                          render={({ field }) => {
                            return (
                              <FormItem>
                                <FormLabel className="text-slate-600/93 font-semibold">
                                  Credits
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    placeholder="2"
                                    className="h-10 text-slate-800 !text-base placeholder:text-slate-400 py-5 focus:border-[color:hsl(var(--beauty-purple))]"
                                    disabled={isFree}
                                    {...field}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      // Handing from field value -> form value
                                      field.onChange(
                                        value === "" ? undefined : Number(value)
                                      );
                                    }}
                                    value={field?.value}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            );
                          }}
                        />
                      </div>
                    </div>

                    {/* GST */}
                    <div className="pt-6 border-t border-slate-200">
                      <h3 className="text-lg text-slate-800 font-semibold mb-4">
                        Tax / GST
                      </h3>

                      <FormField
                        control={form.control}
                        name="gstPercent"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-600/93 font-semibold">
                              GST percentage
                            </FormLabel>

                            <FormControl>
                              <div className="relative">
                                <Input
                                  type="number"
                                  inputMode="decimal"
                                  placeholder="0"
                                  className="h-10 pr-14 text-slate-800 !text-base placeholder:text-slate-400 py-5 focus:border-[color:hsl(var(--beauty-purple))]"
                                  {...field}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    field.onChange(v === "" ? undefined : Number(v));
                                  }}
                                  value={field.value ?? ""}
                                />

                                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                  <div className="h-9 w-10 rounded-md border border-slate-300 bg-slate-100 flex items-center justify-center text-slate-700 font-semibold select-none">
                                    %
                                  </div>
                                </div>
                              </div>
                            </FormControl>

                            <p className="text-sm text-gray-500">
                              For future calculations (e.g. sale price = base price x (1 + GST%)).
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="gstOutletIds"
                        render={({ field }) => (
                          <FormItem className="mt-4">
                            <FormLabel className="text-slate-600/93 font-semibold">
                              Applies to outlets
                            </FormLabel>

                            <div className="space-y-3 mt-2">
                              {outlets.map((outlet) => (
                                <div key={outlet.id} className="flex items-center gap-3">
                                  <Checkbox
                                    checked={(field.value ?? []).includes(outlet.id)}
                                    onCheckedChange={(checked) => {
                                      const current = field.value ?? [];

                                      if (!checked && current.length === 1 && current[0] === outlet.id) {
                                        return;
                                      }

                                      if (checked) {
                                        field.onChange([...current, outlet.id]);
                                      } else {
                                        field.onChange(current.filter((id) => id !== outlet.id));
                                      }
                                    }}
                                    className="data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                                  />

                                  <span className="text-sm text-slate-800 font-semibold">
                                    {outlet.name}
                                  </span>
                                </div>
                              ))}
                            </div>

                            <p className="text-sm text-gray-500 mt-2">
                              GST percentage will be applied only for these outlets.
                            </p>

                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}

                {activeSection === "Locations" && (
                  <div>
                    <h2 className="text-lg text-slate-800 font-semibold mb-[2.5px]">
                      Locations
                    </h2>
                    <p className="text-base text-gray-500 mb-6">
                      Choose the outlets which offers this service
                    </p>

                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="locations"
                        render={({ field }) => (
                          <div className="space-y-4">
                            {/* All locations checkbox */}
                            <FormItem className="flex items-center gap-3 pb-2 border-input border-b">
                              <FormControl>
                                <Checkbox
                                  checked={
                                    field.value?.length === outlets.length
                                  }
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      field.onChange(
                                        outlets.map((outlet) => outlet.id)
                                      );
                                    } else {
                                      field.onChange([]);
                                    }
                                  }}
                                  className="data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                                />
                              </FormControl>
                              <FormLabel className="text-[0.95rem] text-slate-800 cursor-pointer flex items-center gap-2 m-0">
                                All Outlets
                              </FormLabel>
                            </FormItem>

                            {/* Individual outlets */}
                            {outlets.map((outlet) => (
                              <FormItem
                                key={outlet.id}
                                className="flex items-center gap-3"
                              >
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(outlet.id)}
                                    onCheckedChange={(checked) => {
                                      const currentValue = field.value || [];
                                      if (checked) {
                                        field.onChange([
                                          ...currentValue,
                                          outlet.id,
                                        ]);
                                      } else {
                                        field.onChange(
                                          currentValue.filter(
                                            (id) => id !== outlet.id
                                          )
                                        );
                                      }
                                    }}
                                    className="data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                                  />
                                </FormControl>
                                <img
                                  src={
                                    outlet.id === 1 ? OUTLET_2_IMAGE : OUTLET_1_IMAGE
                                  }
                                  alt={outlet.name}
                                  className="w-12 h-12 rounded object-cover"
                                />
                                <FormLabel className="cursor-pointer flex-1 m-0">
                                  <div className="text-sm text-slate-800 font-semibold">
                                    {outlet.name}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {outlet.address}
                                  </div>
                                </FormLabel>
                              </FormItem>
                            ))}
                            <FormMessage />
                          </div>
                        )}
                      />
                    </div>
                  </div>
                )}
              </div>
            </form>
          </Form>
        )}
      </Card>
    </div>
  );
}
