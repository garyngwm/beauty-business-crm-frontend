import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils/date-processing";
import useDebounce from "@/hooks/use-debounce";
import type { Service } from "../service/service-field";

interface ServiceDropdownProps {
  services: Service[];

  // store in form as number[]
  value: number[]; // selected serviceIds
  disabled: boolean;

  isEditMode: boolean;
  onChangeSingle: (id: number) => void; // sets [id]
  onChangeMulti: (ids: number[]) => void; // sets array
}

export default function ServiceDropdown({
  services,
  value,
  disabled,
  isEditMode,
  onChangeSingle,
  onChangeMulti,
}: ServiceDropdownProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const debouncedSearch = useDebounce(searchTerm.trim(), 200);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const selectedSet = useMemo(() => new Set(value ?? []), [value]);

  const filtered = useMemo(() => {
    if (!debouncedSearch) return services;

    const q = debouncedSearch.toLowerCase();
    return services.filter((s) => {
      const hay = `${s.name} ${s.duration} ${s.creditCost} ${s.cashPrice}`.toLowerCase();
      return hay.includes(q);
    });
  }, [services, debouncedSearch]);

  const selectedLabel = useMemo(() => {
    if (!value?.length) return isEditMode ? "Select service" : "Select services";

    const names = services
      .filter((s) => selectedSet.has(s.id))
      .map((s) => s.name);

    if (isEditMode) return names[0] ?? "Select service";
    return names.length ? names.join(", ") : "Select services";
  }, [value, services, selectedSet, isEditMode]);

  // outside clicks close dropdown
  useEffect(() => {
    const onPointerDownCapture = (e: PointerEvent | MouseEvent) => {
      const target = e.target as HTMLElement;
      if (showDropdown && wrapperRef.current && !wrapperRef.current.contains(target)) {
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

  const closeAndRefocus = () => {
    setShowDropdown(false);
    setSearchTerm("");
    triggerRef.current?.focus();
  };

  const toggleMulti = (id: number) => {
    const next = new Set(selectedSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChangeMulti(Array.from(next));
  };

  const onPick = (id: number) => {
    if (isEditMode) {
      onChangeSingle(id);
      closeAndRefocus();
      return;
    }
    // create mode: toggle only
    toggleMulti(id);
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
            : value?.length
              ? "text-slate-800 cursor-pointer"
              : "text-slate-400 cursor-pointer"
        )}
        onClick={() => !disabled && setShowDropdown((prev) => !prev)}
      >
        <span className={cn(!value?.length && "text-slate-400")}>{selectedLabel}</span>
        <ChevronDown
          className={cn(
            "w-4 h-4 transition-colors",
            disabled ? "text-slate-400" : "text-slate-500"
          )}
        />
      </div>

      {showDropdown && (
        <div className="absolute w-full z-10 mt-3 bg-white border border-slate-500 rounded-md shadow-[0px_0.5px_8px_rgba(0,0,0,0.15)]">
          {/* search bar */}
          <div className="flex-1 flex items-center border-0 border-b border-input focus-within:border-purple-600 m-2 pl-2 pb-1">
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              type="text"
              placeholder="Search services"
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

          {/* list */}
          <div className="max-h-72 overflow-auto px-2 scrollbar-hide">
            {filtered.map((service) => {
              const checked = selectedSet.has(service.id);

              return (
                <div
                  key={service.id}
                  className="hover:bg-slate-200 p-2 rounded-lg cursor-pointer"
                  onClick={(e) => {
                    e.preventDefault();
                    onPick(service.id);
                  }}
                >
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <div className="font-medium text-slate-800">
                        {service.name}
                      </div>
                      <div className="text-sm text-slate-600">
                        {service.duration} min • {service.creditCost} credits / ${service.cashPrice}
                      </div>
                    </div>

                    {/* right side */}
                    {isEditMode ? (
                      checked && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                          Selected
                        </span>
                      )
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          readOnly
                          className="h-4 w-4 accent-purple-600"
                          onClick={(e) => e.stopPropagation()}
                        />
                        {checked && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                            Selected
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="hover:bg-slate-200 p-2 rounded-lg cursor-pointer" onClick={closeAndRefocus}>
                <span className="text-base text-slate-800">No results</span>
              </div>
            )}
          </div>

          {/* footer actions (optional) */}
          {!isEditMode && (
            <div className="flex justify-end gap-2 p-2 border-t border-slate-200">
              <button
                type="button"
                className="text-sm text-slate-600 hover:text-slate-900"
                onClick={() => onChangeMulti([])}
              >
                Clear
              </button>
              <button
                type="button"
                className="text-sm text-slate-600 hover:text-slate-900"
                onClick={closeAndRefocus}
              >
                Done
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
