import { useState, useRef, useCallback, useEffect } from "react";

export const useControlledTooltip = (delayMs = 350) => {
  const [activeTooltipId, setActiveTooltipId] = useState<string | null>(null);
  const [pendingShowId, setPendingShowId] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Effect to synchronize
  // So show 2 comes AFTER hide 1
  useEffect(() => {
    if (pendingShowId && activeTooltipId === null) {
      // Now we know the hide has completed (activeTooltipId is null)
      // So we can safely show the new tooltip
      timeoutRef.current = setTimeout(() => {
        setActiveTooltipId(pendingShowId);
        setPendingShowId(null);
      }, delayMs);
    }
  }, [activeTooltipId, pendingShowId, delayMs]);

  const showTooltip = useCallback(
    (id: string) => {
      // Clear any pending timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      if (activeTooltipId !== null) {
        // Go to the above effect and wait
        setPendingShowId(id);
      } else {
        // No active tooltip, show directly
        setPendingShowId(null);
        timeoutRef.current = setTimeout(() => {
          setActiveTooltipId(id);
        }, delayMs);
      }
    },
    [activeTooltipId, delayMs]
  );

  const hideTooltip = useCallback(() => {
    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setActiveTooltipId(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    activeTooltipId,
    showTooltip,
    hideTooltip,
  };
};
