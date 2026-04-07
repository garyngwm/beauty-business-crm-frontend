import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "~/button";
import { Input } from "~/input";
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
import LoadingSpinner from "@/components/shared/loading-spinner";
import { useMinimumLoadingTime } from "@/hooks/use-min-loading";
import { toastManager } from "../shared/toast-manager";
import { apiRequest, queryClient } from "@/lib/query-client";
import { MIN_LOADING } from "@/lib/constants";
import { getErrorDescription } from "@/lib/utils/misc";
import { OUTLET_1_IMAGE, OUTLET_2_IMAGE } from "@/lib/constants";

import { type OutletResponse } from "@/lib/types/outlet/outlet";
import {
  staffFormSchema,
  type StaffWithLocationsResponse,
  type StaffFormData,
  type UpsertData,
} from "@/lib/types/staff/staff";

const SIDEBAR_ITEMS = [
  // Basic
  { label: "Main", isSection: true },
  { label: "Basics" },
  { label: "Locations" },

  // Others
  { label: "Settings", isSection: true },
  { label: "Active" },
  { label: "Bookable" },
];

export default function StaffView() {
  // Navigation related stuff
  const [, navigate] = useLocation();
  const searchParams = new URLSearchParams(useSearch());

  // Optional search params
  const staffId = searchParams.get("staffId");
  const fromCalendar = !!searchParams.get("fromCalendar");

  const staffStatus = searchParams.get("status");

  // Check what mode we are in
  const isEditMode = !!staffId;
  const [activeSection, setActiveSection] = useState("Basics");

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

  const form = useForm<StaffFormData>({
    resolver: zodResolver(staffFormSchema),
    defaultValues: {
      // Basic Details
      firstName: undefined,
      lastName: undefined,
      email: undefined,
      phone: undefined,
      role: undefined,

      // Location
      locations: outlets.map((outlet) => outlet.id),
    },
  });

  // If edit mode, fetch the target staff
  // Then, pre-seed the form
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { data: staff, isLoading: isTargetStaffLoading } =
    useQuery<StaffWithLocationsResponse>({
      queryKey: ["/api/staffs", staffId],
      enabled: isEditMode,
      queryFn: () =>
        fetch(`/api/staffs/${staffId}`).then(async (res) => {
          if (!res.ok) throw new Error("Failed to fetch the service to edit");
          const staff: StaffWithLocationsResponse = await res.json();

          form.reset({
            // Basic Details
            firstName: staff.firstName,
            lastName: staff.lastName,
            email: staff.email,
            phone: staff.phone,
            role: staff.role,

            // Location
            locations: staff.locations,
          });

          return staff;
        }),

      // Ensures that data is always there, even in subsequent edit clicks
      refetchOnMount: "always",
    });

  // Loading flag
  const isLoading =
    isOutletLoading || (isEditMode ? isTargetStaffLoading : false);

  const showLoading = useMinimumLoadingTime(isLoading);

  // Monitoring certain fields onChange
  const locations = form.watch("locations");

  const hasLastRowError = !!form.formState.errors.email;

  const hasDetailsError = !!(
    form.formState.errors.firstName ||
    form.formState.errors.lastName ||
    form.formState.errors.phone ||
    form.formState.errors.role ||
    form.formState.errors.email
  );

  // Watch for section errors
  const hasBasicErrors = hasDetailsError;
  const hasLocationErrors = !!form.formState.errors.locations;
  const errorSections = [
    ...(hasBasicErrors ? ["Basics"] : []),
    ...(hasLocationErrors ? ["Locations"] : []),
  ];

  const upsertStaffMutation = useMutation({
    mutationFn: (data: UpsertData) => {
      const url = staffId ? `/api/staffs/${staffId}` : `/api/staffs`;
      return apiRequest("PUT", url, data);
    },
    onSuccess: async (serverResponse: string) => {
      const action = staffId ? "updated" : "created";
      const title = `Staff ${action}`;

      const minDelayPromise = new Promise((resolve) =>
        setTimeout(resolve, MIN_LOADING)
      );

      const invalidatePromises = Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/staffs"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/staffs/stats"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/staffs/outlet"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/customers"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/appointments"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/shifts"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/time-offs"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/blocked-times"] }),
      ]);

      await Promise.all([minDelayPromise, invalidatePromises]);

      toastManager({
        title: title,
        description: serverResponse,
        status: "success",
      });

      if (fromCalendar) {
        navigate("/");
      } else {
        navigate("/staffs");
      }
    },
    onError: (error: Error) => {
      const action = staffId ? "update" : "create";
      const title = `Staff ${action} failed`;
      const description = getErrorDescription(error.message);

      toastManager({
        title: title,
        description: description,
        status: "failure",
      });
    },
  });

  const showPendingUpsert = useMinimumLoadingTime(
    upsertStaffMutation.isPending
  );

  // Initiate the form submission process
  const onSubmit = (data: StaffFormData) => {
    const mutationData: UpsertData = {
      ...data,

      // Hardcoded defaults
      // Maybe can properly implement in future
      bookable: true,
      active: staffStatus === "inactive" ? false : true,
    };

    upsertStaffMutation.mutate(mutationData);
  };

  return (
    <div className="min-h-screen bg-slate-300 flex justify-center items-center p-7">
      {/* Fixed size card, so fixed size content */}
      <Card
        className={cn(
          "w-[1024px] bg-white rounded-lg shadow-[0px_0px_8px_rgba(0,0,0,0.25)] flex flex-col",
          hasLastRowError ? "h-[550px]" : "h-[500px]"
        )}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-6 rounded-t-lg border-b border-b-slate-500 flex-shrink-0 bg-gray-200/85">
          <h1 className="text-2xl font-semibold mt-1">
            {isEditMode ? "Edit Staff" : "New Staff"}
          </h1>
          <div className="flex justify-end space-x-3">
            <Link to={fromCalendar ? "/" : "/staffs"}>
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
              className="flex-1 flex"
            >
              {/* Sidebar */}
              <div className="w-64 border-r border-r-slate-500 rounded-bl-lg bg-gray-200/85">
                <nav className="p-4 pt-2">
                  {SIDEBAR_ITEMS.map((item) => (
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
                                ? "bg-red-200 hover:bg-gray-300 text-red-900 font-semibold"
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
              <div className="flex-1 h-full p-8">
                {activeSection === "Basics" && (
                  <div className="space-y-9">
                    <div>
                      <div className="text-lg text-slate-800 font-semibold mb-4">
                        Basic Details
                      </div>

                      <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-6">
                          {/* First Name */}
                          <FormField
                            control={form.control}
                            name="firstName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-slate-600/93 font-semibold">
                                  First Name
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="John"
                                    {...field}
                                    className="h-10 text-slate-800 !text-base placeholder:text-slate-400 py-5 focus:border-[color:hsl(var(--beauty-purple))]"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {/* Last Name */}
                          <FormField
                            control={form.control}
                            name="lastName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-slate-600/93 font-semibold">
                                  Last Name
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="Cena"
                                    {...field}
                                    className="h-10 text-slate-800 !text-base placeholder:text-slate-400 py-5 focus:border-[color:hsl(var(--beauty-purple))]"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {/* Phone */}
                          <FormField
                            control={form.control}
                            name="phone"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-slate-600/93 font-semibold">
                                  Phone
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    placeholder="9777 3639"
                                    {...field}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      const stringValue =
                                        value === ""
                                          ? undefined
                                          : value.toString();

                                      field.onChange(stringValue);
                                    }}
                                    className="h-10 text-slate-800 !text-base placeholder:text-slate-400 py-5 focus:border-[color:hsl(var(--beauty-purple))]"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {/* Role */}
                          <FormField
                            control={form.control}
                            name="role"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-slate-600/93 font-semibold">
                                  Role
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="Therapist"
                                    {...field}
                                    className="h-10 text-slate-800 !text-base placeholder:text-slate-400 py-5 focus:border-[color:hsl(var(--beauty-purple))]"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Email */}
                        <FormField
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-slate-600/93 font-semibold">
                                Email
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="email"
                                  placeholder="example@gmail.com"
                                  {...field}
                                  className="h-10 text-slate-800 !text-base placeholder:text-slate-400 py-5 focus:border-[color:hsl(var(--beauty-purple))]"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
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
