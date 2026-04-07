import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/form";
import { Button } from "~/button";
import { Input } from "~/input";
import { apiRequest, queryClient } from "@/lib/query-client";
import { toastManager } from "@/components/shared/toast-manager";
import { MIN_LOADING } from "@/lib/constants";
import { getErrorDescription } from "@/lib/utils/misc";
import { useMinimumLoadingTime } from "@/hooks/use-min-loading";
import { useEffect } from "react";
import { Trash2 } from "lucide-react";

import {
  customerFormSchema,
  type CustomerFormData,
  type CustomerResponse,
} from "@/lib/types/customer";
import LoadingSpinner from "../shared/loading-spinner";

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId: number;
}

export default function CustomerModal({
  isOpen,
  onClose,
  customerId,
}: CustomerModalProps) {
  const form = useForm<CustomerFormData>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      firstName: undefined,
      lastName: undefined,
      email: undefined,
      phone: undefined,
      birthday: undefined,
      creditBalance: 0,
    },
  });

  // Determine intention
  const isEditMode = customerId !== -1;

  // If edit intention, fetch the target appointment
  const { data: customer, isLoading: isCustomerLoading } =
    useQuery<CustomerResponse>({
      queryKey: ["/api/customers", customerId],
      enabled: isEditMode,
      queryFn: () => apiRequest("GET", `/api/customers/${customerId}`),
    });

  const showLoading = useMinimumLoadingTime(isCustomerLoading);

  useEffect(() => {
    // Proper reset
    if (!isOpen) {
      form.reset({
        firstName: undefined,
        lastName: undefined,
        email: undefined,
        phone: undefined,
        birthday: undefined,
        creditBalance: 0,
      });
      return;
    }

    if (isEditMode && customer) {
      // Pre-seed for edit
      form.reset({
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone,
        birthday: customer.birthday || undefined, // YYYY-MM-DD
        creditBalance: customer.creditBalance,
      });
    } else {
      // Nothing for add
      form.reset({
        firstName: undefined,
        lastName: undefined,
        email: undefined,
        phone: undefined,
        birthday: undefined,
        creditBalance: 0,
      });
    }
  }, [isEditMode, customer, isOpen]);

  // UPSERT
  const upsertCustomerMutation = useMutation({
    mutationFn: (data: CustomerFormData) => {
      const url = isEditMode
        ? `/api/customers/${customerId}`
        : `/api/customers`;

      // Clean up data before sending
      const cleanedData = {
        ...data,
        // Convert empty string to undefined for optional date field
        birthday: data.birthday === "" ? undefined : data.birthday,
      };

      return apiRequest("PUT", url, cleanedData);
    },
    onSuccess: async (serverResponse: string) => {
      const action = isEditMode ? "updated" : "created";
      const title = `Customer ${action}`;

      const minDelayPromise = new Promise((resolve) =>
        setTimeout(resolve, MIN_LOADING)
      );

      const invalidatePromises = Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/customers"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/customers/search"] }),
      ]);

      await Promise.all([minDelayPromise, invalidatePromises]);

      toastManager({
        title: title,
        description: serverResponse,
        status: "success",
      });

      onClose();
    },
    onError: (error: Error) => {
      const action = isEditMode ? "update" : "create";
      const title = `Customer ${action} failed`;
      const description = getErrorDescription(error.message);

      console.log(description);

      toastManager({
        title: title,
        description: description,
        status: "failure",
      });
    },
  });

  const showPendingUpsert = useMinimumLoadingTime(
    upsertCustomerMutation.isPending
  );

  const onSubmit = (data: CustomerFormData) => {
    // No need augment
    // Unset fields (eg: membership_type, membership_status)
    // Fallback to DB defaults, or NULL

    upsertCustomerMutation.mutate(data);
  };

  const deleteCustomerMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/customers/${customerId}`),

    onSuccess: async (serverResponse: string) => {
      const title = "Customer deleted";

      const minDelayPromise = new Promise((resolve) =>
        setTimeout(resolve, MIN_LOADING)
      );

      const invalidatePromises = Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/customers"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/customers/search"] }),
      ]);

      await Promise.all([minDelayPromise, invalidatePromises]);

      toastManager({
        title: title,
        description: serverResponse,
        status: "success",
      });

      onClose();
    },

    onError: (error: Error) => {
      const title = `Customer delete failed`;
      const description = getErrorDescription(error.message);

      toastManager({
        title: title,
        description: description,
        status: "failure",
      });
    },
  });

  const onDelete = () => {
    if (confirm("Are you sure you want to delete this customer?")) {
      deleteCustomerMutation.mutate();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-auto p-8">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-slate-800 flex items-center">
            {isEditMode ? "Edit Customer" : "Add Customer"}
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

        {showLoading ? (
          <LoadingSpinner />
        ) : (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-6 text-base text-slate-800"
            >
              <div className="grid grid-cols-2 gap-4">
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
                            value === "" ? undefined : value.toString();

                          field.onChange(stringValue);
                        }}
                        className="h-10 text-slate-800 !text-base placeholder:text-slate-400 py-5 focus:border-[color:hsl(var(--beauty-purple))]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Credits */}
              <FormField
                control={form.control}
                name="creditBalance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-600/93 font-semibold">
                      Current Credits
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={field.value ?? ""}
                        onChange={(e) => {
                          const value = e.target.value;
                          field.onChange(value === "" ? 0 : Number(value));
                        }}
                        className="h-10 text-slate-800 !text-base placeholder:text-slate-400 py-5 focus:border-[color:hsl(var(--beauty-purple))]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Birthday */}
              <FormField
                control={form.control}
                name="birthday"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-600/93 font-semibold">
                      Birthday
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        placeholder="Select date"
                        {...field}
                        className="h-10 text-slate-800 !text-base placeholder:text-slate-400 py-5 focus:border-[color:hsl(var(--beauty-purple))]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4">
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
                  {showPendingUpsert ? "Saving..." : "Save"}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
