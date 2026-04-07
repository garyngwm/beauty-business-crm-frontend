import { useState, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  MapPin,
  Plus,
  MoreVertical,
  ChevronDown,
  X,
  Frown,
} from "lucide-react";
import { Button } from "~/button";
import Sidebar from "@/components/shared/sidebar";
import CollapsibleSidebar from "@/components/shared/togglable-sidebar";
import FilterOptions from "@/components/service/filter-options";
import CategoryModal from "@/components/service/category-modal";
import { cn } from "@/lib/utils/date-processing";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "~/dropdown-menu";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/tooltip";
import LoadingSpinner from "@/components/shared/loading-spinner";
import useDebounce from "@/hooks/use-debounce";
import { Badge } from "~/badge";
import { Link } from "wouter";
import { getOutletShortName } from "@/lib/utils/misc";
import { apiRequest } from "@/lib/query-client";
import { getErrorDescription } from "@/lib/utils/misc";
import { toastManager } from "@/components/shared/toast-manager";
import { MIN_LOADING } from "@/lib/constants";

import { type CategoryWithCountResponse } from "@/lib/types/service/category";
import { type CategoryColorResponse } from "@/lib/types/service/category-color";
import { type OutletResponse } from "@/lib/types/outlet/outlet";
import { type ServiceWithLocationsResponse } from "@/lib/types/service/service";

const SIDEBAR_ITEMS = [
  { name: "Overview", href: "/services" },
  { name: "Vouchers", href: "#" },
  { name: "Memberships", href: "#" },
  { name: "Products", href: "#" },
];

