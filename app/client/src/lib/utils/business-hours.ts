// src/lib/businessHours.ts
import { DateTime } from "luxon";

export interface BusinessWindow {
  opening: number;
  closing: number;
}

export function getBusinessWindow(dt: DateTime): BusinessWindow {
  const isWeekend = dt.weekday === 6 || dt.weekday === 7;
  return {
    opening: isWeekend ? 10 : 11,
    closing: 21,
  };
}

export function snapToNext15(dt: DateTime): DateTime {
  const rem = dt.minute % 15;
  return rem === 0
    ? dt.startOf("minute")
    : dt.plus({ minutes: 15 - rem }).startOf("minute");
}

export function getEarliestForDate(picked: DateTime): DateTime {
  const { opening } = getBusinessWindow(picked);
  const openingDT = picked.set({ hour: opening, minute: 0 }).startOf("minute");
  return openingDT;
}
