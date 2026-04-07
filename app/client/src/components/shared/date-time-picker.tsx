import { useState, useEffect, useRef } from "react";
import DatePicker from "react-datepicker";
import { DateTime } from "luxon";
import { ReadOnlyInput } from "./date-input";
import {
  getBusinessWindow,
  getEarliestForDate,
} from "@/lib/utils/business-hours";
import "react-datepicker/dist/react-datepicker.css";

interface DateTimePickerProps {
  value: string | undefined; // ISO string
  onChange: (iso: string) => void;
}

export function DateTimePicker({ value, onChange }: DateTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Processing defaults
  const singaporeNowRaw = DateTime.now().setZone("Asia/Singapore");
  const { opening: defaultOpening } = getBusinessWindow(singaporeNowRaw);

  const singaporeNowUpdated = singaporeNowRaw
    .set({ hour: defaultOpening })
    .startOf("hour");

  // For the DatePicker component, which only accepts JS Date
  const parsed = value
    ? DateTime.fromISO(value, { zone: "Asia/Singapore" })
    : singaporeNowUpdated;

  const safeSelectedDate = parsed.isValid ? parsed : singaporeNowUpdated;

  const selected = safeSelectedDate.toJSDate();
  const selectedDate = safeSelectedDate;

  // Set the initial form value
  useEffect(() => {
    if (!value) {
      // Always recompute the now
      const nowRaw = DateTime.now().setZone("Asia/Singapore");
      const { opening } = getBusinessWindow(nowRaw);
      const nowUpdated = nowRaw.set({ hour: opening }).startOf("hour");

      // Update the form value
      onChange(nowUpdated.toISO({ suppressMilliseconds: true }) as string);
    }
  }, [value, onChange]);

  const { opening, closing } = getBusinessWindow(selectedDate);

  const handleChange = (date: Date | null) => {
    if (!date) return;

    const picked = DateTime.fromJSDate(date, { zone: "Asia/Singapore" });
    const prev = selected ? selectedDate : null;

    const isDateChanged = prev ? !picked.hasSame(prev, "day") : true;
    const earliest = getEarliestForDate(picked);

    const finalDate = isDateChanged ? earliest : picked;

    // This changes value, which in-turn changes selected!
    onChange(finalDate.toISO({ suppressMilliseconds: true }) as string);
  };

  const minJS = selectedDate
    .set({ hour: opening, minute: 0 })
    .startOf("minute")
    .toJSDate();

  const maxJS = selectedDate
    .set({ hour: closing, minute: 0 })
    .startOf("minute")
    .toJSDate();

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

  // Scroll helper
  const scrollToSelectedTime = () => {
    const container = wrapperRef.current?.querySelector(
      ".react-datepicker__time-list"
    ) as HTMLElement | null;

    const selectedItem = wrapperRef.current?.querySelector(
      ".react-datepicker__time-list-item--selected"
    ) as HTMLElement | null;

    if (container && selectedItem) {
      // Scroll to center of selectedItem
      // Bring the top of item in view -> push up by half container height -> push down by half item height
      container.scrollTop =
        selectedItem.offsetTop -
        container.clientHeight / 2 +
        selectedItem.clientHeight / 2;
    }
  };

  // Scroll on date change while open
  useEffect(() => {
    if (isOpen) scrollToSelectedTime();
  }, [selected]);

  return (
    <div ref={wrapperRef}>
      <DatePicker
        selected={selected}
        onChange={handleChange}
        showTimeSelect
        disabledKeyboardNavigation
        timeIntervals={15}
        dateFormat="yyyy-MM-dd  h:mm aa"
        placeholderText="Select date & time"
        wrapperClassName="w-full"
        popperPlacement="bottom-end"
        minDate={singaporeNowRaw.startOf("day").toJSDate()}
        minTime={minJS}
        maxTime={maxJS}
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
