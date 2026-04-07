import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { DateTime } from "luxon";

// clsx -> Cleans up unused/falsy class values (conditional)
// twMerge -> Efficiently merge remaining without style conflicts
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Generate options from start hours - end hours, in jump intervals
export function generateTimeOptions(start: number, end: number, jump: number) {
  const options: string[] = [];
  // In minutes
  const startTime = start * 60;
  const endTime = end * 60;

  for (let minutes = startTime; minutes <= endTime; minutes += jump) {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;

    const ampm = hour >= 12 ? "pm" : "am";
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    const displayMinute = minute.toString().padStart(2, "0");

    options.push(`${displayHour}:${displayMinute}${ampm}`);
  }

  return options;
}

// Generate options from start minute - end minute, in jump intervals
export function generateDurationOptions(
  minMinutes: number,
  maxMinutes: number,
  jumpMinutes: number
): string[] {
  const options: string[] = [];

  for (let total = minMinutes; total <= maxMinutes; total += jumpMinutes) {
    const hours = Math.floor(total / 60);
    const minutes = total % 60;

    let label = "";
    if (hours > 0) label += `${hours}h `;
    if (minutes > 0) label += `${minutes}m`;
    if (!label) label = "0m"; // safeguard for 0

    options.push(label);
  }

  return options;
}

// Each duration option -> back to minutes
export function parseDurationLabel(label: string): number {
  // Accept forms like "1h 30m", "2h", "45m", "0m"
  const hourMatch = label.match(/(\d+)\s*h/);
  const minMatch = label.match(/(\d+)\s*m/);

  const hours = hourMatch ? parseInt(hourMatch[1], 10) : 0;
  const mins = minMatch ? parseInt(minMatch[1], 10) : 0;

  return hours * 60 + mins;
}

// 09:00 or 22:00 -> 9:00am, 10:00pm
export function formatTimeTo12Hour(input: string): string {
  const [hourStr, minute] = input.split(":");
  let hour = parseInt(hourStr, 10);
  const isPM = hour >= 12;

  if (hour === 0) hour = 12;
  else if (hour > 12) hour -= 12;

  return `${hour}:${minute}${isPM ? "pm" : "am"}`;
}

// Reverse of the above
export function formatTimeTo24Hour(input: string): string {
  const time = input.trim().toLowerCase();
  const match = time.match(/^(\d{1,2}):(\d{2})(am|pm)$/);

  if (!match) throw new Error("Invalid time format");

  const [_, hourStr, minute, period] = match;
  let hour = parseInt(hourStr, 10);

  if (period === "am") {
    if (hour === 12) hour = 0;
  } else if (period === "pm") {
    if (hour !== 12) hour += 12;
  }

  return `${hour.toString().padStart(2, "0")}:${minute}`;
}

// Check if 9:00am is before 9:40pm etc
export function isBefore(timeA: string, timeB: string): boolean {
  const to24 = formatTimeTo24Hour;
  const [h1, m1] = to24(timeA).split(":").map(Number);
  const [h2, m2] = to24(timeB).split(":").map(Number);

  return h1 < h2 || (h1 === h2 && m1 < m2);
}

// Convert YYYY-MM-DD to "Wed, 2 Jul" format
export function formatDateToDayLabel(dateStr: string): string {
  const date = new Date(dateStr);

  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

// Convert YYYY-MM-DD to "Jul 31, 2025" format
export function formatDateToStandardLabel(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Convert YYYY-MM-DD to 1500
export function formatDateToTime(dateString: string): string {
  const date = new Date(dateString);
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}${minutes}`;
}

// Get Today's date in YYYY-MM-DD format
export function getSingaporeDateString() {
  return DateTime.now().setZone("Asia/Singapore").toFormat("yyyy-MM-dd");
}
