import { forwardRef } from "react";
import { cn } from "@/lib/utils/date-processing";

export const ReadOnlyInput = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & {
    onToggle: () => void;
    isOpen?: boolean;
  }
>(({ value, onToggle, isOpen, ...props }, forwardedRef) => {
  return (
    <input
      ref={forwardedRef}
      value={value}
      {...props}
      readOnly
      onMouseDown={(e) => {
        // Prevent text selection when pressing
        e.preventDefault();

        // Clear any existing focus
        (document.activeElement as HTMLElement)?.blur();
        onToggle();
      }}
      onFocus={(e) => {
        // Prevent text selection when tabbing/focusing
        e.target.setSelectionRange(0, 0);
      }}
      className={cn(
        "w-full h-10 px-3 py-5 border rounded-md border-input cursor-pointer focus:outline-none focus:ring-0 placeholder:text-slate-400 bg-transparent !select-none",
        isOpen
          ? "border-[color:hsl(var(--beauty-purple))]"
          : "focus-visible:border-[color:hsl(var(--beauty-purple))] border-input",

        // Updated SVG background image with slate-500 color and h-4 w-4 size (1rem)
        `bg-[url("data:image/svg+xml;utf8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='1rem'%20height='1rem'%20viewBox='0%200%2024%2024'%20fill='none'%20stroke='%236b7280'%20stroke-width='2'%20stroke-linecap='round'%20stroke-linejoin='round'%20class='lucide%20lucide-calendar-icon%20lucide-calendar'%3E%3Cpath%20d='M8%202v4'/%3E%3Cpath%20d='M16%202v4'/%3E%3Crect%20width='18'%20height='18'%20x='3'%20y='4'%20rx='2'/%3E%3Cpath%20d='M3%2010h18'/%3E%3C/svg%3E")]`,
        "bg-no-repeat bg-[right_0.75rem_center]"
      )}
    />
  );
});

ReadOnlyInput.displayName = "ReadOnlyInput";
