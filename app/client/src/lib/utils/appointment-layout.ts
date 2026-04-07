import { DateTime } from "luxon";
import { type AppointmentWithDetails } from "@/lib/types/appointment/appointment";

export interface LayoutInfo {
  columnIndex: number; // 0, 1, 2... which column this appointment is in
  totalColumns: number; // Total columns needed for this overlap group
  widthPercentage: number; // Width as percentage (e.g., 50 for 50%)
  leftOffsetPercentage: number; // Left offset as percentage
}

interface TimeRange {
  start: DateTime;
  end: DateTime;
}

/**
 * Check if two time ranges overlap
 */
function timeRangesOverlap(a: TimeRange, b: TimeRange): boolean {
  return a.start < b.end && b.start < a.end;
}

type ApptRange = { id: number; range: TimeRange };

/**
 * Split appointments into "overlap groups" (connected components).
 * Within a group, each appointment overlaps (directly or indirectly) with others.
 */
function buildOverlapGroups(sorted: ApptRange[]): ApptRange[][] {
  const groups: ApptRange[][] = [];
  let current: ApptRange[] = [];

  // Track the max end of the current group
  let groupMaxEnd: DateTime | null = null;

  for (const item of sorted) {
    if (current.length === 0) {
      current = [item];
      groupMaxEnd = item.range.end;
      continue;
    }

    // If this starts before the current group's max end, it's in the same group
    if (groupMaxEnd && item.range.start < groupMaxEnd) {
      current.push(item);
      if (item.range.end > groupMaxEnd) groupMaxEnd = item.range.end;
    } else { // close group, start a new one
      groups.push(current);
      current = [item];
      groupMaxEnd = item.range.end;
    }
  }

  if (current.length) groups.push(current);
  return groups;
}

/**
 * Assign columns within ONE overlap group
 */
function layoutOneGroup(group: ApptRange[]): Map<number, LayoutInfo> {
  const map = new Map<number, LayoutInfo>();

  const columns: ApptRange[][] = [];

  for (const appt of group) {
    let assigned = -1;

    for (let c = 0; c < columns.length; c++) {
      const col = columns[c];
      const hasOverlap = col.some((existing) => timeRangesOverlap(appt.range, existing.range));
      if (!hasOverlap) {
        assigned = c;
        break;
      }
    }

    if (assigned === -1) {
      assigned = columns.length;
      columns.push([]);
    }

    columns[assigned].push(appt);
  }

  const totalColumns = columns.length;
  const widthPercentage = totalColumns > 1 ? 100 / totalColumns : 100;

  for (let c = 0; c < totalColumns; c++) {
    const leftOffsetPercentage = totalColumns > 1 ? (c * 100) / totalColumns : 0;

    for (const appt of columns[c]) {
      map.set(appt.id, {
        columnIndex: c,
        totalColumns,
        widthPercentage,
        leftOffsetPercentage,
      });
    }
  }

  return map;
}

export function calculateAppointmentLayout(
  appointments: AppointmentWithDetails[]
): Map<number, LayoutInfo> {
  const layoutMap = new Map<number, LayoutInfo>();
  if (appointments.length === 0) return layoutMap;

  const sorted = [...appointments]
    .map((a) => ({
      id: a.id,
      range: {
        start: DateTime.fromISO(a.startTime),
        end: DateTime.fromISO(a.endTime),
      },
    }))
    .sort((a, b) => a.range.start.toMillis() - b.range.start.toMillis());

  // 1) split into overlap groups (clusters)
  const groups = buildOverlapGroups(sorted);

  // 2) layout each group independently
  for (const group of groups) {
    const groupMap = layoutOneGroup(group);
    groupMap.forEach((v, k) => layoutMap.set(k, v));
  }

  return layoutMap;
}
