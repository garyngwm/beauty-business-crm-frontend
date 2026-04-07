import { useState, useEffect, useRef } from "react";
import DateOnlyPicker from "react-datepicker";
import { DateTime } from "luxon";
import "react-datepicker/dist/react-datepicker.css";
import { ReadOnlyInput } from "./date-input";

interface DatePickerProps {
  value?: string; // ISO string
  onChange: (iso: string) => void;
}

export function DatePicker({ value, onChange }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const singaporeNow = DateTime.now().setZone("Asia/Singapore");

  const selected = value
    ? DateTime.fromISO(value, { zone: "Asia/Singapore" }).toJSDate()
    : null;

  const handleChange = (date: Date | null) => {
    if (!date) return;
    const picked = DateTime.fromJSDate(date, { zone: "Asia/Singapore" });

    // This changes value, which in-turn changes selected!
    onChange(picked.toFormat("yyyy-MM-dd"));
  };

  // Outside clicks close
  const wrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onPointerDownCapture = (e: PointerEvent | MouseEvent) => {
      const target = e.target as HTMLElement;

      // Click lands outside of our field wrapper
      if (
        isOpen &&
        wrapperRef.current &&
        !wrapperRef.current.contains(target)
      ) {
        // Close dropdown
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDownCapture, true);
    document.addEventListener("click", onPointerDownCapture, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDownCapture, true);
      document.removeEventListener("click", onPointerDownCapture, true);
    };
  }, [isOpen]);

  return (
    <div ref={wrapperRef}>
      <DateOnlyPicker
        selected={selected}
        onChange={handleChange}
        disabledKeyboardNavigation
        dateFormat="yyyy-MM-dd"
        placeholderText="Select date"
        wrapperClassName="w-full"
        popperPlacement="bottom-start"
        minDate={singaporeNow.startOf("day").toJSDate()}
        open={isOpen}
        onCalendarOpen={() => setIsOpen(true)}
        onCalendarClose={() => setIsOpen(false)}
        peekNextMonth={false}
        customInput={
          <ReadOnlyInput
            onToggle={() => setIsOpen((prev) => !prev)}
            isOpen={isOpen}
          />
        }
      />
    </div>
  );
}
