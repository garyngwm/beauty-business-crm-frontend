import { useState, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  Plus,
  ArrowUpDown,
  MoreVertical,
  X,
  MoveUp,
  MoveDown,
  Frown,
  ChevronDown,
} from "lucide-react";
import { Button } from "~/button";
import Sidebar from "@/components/shared/sidebar";
import CollapsibleSidebar from "@/components/shared/togglable-sidebar";
import FilterOptions from "@/components/staff/filter-options";
import { cn } from "@/lib/utils/date-processing";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "~/dropdown-menu";
import LoadingSpinner from "@/components/shared/loading-spinner";
import useDebounce from "@/hooks/use-debounce";
import { Badge } from "~/badge";
import { Link } from "wouter";
import { apiRequest } from "@/lib/query-client";
import { getOutletShortName } from "@/lib/utils/misc";
import { toastManager } from "@/components/shared/toast-manager";
import { MIN_LOADING } from "@/lib/constants";
import { getErrorDescription } from "@/lib/utils/misc";

import type {
  StaffWithLocationsResponse,
  StaffStatsResponse,
} from "@/lib/types/staff/staff";

const SIDEBAR_ITEMS = [
  { name: "Overview", href: "/staffs" },
  { name: "Shifts", href: "#" },
];

type SortOptions =
  | "NAME_ASC"
  | "NAME_DESC"
  | "JOB_TITLE_ASC"
  | "JOB_TITLE_DESC";

type StatusOptions = "ALL" | "ACTIVE" | "INACTIVE";

