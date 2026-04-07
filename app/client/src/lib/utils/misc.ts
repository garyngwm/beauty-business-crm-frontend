export const getOutletFullName = (outletId: number) => {
  return outletId === 1 ? "Outlet 2" : "Outlet 1";
};

export const getOutletShortName = (outletId: number) => {
  return outletId === 1 ? "Outlet 2" : "Outlet 1";
};

const INVALID_TARGET_START = 9999;

// These are all start and end TIMES
export const displayGrayRectangle = (
  slotStart: number,
  slotEnd: number,
  targetStart: number,
  targetEnd: number
) => {
  // Height1 -> height of the gray rect, due to target start
  // Height2 -> height of the gray rect, due to target end
  let height1: number = 0;
  let height2: number = 0;

  // Edge case
  if (targetStart === INVALID_TARGET_START) {
    height1 = 0;
    // First, look at target start
  } else if (slotStart <= targetStart) {
    if (slotEnd <= targetStart) {
      // Entire slot is before target start
      height1 = 60;
    } else {
      // Partial height - calculate minutes until target starts
      const startHour = Math.floor(targetStart / 100);
      const startMinute = targetStart % 100;
      const slotHour = Math.floor(slotStart / 100);
      const slotMinute = slotStart % 100;

      height1 = (startHour - slotHour) * 60 + (startMinute - slotMinute);
      height1 = Math.min(height1, 60); // Cap at 60 minutes

      // Need to look at target end
      if (targetEnd <= slotEnd) {
        const slotEndHour = Math.floor(slotEnd / 100);
        const slotEndMinute = slotEnd % 100;

        const shiftEndHour = Math.floor(targetEnd / 100);
        const shiftEndMinute = targetEnd % 100;

        height2 =
          (slotEndHour - shiftEndHour) * 60 + (slotEndMinute - shiftEndMinute);
      }
    }
  } else {
    // Then, look at target end
    if (slotStart < targetEnd) {
      const slotEndHour = Math.floor(slotEnd / 100);
      const slotEndMinute = slotEnd % 100;

      const shiftEndHour = Math.floor(targetEnd / 100);
      const shiftEndMinute = targetEnd % 100;

      height2 =
        (slotEndHour - shiftEndHour) * 60 + (slotEndMinute - shiftEndMinute);
    } else {
      height1 = 60;
    }
  }

  return { height1, height2 };
};

// Parse the backend error detail
// Into something more readable
export const getErrorDescription = (errorMessage: string) => {
  // Matches the content in "detail": "..."
  const match = errorMessage.match(/detail['"]:\s*['"](.+?)['"]/);
  return match ? match[1] : errorMessage;
};
