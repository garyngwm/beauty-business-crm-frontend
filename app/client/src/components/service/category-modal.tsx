import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/dialog";
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
import { Input } from "~/input";
import { Textarea } from "~/textarea";
import { cn } from "@/lib/utils/date-processing";
import { useQuery } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { toastManager } from "../shared/toast-manager";
import { apiRequest, queryClient } from "@/lib/query-client";
import LoadingSpinner from "../shared/loading-spinner";
import { useEffect } from "react";
import { useMinimumLoadingTime } from "@/hooks/use-min-loading";
import { MIN_LOADING } from "@/lib/constants";
import { getErrorDescription } from "@/lib/utils/misc";
import {
  categoryFormSchema,
  type CategoryFormData,
  type CategoryResponse,
} from "@/lib/types/service/category";
import { type CategoryColorResponse } from "@/lib/types/service/category-color";

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  categoryId: number | null;
}

export default function CategoryModal({
  isOpen,
  onClose,
  categoryId,
}: CategoryModalProps) {
  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      title: undefined,
      color: undefined,
      description: undefined,
    },
  });

  const isEditMode = !!categoryId;

  // If edit intention, fetch the category to edit first
  const { data: editCategory, isLoading: isEditLoading } =
    useQuery<CategoryResponse>({
      queryKey: [`/api/service-categories/${categoryId}`],
      enabled: isEditMode,
      queryFn: () => apiRequest("GET", `/api/service-categories/${categoryId}`),
    });

  // Proper seeding
  useEffect(() => {
    if (!isOpen) return;

    if (isEditMode && editCategory) {
      form.reset({
        title: editCategory.title,
        color: editCategory.color,
        description: editCategory.description ?? undefined,
      });
    }
  }, [editCategory, isEditMode, isOpen]);

  // Proper resetting
  useEffect(() => {
    if (!isOpen) {
      form.reset({
        title: undefined,
        color: undefined,
        description: undefined,
      });
    }
  }, [isOpen]);

  // Color lookup array
  const { data: categoryColors = [], isLoading: isColorsLoading } = useQuery<
    CategoryColorResponse[]
  >({
    queryKey: ["/api/category-colors"],
    queryFn: () =>
      fetch("/api/category-colors").then((res) => {
        if (!res.ok) throw new Error("Failed to fetch category colors");
        return res.json();
      }),
  });

  const upsertServiceCategoryMutation = useMutation({
    mutationFn: (data: CategoryFormData) => {
      const url = categoryId
        ? `/api/service-categories/${categoryId}`
        : `/api/service-categories`;

      return apiRequest("PUT", url, data);
    },
    onSuccess: async (serverResponse: string) => {
      const action = categoryId ? "updated" : "created";
      const title = `Category ${action}`;

      const minDelayPromise = new Promise((resolve) =>
        setTimeout(resolve, MIN_LOADING)
      );

      const invalidatePromises = Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["/api/service-categories"],
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
    onError: (error: Error) => {
      const action = categoryId ? "update" : "create";
      const title = `Category ${action} failed`;
      const description = getErrorDescription(error.message);

      toastManager({
        title: title,
        description: description,
        status: "failure",
      });
    },
  });
  const showPendingUpsert = useMinimumLoadingTime(
    upsertServiceCategoryMutation.isPending
  );

  // Initial loading state
  const isLoading = categoryId
    ? isEditLoading || isColorsLoading
    : isColorsLoading;

  const showLoading = useMinimumLoadingTime(isLoading);

  // Initiates the whole submit process
  const onSubmit = (data: CategoryFormData) => {
    upsertServiceCategoryMutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-6">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-semibold text-slate-800">
              {categoryId ? "Edit Category" : "Add Category"}
            </DialogTitle>
          </div>
        </DialogHeader>

        {showLoading ? (
          <LoadingSpinner />
        ) : (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-6 text-base text-slate-800"
            >
              {/* Category name */}
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
                        placeholder="Hair services"
                        {...field}
                        className="h-10 text-slate-800 !text-base placeholder:text-slate-400 py-5 focus:border-[color:hsl(var(--beauty-purple))]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Appointment color */}
              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-600/93 font-semibold">
                      Color
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
                          <SelectValue placeholder="Select color" />
                        </SelectTrigger>
                        <SelectContent
                          sideOffset={8}
                          className="border border-slate-500 shadow-[0px_0.5px_8px_rgba(0,0,0,0.15)]"
                        >
                          {categoryColors.map((color) => (
                            <SelectItem
                              key={color.id}
                              value={color.name}
                              className="!text-base !text-slate-800 hover:!bg-slate-200"
                            >
                              <div className="flex items-center gap-2">
                                <div
                                  className="h-4 w-4 rounded-full"
                                  style={{ backgroundColor: color.hex }}
                                />
                                <span>{color.name}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