export default function Staffs() {
  const [isCollapsibleSidebarOpen, setIsCollapsibleSidebarOpen] =
    useState(false);

  // Dropdown state
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showStaffDropdown, setShowStaffDropdown] = useState<number | null>(
    null
  );
  const [showStatusDropdown, setShowStatusDropdown] = useState<string | null>(
    null
  );

  // Sort state
  const [sortBy, setSortBy] = useState<SortOptions | null>(null);

  // Filter fields
  // -1 always maps to all outlets
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm.trim(), 200);

  const [selectedStatus, setSelectedStatus] = useState<StatusOptions>("ALL");

  // null always maps to disregard
  const [selectedOutletId, setSelectedOutletId] = useState(-1);
  const [isBookable, setIsBookable] = useState<boolean | null>(null);

  // Data fetching
  const { data: staffs = [], isLoading: isStaffsLoading } = useQuery<
    StaffWithLocationsResponse[]
  >({
    queryKey: ["/api/staffs"],
    queryFn: () => apiRequest("GET", "/api/staffs"),
  });

  const {
    data: staffStats = { active: 0, inactive: 0 },
    isLoading: isStaffStatsLoading,
  } = useQuery<StaffStatsResponse>({
    queryKey: ["/api/staffs/stats"],
    queryFn: () => apiRequest("GET", "/api/staffs/stats"),
  });

  const isLoading = isStaffsLoading || isStaffStatsLoading;

  // Data processing
  // First, apply initial filters
  const filteredStaffs = useMemo(() => {
    let filtered = staffs;

    // Apply search filter
    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.firstName.toLowerCase().includes(searchLower) ||
          s.lastName.toLowerCase().includes(searchLower)
      );
    }

    // Apply bookable and outlet filters
    if (isBookable !== null) {
      filtered = filtered.filter((s) => s.bookable === isBookable);
    }
    if (selectedOutletId !== -1) {
      filtered = filtered.filter((s) =>
        s.locations.includes(selectedOutletId as 1 | 2)
      );
    }

    return filtered;
  }, [staffs, debouncedSearch, selectedOutletId, isBookable]);

  // Then, apply the sort method, if any
  const sortedStaffs = useMemo(() => {
    switch (sortBy) {
      case "NAME_ASC":
        return [...filteredStaffs].sort((a, b) => {
          const aFullName = (a.firstName + " " + a.lastName).toLowerCase();
          const bFullName = (b.firstName + " " + b.lastName).toLowerCase();
          return aFullName.localeCompare(bFullName);
        });

      case "NAME_DESC":
        return [...filteredStaffs].sort((a, b) => {
          const aFullName = (a.firstName + " " + a.lastName).toLowerCase();
          const bFullName = (b.firstName + " " + b.lastName).toLowerCase();
          return bFullName.localeCompare(aFullName);
        });

      case "JOB_TITLE_ASC":
        return [...filteredStaffs].sort((a, b) => {
          return a.role.localeCompare(b.role);
        });

      case "JOB_TITLE_DESC":
        return [...filteredStaffs].sort((a, b) => {
          return b.role.localeCompare(a.role);
        });

      default:
        return filteredStaffs;
    }
  }, [filteredStaffs, sortBy]);

  // Then, group staffs by status
  const staffsByStatus = useMemo(() => {
    // Initialize all status having empty arrays
    const initial = {
      ACTIVE: [],
      INACTIVE: [],
    };

    // Then populate with actual staffs
    return sortedStaffs.reduce<Record<string, StaffWithLocationsResponse[]>>(
      (acc, staff) => {
        if (staff.active) {
          acc["ACTIVE"].push(staff);
        } else {
          acc["INACTIVE"].push(staff);
        }

        return acc;
      },
      initial
    );
  }, [sortedStaffs]);

  // Finally, apply a status filter
  const statusFilteredStaffs = useMemo(() => {
    // Show all categories
    if (selectedStatus === "ALL") {
      return staffsByStatus;
    }

    // Show only staffs from selected status
    const selectedStaffs = staffsByStatus[selectedStatus];
    return selectedStaffs ? { [selectedStatus]: selectedStaffs } : {};
  }, [staffsByStatus, selectedStatus]);

  // Mutations here
  const queryClient = useQueryClient();

  const deleteStaffMutation = useMutation({
    mutationFn: (staffId: number) => {
      return apiRequest("DELETE", `/api/staffs/${staffId}`);
    },
    onSuccess: async (serverResponse: string) => {
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
        title: "Staff delete success",
        description: serverResponse,
        status: "success",
      });
    },

    onError: (error: Error) => {
      const description = getErrorDescription(error.message);

      toastManager({
        title: "Staff delete failed",
        description: description,
        status: "failure",
      });
    },
  });

  const handleDeleteStaff = (staffId: number) => {
    if (confirm("Are you sure you want to delete this staff?")) {
      deleteStaffMutation.mutate(staffId);
    }
  };

  // Helper to map sortBy to display name
  const sortByDisplayName = () => {
    switch (sortBy) {
      // Force two whitespaces
      case "NAME_ASC":
        return "Name\u00A0\u00A0A → Z";

      case "NAME_DESC":
        return "Name\u00A0\u00A0Z → A";

      case "JOB_TITLE_ASC":
        return "Title\u00A0\u00A0A → Z";

      case "JOB_TITLE_DESC":
        return "Title\u00A0\u00A0Z → A";
    }
  };

  const clearSearchTerm = () => {
    setSearchTerm("");
  };

  // Only the ones shown as badges
  const clearFiltersAndSort = () => {
    setIsBookable(null);
    setSelectedOutletId(-1);
    setSortBy(null);
  };

  // Everything
  const clearAll = () => {
    clearFiltersAndSort();

    setSelectedStatus("ALL");
    setSearchTerm("");
  };

  const hasActiveFilters = selectedOutletId !== -1 || isBookable !== null;

  // Edge case
  const noValidResult =
    (searchTerm || hasActiveFilters || sortBy) &&
    !Object.values(statusFilteredStaffs).some((arr) => arr.length > 0);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-200">
      <Sidebar />
      <CollapsibleSidebar
        isOpen={isCollapsibleSidebarOpen}
        setIsOpen={setIsCollapsibleSidebarOpen}
        sidebarItems={SIDEBAR_ITEMS}
      />
      {showSortDropdown && (
        <div className="z-30 absolute inset-0 bg-black/40 pointer-events-none" />
      )}
      {showStaffDropdown && (
        <div className="z-30 absolute inset-0 bg-black/40 pointer-events-none" />
      )}
      {showStatusDropdown && (
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
                  Team Members
                </h2>
                <h3 className="text-gray-800 text-lg">
                  View and manage the team
                </h3>
              </div>

              <Link to="/staffs/view">
                <Button className="bg-beauty-purple hover:bg-beauty-purple-light text-white text-lg mt-2 py-6">
                  <Plus className="!w-5 !h-5 mr-[3px] mb-[2px]" />
                  Add Staff
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
                    placeholder="Search staff name"
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
                    open={showSortDropdown}
                    onOpenChange={setShowSortDropdown}
                  >
                    <DropdownMenuTrigger asChild>
                      <button className="cursor-pointer hover:bg-gray-200 p-2 rounded-lg">
                        <ArrowUpDown
                          className="w-6 h-6 text-slate-600"
                          strokeWidth={1.7}
                        />
                      </button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent
                      align="end"
                      alignOffset={10}
                      className="shadow-[0px_0.5px_8px_rgba(0,0,0,0.15)] p-2"
                      // https://medium.com/@ojasskapre/fixing-input-focus-issues-in-a-shadcn-radix-card-ui-dropdown-menu-in-next-js-7b5931e049c8
                      onCloseAutoFocus={(e) => e.preventDefault()}
                    >
                      <DropdownMenuItem
                        className="text-base text-slate-800 hover:!bg-gray-200 flex items-center"
                        onClick={() => setSortBy("NAME_ASC")}
                      >
                        Name
                        <MoveUp className="text-slate-600" />
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-base text-slate-800 hover:!bg-gray-200 flex items-center"
                        onClick={() => setSortBy("NAME_DESC")}
                      >
                        Name
                        <MoveDown className="text-slate-600" />
                      </DropdownMenuItem>

                      <DropdownMenuSeparator className="my-2 bg-slate-400 w-[90%] mx-auto" />

                      <DropdownMenuItem
                        className="text-base text-slate-800 hover:!bg-gray-200 flex items-center"
                        onClick={() => setSortBy("JOB_TITLE_ASC")}
                      >
                        Job Title
                        <MoveUp className="text-slate-600" />
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-base text-slate-800 hover:!bg-gray-200 flex items-center"
                        onClick={() => setSortBy("JOB_TITLE_DESC")}
                      >
                        Job Title
                        <MoveDown className="text-slate-600" />
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Whenever these filters change, we remount */}
                  <FilterOptions
                    key={`${selectedOutletId}-${isBookable}`}
                    setSelectedOutletId={setSelectedOutletId}
                    setIsBookable={setIsBookable}
                    selectedOutletId={selectedOutletId}
                    isBookable={isBookable}
                  />
                </div>
              </div>

              {/* Filter & Sort Badges */}
              {(hasActiveFilters || sortBy) && (
                <div className="flex items-center flex-wrap gap-2 mb-5 px-4">
                  {sortBy && (
                    <Badge
                      variant="secondary"
                      tabIndex={0}
                      className="w-auto gap-1 pr-2 text-sm py-2 font-medium border-green-500 border-[2px] focus:outline-none focus:ring-0 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                    >
                      {sortByDisplayName()}
                      <button
                        onClick={() => setSortBy(null)}
                        className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </Badge>
                  )}

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

                  {/* Bookable Badge */}
                  {isBookable !== null && (
                    <Badge
                      variant="secondary"
                      tabIndex={0}
                      className="gap-1 pr-2 text-sm py-2 font-medium border-green-500 border-[2px] focus:outline-none focus:ring-0 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                    >
                      {isBookable ? "Bookable" : "Non-bookable"}
                      <button
                        onClick={() => setIsBookable(null)}
                        className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </Badge>
                  )}

                  <button
                    className="text-[0.95rem] text-purple-600 rounded-full font-semibold p-2 px-3"
                    onClick={clearFiltersAndSort}
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Scrollable area takes remaining height */}
          <div className="flex-1 overflow-auto scrollbar-hide transform-gpu min-h-0">
            {isLoading ? (
              <LoadingSpinner />
            ) : (
              <div className="flex gap-12">
                {/* Status */}
                <div className="w-1/2 self-start max-w-sm bg-white rounded-lg shadow-md px-3 py-2">
                  <div className="flex px-3 py-2 border-b border-input">
                    <h3 className="text-lg text-gray-800 font-semibold">
                      Status
                    </h3>
                  </div>

                  <div className="p-1 max-h-[60vh] mt-1">
                    <div
                      className={cn(
                        "flex items-center justify-between px-3 py-2 hover:bg-gray-200 rounded cursor-pointer transition-colors",
                        selectedStatus === "ALL"
                          ? "bg-green-200 hover:bg-green-200"
                          : undefined
                      )}
                      onClick={() => setSelectedStatus("ALL")}
                    >
                      <span className="text-base text-gray-800 font-medium">
                        All
                      </span>
                      <span className="text-base text-gray-800 font-medium">
                        {staffStats.active + staffStats.inactive}
                      </span>
                    </div>

                    {["Active", "Inactive"].map((status, index) => (
                      <div
                        key={index}
                        className={cn(
                          "flex items-center justify-between px-3 py-2 hover:bg-gray-200 rounded cursor-pointer transition-colors",
                          selectedStatus === status.toUpperCase()
                            ? "bg-green-200 hover:bg-green-200"
                            : undefined
                        )}
                        onClick={() =>
                          setSelectedStatus(
                            status.toUpperCase() as StatusOptions
                          )
                        }
                      >
                        <span className="text-base text-gray-800">
                          {status}
                        </span>
                        <span className="text-base text-gray-800">
                          {status === "Active"
                            ? staffStats.active
                            : staffStats.inactive}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Staffs */}
                <div className="w-full">
                  {!noValidResult &&
                    (
                      Object.entries(statusFilteredStaffs) as [
                        Omit<StatusOptions, "ALL">,
                        StaffWithLocationsResponse[],
                      ][]
                    ).map(([status, staffs]) => {
                      const statusName =
                        status[0] + status.slice(1).toLowerCase();

                      const statusColorHex =
                        statusName === "Active" ? "#A5B4FC" : "#F3CB9EFF";

                      // If the status has staffs
                      // But due to search or filter, the length is 0
                      // Then don't show the section
                      if (
                        status === "ACTIVE" &&
                        staffStats["active"] > 0 &&
                        staffs.length === 0
                      ) {
                        return;
                      }

                      if (
                        status === "INACTIVE" &&
                        staffStats["inactive"] > 0 &&
                        staffs.length === 0
                      ) {
                        return;
                      }

                      return (
                        <section key={statusName} className="mb-10 pr-2">
                          <div className="flex items-center justify-between mb-3 pr-2">
                            <h2 className="text-[1.0625rem] text-gray-800 font-semibold">
                              {statusName}
                            </h2>
                            <DropdownMenu
                              open={showStatusDropdown === status.toLowerCase()}
                              onOpenChange={(isOpen) =>
                                setShowStatusDropdown(
                                  isOpen ? status.toLowerCase() : null
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
                                    to={`/staffs/view?status=${status.toLowerCase()}`}
                                  >
                                    Add Staff
                                  </Link>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          {/* Staff List */}
                          <div className="pr-2">
                            {staffStats[
                              status.toLowerCase() as "active" | "inactive"
                            ] === 0 ? (
                              <div
                                className="bg-white rounded-lg shadow-md px-6 py-7 hover:bg-purple-200/70 transition-colors mb-3"
                                style={{
                                  borderLeft: `7px solid ${statusColorHex || "#6B7280"}`,
                                }}
                              >
                                No staffs
                              </div>
                            ) : (
                              staffs.map((member) => (
                                <Link
                                  key={member.id}
                                  href={`/staffs/view?staffId=${member.id}`}
                                >
                                  <div
                                    className="bg-white rounded-lg shadow-md px-6 py-4 hover:bg-purple-200 transition-colors flex items-center mb-3"
                                    style={{
                                      borderLeft: `7px solid ${statusColorHex}`,
                                    }}
                                  >
                                    <div className="flex items-center gap-4 flex-1 mr-16">
                                      <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center text-white text-lg">
                                        {member.firstName[0]}
                                        {member.lastName[0]}
                                      </div>

                                      <div className="flex flex-col">
                                        <span className="text-lg text-gray-800 mb-[1px]">
                                          {member.firstName} {member.lastName}
                                        </span>
                                        <span className="text-base text-slate-500">
                                          {member.role}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Price & Actions */}
                                    <div className="flex items-center gap-3 ml-4">
                                      <DropdownMenu
                                        open={showStaffDropdown === member.id}
                                        onOpenChange={(isOpen) =>
                                          setShowStaffDropdown(
                                            isOpen ? member.id : null
                                          )
                                        }
                                      >
                                        <DropdownMenuTrigger asChild>
                                          <button className="p-2 hover:bg-purple-300 rounded-lg transition-colors">
                                            <MoreVertical className="w-6 h-6 text-purple-500" />
                                          </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent
                                          align="end"
                                          className="shadow-lg"
                                          onCloseAutoFocus={(e) =>
                                            e.preventDefault()
                                          }
                                          // Stop the click event from propogating up to parent
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <DropdownMenuItem asChild>
                                            <Link
                                              to={`/staffs/view?staffId=${member.id}`}
                                              className="w-full !text-base hover:!bg-gray-200"
                                            >
                                              Edit
                                            </Link>
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            className="text-base text-red-600 hover:!text-red-600 hover:!bg-gray-200"
                                            onClick={() =>
                                              handleDeleteStaff(member.id)
                                            }
                                          >
                                            Delete
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
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
                        No staff found
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
        </div>
      </div>
    </div>
  );
}
