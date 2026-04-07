import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, X } from "lucide-react";
import useDebounce from "@/hooks/use-debounce";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils/date-processing";
import { CustomerResponse } from "@/lib/types/customer";
import { apiRequest } from "@/lib/query-client";

interface CustomerDropdownProps {
  // Value -> customerId
  value: number | undefined;
  onChange: (newId: number) => void;
  disabled: boolean;
}

export default function CustomerDropdown({
  value,
  onChange,
  disabled,
}: CustomerDropdownProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const debouncedSearch = useDebounce(searchTerm.trim(), 300);

  const triggerRef = useRef<HTMLDivElement>(null);

  const [selectedCache, setSelectedCache] = useState<Map<number, CustomerResponse>>(
    () => new Map()
  );

  const { data: customers = [] } = useQuery<CustomerResponse[]>({
    queryKey: ["/api/customers"],
    queryFn: () => apiRequest("GET", "/api/customers"),
  });

  const { data: searchResults = [] } = useQuery<CustomerResponse[]>({
    queryKey: ["/api/customers/search", debouncedSearch],
    queryFn: () =>
      apiRequest(
        "GET",
        `/api/customers/search?search_query=${encodeURIComponent(debouncedSearch)}`
      ),
    enabled: debouncedSearch.length > 0,
  });

  const list = debouncedSearch.length > 0 ? searchResults : customers;

  const mergedMap = useMemo(() => {
    const m = new Map<number, CustomerResponse>();
    customers.forEach((c) => m.set(c.id, c));
    searchResults.forEach((c) => m.set(c.id, c));
    selectedCache.forEach((c, id) => m.set(id, c));
    return m;
  }, [customers, searchResults, selectedCache]);

  // If current value isn't in any local list, fetch it by id once
  const needFetchById = !!value && !mergedMap.has(value);
  const { data: fetchedById } = useQuery<CustomerResponse>({
    queryKey: ["/api/customers", value],
    queryFn: () => apiRequest("GET", `/api/customers/${value}`),
    enabled: needFetchById,
    staleTime: 5 * 60 * 1000,
  });

  // Store fetched-by-id in the local cache
  useEffect(() => {
    if (fetchedById?.id) {
      setSelectedCache((prev) => {
        if (prev.has(fetchedById.id)) return prev;
        const next = new Map(prev);
        next.set(fetchedById.id, fetchedById);
        return next;
      });
    }
  }, [fetchedById]);

  const valueToName = (id: number | undefined): string => {
    if (!id) return "Search customer";
    const c = mergedMap.get(id);
    if (c) return `${c.firstName} ${c.lastName}`;
    // Brief placeholder while by-id fetch runs
    return "Loading…";
  };

  // Outside clicks close dropdown
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDownCapture = (e: PointerEvent | MouseEvent) => {
      const target = e.target as HTMLElement;

      // Click lands outside of our field wrapper
      if (
        showDropdown &&
        wrapperRef.current &&
        !wrapperRef.current.contains(target)
      ) {
        // Close dropdown
        setShowDropdown(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDownCapture, true);
    document.addEventListener("click", onPointerDownCapture, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDownCapture, true);
      document.removeEventListener("click", onPointerDownCapture, true);
    };
  }, [showDropdown]);

  // Helper to refocus the trigger
  const closeAndRefocus = () => {
    setShowDropdown(false);
    setSearchTerm("");
    triggerRef.current?.focus();
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div
        ref={triggerRef}
        tabIndex={disabled ? -1 : 0}
        className={cn(
          "w-full px-3 py-2 text-left border border-input rounded-md bg-white flex items-center justify-between cursor-pointer focus:outline-none focus:ring-0 focus:border-[color:hsl(var(--beauty-purple))] select-none",
          disabled
            ? "text-green-800 cursor-not-allowed opacity-70"
            : value
              ? "text-slate-800 cursor-pointer"
              : "text-slate-400 cursor-pointer"
        )}
        onClick={() => !disabled && setShowDropdown((prev) => !prev)}
      >
        {value ? valueToName(value) : "Search customer"}
        <ChevronDown
          className={cn(
            "w-4 h-4 transition-colors",
            disabled ? "text-slate-400" : "text-slate-500"
          )}
        />
      </div>

      {showDropdown && (
        <div className="absolute w-full z-10 mt-3 bg-white border border-slate-500 rounded-md shadow-[0px_0.5px_8px_rgba(0,0,0,0.15)]">
          <div className="flex-1 flex items-center border-0 border-b border-input focus-within:border-purple-600 m-2 pl-2 pb-1">
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              type="text"
              placeholder="Search name"
              className="flex-1 text-base text-slate-800 placeholder:text-slate-400 focus:outline-none"
              autoFocus
            />
            {searchTerm && (
              <X
                onClick={() => setSearchTerm("")}
                className="w-6 h-6 p-1 text-slate-600 cursor-pointer rounded-lg hover:bg-gray-100"
              />
            )}
          </div>

          <div className="h-32 overflow-auto px-2 scrollbar-hide">
            {list.map((customer) => (
              <div
                key={customer.id}
                className="hover:bg-slate-200 p-2 rounded-lg"
                onClick={() => {
                  setSelectedCache((prev) => {
                    const next = new Map(prev);
                    next.set(customer.id, customer);
                    return next;
                  });
                  onChange(customer.id);
                  closeAndRefocus();
                }}
              >
                <div className="flex justify-between items-center">
                  <span className="text-base text-slate-800">
                    {customer.firstName} {customer.lastName}
                  </span>
                  <span className="text-sm text-slate-500 ml-2">
                    {customer.phone}
                  </span>
                </div>
              </div>
            ))}

            {list.length === 0 && (
              <div className="hover:bg-slate-200 p-2 rounded-lg" onClick={closeAndRefocus}>
                <span className="text-base text-slate-800">No results</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
