import { useEffect, useState, useRef } from "react";
import { MIN_LOADING } from "@/lib/constants";

export function useMinimumLoadingTime(
  isLoading: boolean,
  minTime: number = MIN_LOADING
) {
  const [showLoading, setShowLoading] = useState(false);
  const loadingStartTime = useRef<number | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear any existing timeout when dependencies change
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (isLoading) {
      if (!showLoading) {
        // Just started loading
        setShowLoading(true);
        loadingStartTime.current = Date.now();
      }
    } else {
      if (!isLoading && showLoading && loadingStartTime.current) {
        // Loading finished, calculate remaining time
        const elapsedTime = Date.now() - loadingStartTime.current;
        const remainingTime = Math.max(0, minTime - elapsedTime);

        if (remainingTime === 0) {
          // Already shown for minimum time
          setShowLoading(false);
          loadingStartTime.current = null;
        } else {
          // Wait for remaining time
          timeoutRef.current = setTimeout(() => {
            setShowLoading(false);
            loadingStartTime.current = null;
            timeoutRef.current = null;
          }, remainingTime);
        }
      }
    }

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [isLoading, showLoading, minTime]);

  return showLoading;
}