export default function Services() {
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(
    null
  );

  // Dropdown state
  const [showServiceDropdown, setShowServiceDropdown] = useState<number | null>(
    null
  );
  const [showCategoryDropdown, setShowCategoryDropdown] = useState<
    number | null
  >(null);
  const [isOutletToggleOpen, setIsOutletToggleOpen] = useState(false);

  // Filter fields
  // -1 always maps to all categories / outlets
  const [selectedCategoryId, setSelectedCategoryId] = useState(-1);
  const [selectedOutletId, setSelectedOutletId] = useState(-1);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm.trim(), 200);

  // null always maps to disregard
  const [isActive, setIsActive] = useState<boolean | null>(null);
  const [isOnlineBooking, setIsOnlineBooking] = useState<boolean | null>(null);
  const [isComission, setIsComission] = useState<boolean | null>(null);

  // Data fetching
  const { data: categoryColors = [], isLoading: isColorsLoading } = useQuery<
    CategoryColorResponse[]
  >({
    queryKey: [`/api/category-colors`],
    queryFn: () => apiRequest("GET", `/api/category-colors`),
  });

  const { data: services = [], isLoading: isServiceLoading } = useQuery<
    ServiceWithLocationsResponse[]
  >({
    queryKey: [`/api/services`],
    queryFn: () => apiRequest("GET", `/api/services`),
  });

  const { data: serviceCategories = [], isLoading: isCategoryLoading } =
    useQuery<CategoryWithCountResponse[]>({
      queryKey: [`/api/service-categories`],
      queryFn: () => apiRequest("GET", `/api/service-categories`),
    });

  const { data: outlets = [], isLoading: isOutletLoading } = useQuery<
    OutletResponse[]
  >({
    queryKey: [`/api/outlets`],
    queryFn: () => apiRequest("GET", `/api/outlets`),
  });

  const queryClient = useQueryClient();
  const deleteServiceCategoryMutation = useMutation({
    mutationFn: (categoryId: number) => {
      return apiRequest("DELETE", `/api/service-categories/${categoryId}`);
    },
    onSuccess: async (serverResponse: string) => {
      const minDelayPromise = new Promise((resolve) =>
        setTimeout(resolve, MIN_LOADING)
      );

      const invalidatePromises = Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["/api/service-categories"],
        }),
        queryClient.invalidateQueries({ queryKey: ["/api/services"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/appointments"] }),
      ]);

      await Promise.all([minDelayPromise, invalidatePromises]);

      toastManager({
        title: "Category delete success",
        description: serverResponse,
        status: "success",
      });
    },

    onError: (error: Error) => {
      const description = getErrorDescription(error.message);

      toastManager({
        title: "Category delete failed",
        description: description,
        status: "failure",
      });
    },
  });

  const deleteServiceMutation = useMutation({
    mutationFn: (serviceId: number) => {
      return apiRequest("DELETE", `/api/services/${serviceId}`);
    },
    onSuccess: async (serverResponse: string) => {
      const minDelayPromise = new Promise((resolve) =>
        setTimeout(resolve, MIN_LOADING)
      );

      const invalidatePromises = Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["/api/service-categories"],
        }),
        queryClient.invalidateQueries({ queryKey: ["/api/services"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/appointments"] }),
      ]);

      await Promise.all([minDelayPromise, invalidatePromises]);

      toastManager({
        title: "Category delete success",
        description: serverResponse,
        status: "success",
      });
    },

    onError: (error: Error) => {
      const description = getErrorDescription(error.message);

      toastManager({
        title: "Service delete failed",
        description: description,
        status: "failure",
      });
    },
  });

  // Helper for getting the total number of services
  const totalServiceCount = useMemo(
    () => serviceCategories.reduce((acc, cat) => acc + cat.serviceCount, 0),
    [serviceCategories]
  );

  // Combine loading states
  const isLoading =
    isServiceLoading || isCategoryLoading || isColorsLoading || isOutletLoading;

  // Data processing
  // First, establish a category id -> category object map
  const categoryMap = useMemo(
    () =>
      serviceCategories.reduce<Record<number, CategoryWithCountResponse>>(
        (acc, category) => {
          acc[category.id] = category;
          return acc;
        },
        {}
      ),
    [serviceCategories]
  );

  // Then, establish a color name -> hex map
  const colorMap = useMemo(
    () =>
      categoryColors.reduce<Record<string, string>>((acc, categoryColor) => {
        acc[categoryColor.name] = categoryColor.hex;
        return acc;
      }, {}),
    [categoryColors]
  );

  // Apply initial filters (excluding category filters)
  const filteredServices = useMemo(() => {
    let filtered = services;

    // Apply search filter
    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase();
      filtered = filtered.filter((s) =>
        s.name.toLowerCase().includes(searchLower)
      );
    }

    // Apply outlet filter
    if (selectedOutletId !== -1) {
      filtered = filtered.filter((s) => s.locations.includes(selectedOutletId));
    }

    // Apply active + onlineBooking + commissions filter
    if (isActive !== null) {
      filtered = filtered.filter((s) => s.active === isActive);
    }
    if (isOnlineBooking !== null) {
      filtered = filtered.filter((s) => s.onlineBookings === isOnlineBooking);
    }
    if (isComission !== null) {
      filtered = filtered.filter((s) => s.commissions === isComission);
    }

    return filtered;
  }, [
    services,
    debouncedSearch,
    selectedOutletId,
    isActive,
    isOnlineBooking,
    isComission,
  ]);

  // Then, group services by category id
  const servicesByCategory = useMemo(() => {
    // Initialize with all category IDs having empty arrays
    const initialAcc = serviceCategories.reduce<
      Record<number, ServiceWithLocationsResponse[]>
    >((acc, category) => {
      acc[category.id] = [];
      return acc;
    }, {});

    // Then populate with actual services
    return filteredServices.reduce<
      Record<number, ServiceWithLocationsResponse[]>
    >((acc, service) => {
      /*

        [Safety mechanism]
        1) Suppose filteredServices load BEFORE serviceCategories 
        2) Then, initialAcc is {}, and the key does NOT exist

        3) Thus, we implement a if guard clause 
        4) To protect against key errors
        5) So, when serviceCategories does load, we get the expected insertion :D

      */
      if (acc[service.categoryId]) {
        acc[service.categoryId].push(service);
      }
      return acc;
    }, initialAcc);
  }, [filteredServices, serviceCategories]);

  // Finally, apply a category filter
  const categoryFilteredServices = useMemo(() => {
    // Show all categories
    if (selectedCategoryId === -1) {
      return servicesByCategory;
    }

    // Show only selected category
    const selectedServices = servicesByCategory[selectedCategoryId];
    return selectedServices ? { [selectedCategoryId]: selectedServices } : {};
  }, [servicesByCategory, selectedCategoryId]);

  // We define different pathways to the category modal
  const handleAddCategory = () => {
    setEditingCategoryId(null);
    setIsCategoryModalOpen(true);
  };

  const handleEditCategory = (categoryId: number) => {
    setEditingCategoryId(categoryId);
    setIsCategoryModalOpen(true);
  };

  const handleDeleteCategory = (categoryId: number) => {
    if (confirm("Are you sure you want to delete this category?")) {
      setSelectedCategoryId(-1);
      deleteServiceCategoryMutation.mutate(categoryId);
    }
  };

  const handleDeleteService = (serviceId: number) => {
    if (confirm("Are you sure you want to delete this service?")) {
      deleteServiceMutation.mutate(serviceId);
    }
  };

  const clearSearchTerm = () => {
    setSearchTerm("");
  };

  // Only the ones shown as badges
  const clearFilters = () => {
    setSelectedOutletId(-1);
    setIsActive(null);
    setIsOnlineBooking(null);
    setIsComission(null);
  };

  // Everything
  const clearAll = () => {
    clearFilters();

    // Extra 2 things
    setSearchTerm("");
    setSelectedCategoryId(-1);
  };

  const hasActiveFilters =
    selectedOutletId !== -1 ||
    isActive !== null ||
    isOnlineBooking !== null ||
    isComission !== null;

  // Edge case
  const noValidResult =
    (searchTerm || hasActiveFilters) &&
    !Object.values(categoryFilteredServices).some((arr) => arr.length > 0);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-200">
      <Sidebar />
      <CollapsibleSidebar
        isOpen={isCatalogOpen}
        setIsOpen={setIsCatalogOpen}
        sidebarItems={SIDEBAR_ITEMS}
      />
      {isOutletToggleOpen && (
        <div className="z-30 absolute inset-0 bg-black/40 pointer-events-none" />
      )}
      {showCategoryDropdown && (
        <div className="z-30 absolute inset-0 bg-black/40 pointer-events-none" />
      )}
      {showServiceDropdown && (
        <div className="z-30 absolute inset-0 bg-black/40 pointer-events-none" />
      )}
      <div
        className={cn(
          // Parent is a flex container
          "flex-1 flex p-6 pl-0 transition-[margin-left] duration-300 ease-in-out justify-center ml-9"
        )}
      >
        <div className="w-full max-w-screen-xl flex flex-col p-5">
          {/* Sticky wrapper don't shrink */}
          <div className="relative sticky top-0 z-20 flex-shrink-0">
            {/* Header + Actions wrapper */}
            <div className="flex justify-between mb-6">
              <div>
                <h2 className="text-2xl font-semibold text-gray-800">
                  Service Menu
                </h2>
                <h3 className="text-gray-800 text-lg">
                  View and manage the services offered
                </h3>
              </div>

              <Link to="/services/view">
                <Button className="bg-beauty-purple hover:bg-beauty-purple-light text-white text-lg mt-2 py-6">
                  <Plus className="!w-5 !h-5 mr-[3px] mb-[2px]" />
                  Add Service
                </Button>
              </Link>
            </div>

            {/* Search bar + Icons wrapper */}
            <div className="flex flex-col bg-white shadow-md rounded-md mb-10">
              <div className="flex items-center p-4 pt-5">
                <div className="flex-1 flex items-center border-0 border-b border-input focus-within:border-purple-600 pl-2 pb-1">
                  <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    type="text"
                    placeholder="Search service name"
                    className="flex-1 text-lg text-slate-800 placeholder:text-slate-400 focus:outline-none"
                  />
                  {searchTerm && (
                    <X
                      onClick={clearSearchTerm}
                      className="w-6 h-6 p-1 text-slate-600 cursor-pointer rounded-lg hover:bg-gray-100"
                    />
                  )}
                </div>

                <div className="ml-7 flex items-center space-x-1">
                  <DropdownMenu
                    open={isOutletToggleOpen}
                    onOpenChange={setIsOutletToggleOpen}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <button className="cursor-pointer hover:bg-gray-200 p-2 rounded-lg">
                            <MapPin
                              className="w-6 h-6 text-slate-600"
                              strokeWidth={1.7}
                            />
                          </button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent
                        side="bottom"
                        align="end"
                        sideOffset={8}
                        className="text-sm"
                      >
                        {selectedOutletId === -1
                          ? "All Outlets"
                          : getOutletShortName(selectedOutletId)}
                      </TooltipContent>
                    </Tooltip>

                    <DropdownMenuContent
                      align="end"
                      alignOffset={10}
                      className="p-2 shadow-[0px_0.5px_8px_rgba(0,0,0,0.15)]"
                      // https://medium.com/@ojasskapre/fixing-input-focus-issues-in-a-shadcn-radix-card-ui-dropdown-menu-in-next-js-7b5931e049c8
                      onCloseAutoFocus={(e) => e.preventDefault()}
                    >
                      <DropdownMenuItem
                        onClick={() => setSelectedOutletId(-1)}
                        className={cn(
                          "text-base hover:!bg-gray-200",
                          selectedOutletId === -1
                            ? "text-green-700 hover:!text-green-700 font-semibold"
                            : ""
                        )}
                      >
                        All Outlets
                      </DropdownMenuItem>
                      {outlets.map((o) => (
                        <DropdownMenuItem
                          key={o.id}
                          onClick={() => setSelectedOutletId(o.id)}
                          className={cn(
                            "text-base hover:!bg-gray-200",
                            o.id === selectedOutletId
                              ? "text-green-700 hover:!text-green-700 font-semibold"
                              : ""
                          )}
                        >
                          {o.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Whenever these filters change, we remount */}
                  <FilterOptions
                    key={`${isActive}-${isOnlineBooking}-${isComission}`}
                    setIsActive={setIsActive}
                    setIsOnlineBooking={setIsOnlineBooking}
                    setIsComission={setIsComission}
                    isActive={isActive}
                    isOnlineBooking={isOnlineBooking}
                    isComission={isComission}
                  />
                </div>
              </div>

              {/* Filter Badges */}
              {hasActiveFilters && (
                <div className="flex items-center flex-wrap gap-2 mb-5 px-4">
                  {/* Outlet Badge */}
                  {selectedOutletId !== -1 && (
                    <Badge
                      variant="secondary"
                      tabIndex={0}
                      className="gap-1 pr-2 text-sm py-2 font-medium border-green-500 border-[2px] focus:outline-none focus:ring-0 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                    >
                      {getOutletShortName(selectedOutletId)}
                      <button
                        onClick={() => setSelectedOutletId(-1)}
                        className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </Badge>
                  )}

                  {/* Active Badge */}
                  {isActive !== null && (
                    <Badge
                      variant="secondary"
                      tabIndex={0}
                      className="gap-1 pr-2 text-sm py-2 font-medium border-green-500 border-[2px] focus:outline-none focus:ring-0 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                    >
                      {isActive ? "Active" : "Inactive"}
                      <button
                        onClick={() => setIsActive(null)}
                        className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </Badge>
                  )}

                  {/* Online Booking Badge */}
                  {isOnlineBooking !== null && (
                    <Badge
                      variant="secondary"
                      tabIndex={0}
                      className="gap-1 pr-2 text-sm py-2 font-medium border-green-500 border-[2px] focus:outline-none focus:ring-0 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                    >
                      {isOnlineBooking ? "Online Booking" : "No Online Booking"}
                      <button
                        onClick={() => setIsOnlineBooking(null)}
                        className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </Badge>
                  )}

                  {/* Commission Badge */}
                  {isComission !== null && (
                    <Badge
                      variant="secondary"
                      tabIndex={0}
                      className="gap-1 pr-2 text-sm py-2 font-medium border-green-500 border-[2px] focus:outline-none focus:ring-0 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                    >
                      {isComission ? "Commission" : "No Commission"}
                      <button
                        onClick={() => setIsComission(null)}
                        className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </Badge>
                  )}
                  <button
                    className="text-[0.95rem] text-purple-600 rounded-full font-semibold p-2 px-3"
                    onClick={clearFilters}
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Scrollable area takes remaining height */}
          <div className="flex-1 overflow-auto scrollbar-hide transform-gpu min-h-0">
            {/* Categories + Services */}
            {isLoading ? (
              <LoadingSpinner />
            ) : (
              <div className="flex gap-12">
                <div className="w-full self-start max-w-sm bg-white rounded-lg shadow-md px-3 py-2">
                  <div className="flex px-3 pt-1 pb-1 border-b border-input items-center justify-between">
                    <h3 className="text-lg text-gray-800 font-semibold">
                      Categories
                    </h3>
                    <button
                      type="button"
                      className="flex items-center p-2 text-sm font-medium text-purple-600 hover:bg-gray-200 rounded-lg"
                      onClick={handleAddCategory}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      <span className="text-base">New</span>
                    </button>
                  </div>

                  <div className="p-2 max-h-[60vh] mt-1">
                    {/* All categories option */}
                    <div
                      className={cn(
                        "flex items-center justify-between px-3 py-2 hover:bg-gray-200 rounded cursor-pointer transition-colors",
                        selectedCategoryId === -1
                          ? "bg-green-200 hover:bg-green-200"
                          : undefined
                      )}
                      onClick={() => setSelectedCategoryId(-1)}
                    >
                      <span className="text-base text-gray-800 font-medium">
                        All
                      </span>
                      <span className="text-base text-gray-600">
                        {totalServiceCount}
                      </span>
                    </div>

                    {/* Service categories */}
                    {serviceCategories.map((category) => (
                      <div
                        key={category.id}
                        className={cn(
                          "flex items-center justify-between px-3 py-2 hover:bg-gray-200 rounded cursor-pointer transition-colors",
                          selectedCategoryId === category.id
                            ? "bg-green-200 hover:bg-green-200"
                            : undefined
                        )}
                        onClick={() => setSelectedCategoryId(category.id)}
                      >
                        <span className="text-base text-gray-800">
                          {category.title}
                        </span>
                        <span className="text-base text-gray-600">
                          {category.serviceCount}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="w-full">
                  {!noValidResult &&
                    (
                      Object.entries(categoryFilteredServices) as [
                        string,
                        ServiceWithLocationsResponse[],
                      ][]
                    ).map(([idStr, services]) => {
                      const categoryId = Number(idStr);
                      const category = categoryMap[categoryId];
                      const categoryColorHex = colorMap[category.color];

                      // If the category has services
                      // But due to search or filter, the length is 0
                      // Then don't show the section
                      if (category.serviceCount > 0 && services.length === 0) {
                        return;
                      }

                      return (
                        <section key={categoryId} className="mb-10">
                          {/* Header */}
                          <div className="flex items-center justify-between mb-3 pr-2">
                            <h2 className="text-[1.0625rem] text-gray-800 font-semibold">
                              {category.title}
                            </h2>

                            <DropdownMenu
                              open={showCategoryDropdown === categoryId}
                              onOpenChange={(isOpen) =>
                                setShowCategoryDropdown(
                                  isOpen ? categoryId : null
                                )
                              }
                            >
                              <DropdownMenuTrigger asChild>
                                <button
                                  className={cn(
                                    "flex p-1.5 hover:bg-purple-200 rounded-full transition mb-1"
                                  )}
                                >
                                  <ChevronDown className="w-5 h-5 text-slate-800" />
                                </button>
                              </DropdownMenuTrigger>

                              <DropdownMenuContent
                                align="end"
                                sideOffset={8}
                                className="shadow-[0px_0.5px_8px_rgba(0,0,0,0.15)]"
                                onCloseAutoFocus={(e) => e.preventDefault()}
                              >
                                <DropdownMenuItem className="text-base text-gray-800 hover:!bg-gray-200">
                                  <Link
                                    to={`/services/view?categoryId=${categoryId}`}
                                  >
                                    Add Service
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-base text-gray-800 hover:!bg-gray-200"
                                  onClick={() => handleEditCategory(categoryId)}
                                >
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-base text-red-600 hover:!text-red-600 hover:!bg-gray-200"
                                  onClick={() =>
                                    handleDeleteCategory(categoryId)
                                  }
                                >
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          {/* Services List */}
                          <div className="pr-2">
                            {category.serviceCount === 0 ? (
                              <div
                                className="bg-white rounded-lg shadow-md px-6 py-6 hover:bg-purple-200/70 transition-colors mb-3"
                                style={{
                                  borderLeft: `7px solid ${categoryColorHex || "#6B7280"}`,
                                }}
                              >
                                No services
                              </div>
                            ) : (
                              services.map((service) => (
                                <Link
                                  key={service.id}
                                  to={`/services/view?serviceId=${service.id}`}
                                >
                                  <div
                                    className="bg-white rounded-lg shadow-md px-6 py-4 hover:bg-purple-200/70 transition-colors mb-3"
                                    style={{
                                      borderLeft: `7px solid ${categoryColorHex || "#6B7280"}`,
                                    }}
                                  >
                                    <div className="flex items-center justify-between">
                                      {/* Service Info */}
                                      <div className="flex-1">
                                        <h4 className="text-base font-medium text-gray-900">
                                          {service.name}
                                        </h4>
                                        <div className="text-sm text-gray-500">
                                          {service.duration} min •{" "}
                                          {service.creditCost} credits
                                        </div>
                                      </div>

                                      {/* Price & Actions */}
                                      <div className="flex items-center gap-3 ml-4">
                                        <div className="text-right">
                                          <span className="text-base font-medium text-gray-900 block">
                                            $ {service.cashPrice}
                                          </span>
                                        </div>

                                        <DropdownMenu
                                          open={
                                            showServiceDropdown === service.id
                                          }
                                          onOpenChange={(isOpen) =>
                                            setShowServiceDropdown(
                                              isOpen ? service.id : null
                                            )
                                          }
                                        >
                                          <DropdownMenuTrigger asChild>
                                            <button
                                              className="p-1 hover:bg-purple-300 rounded transition-colors"
                                              // Stop the click event from propogating up to parent
                                              onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                              }}
                                            >
                                              <MoreVertical
                                                className="w-5 h-5 text-purple-500"
                                                strokeWidth={2}
                                              />
                                            </button>
                                          </DropdownMenuTrigger>

                                          <DropdownMenuContent
                                            align="end"
                                            sideOffset={8}
                                            className="w-40"
                                            onCloseAutoFocus={(e) =>
                                              e.preventDefault()
                                            }
                                            // Stop the click event from propogating up to parent
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <DropdownMenuItem asChild>
                                              <Link
                                                to={`/services/view?serviceId=${service.id}`}
                                                className="!text-base !text-gray-800 hover:!bg-gray-200"
                                              >
                                                Edit
                                              </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                              className="text-base text-red-600 hover:!text-red-600 hover:!bg-gray-200"
                                              onClick={() =>
                                                handleDeleteService(service.id)
                                              }
                                            >
                                              Delete
                                            </DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </div>
                                    </div>
                                  </div>
                                </Link>
                              ))
                            )}
                          </div>
                        </section>
                      );
                    })}

                  {/* Empty State */}
                  {noValidResult && (
                    <div className="text-center py-12">
                      <Frown className="self-center mx-auto w-10 h-10 text-slate-500 mb-4" />

                      <h3 className="text-lg font-medium text-gray-900 mb-1">
                        No services found
                      </h3>

                      <p className="text-gray-600 mb-8">
                        Try adjusting your search criteria
                      </p>
                      <Button
                        className="bg-beauty-purple hover:bg-purple-700 text-base"
                        onClick={clearAll}
                      >
                        Clear Filters
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <CategoryModal
            isOpen={isCategoryModalOpen}
            onClose={() => {
              setIsCategoryModalOpen(false);
              setEditingCategoryId(null);
            }}
            categoryId={editingCategoryId}
          />
        </div>
      </div>
    </div>
  );
}
