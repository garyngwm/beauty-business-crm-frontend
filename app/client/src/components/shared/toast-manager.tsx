import { useState, useEffect, useRef } from "react";
import { toast as sonnerToast } from "sonner";
import { cn } from "@/lib/utils/date-processing";
import { X } from "lucide-react";

interface ToastProps {
  id: string | number;
  title: string;
  description: string;
  status: "success" | "failure";
}

const EXIT_ANIMATION_DURATION = 300;
const SHOW_DURATION = 4000;

// The wrapper function around sonner that we expose
export function toastManager(toast: Omit<ToastProps, "id">) {
  return sonnerToast.custom(
    (id) => (
      <Toast
        id={id}
        title={toast.title}
        description={toast.description}
        status={toast.status}
      />
    ),
    // Other configs
    {
      duration: SHOW_DURATION + EXIT_ANIMATION_DURATION,
      dismissible: false,
    }
  );
}

// It creates a custom toast following this template
function Toast(props: ToastProps) {
  const { title, description, id, status } = props;
  const [isExiting, setIsExiting] = useState(false);

  const dismissTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoExitTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-dismiss after SHOW_DURATION
  useEffect(() => {
    autoExitTimeoutRef.current = setTimeout(() => {
      handleDismiss();
    }, SHOW_DURATION);

    return () => {
      if (autoExitTimeoutRef.current) {
        clearTimeout(autoExitTimeoutRef.current);
      }
    };
  }, []);

  const handleDismiss = () => {
    // Clear all timeouts
    if (dismissTimeoutRef.current) {
      clearTimeout(dismissTimeoutRef.current);
    }
    if (autoExitTimeoutRef.current) {
      clearTimeout(autoExitTimeoutRef.current);
    }

    // Flag to run the exit animation
    setIsExiting(true);
    dismissTimeoutRef.current = setTimeout(() => {
      sonnerToast.dismiss(id);
    }, EXIT_ANIMATION_DURATION);
  };

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      if (dismissTimeoutRef.current) {
        clearTimeout(dismissTimeoutRef.current);
      }
      if (autoExitTimeoutRef.current) {
        clearTimeout(autoExitTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      className={cn(
        // Fixed width and height
        // Height is passable for 1 line of body, and good for 2 lines of body
        // For the stacking to look consistent
        "flex p-4 rounded-lg shadow-md ring-[1.5px] ring-slate-500",
        "w-[22rem] min-w-[22rem] max-w-[22rem] shrink-0",
        "h-28",
        status === "success" ? "bg-green-200" : "bg-red-200",

        // Exit and enter animations
        // Defined in index.css
        isExiting ? "toast-exit" : "toast-enter"
      )}
      onPointerDown={(e) => {
        // Prevent the click from being passed to the dialog, closing it
        e.stopPropagation();
      }}
    >
      <div className="flex-1 mr-3">
        <p className="text-lg font-medium text-slate-800">{title}</p>
        <p className="mt-1 text-base text-gray-600">{description}</p>
      </div>
      <div>
        <button
          className={cn(
            "rounded-full p-1 text-base font-semibold text-slate-800 hover:bg-green-400",
            status === "success" ? "hover:bg-green-400" : "hover:bg-red-400"
          )}
          onClick={handleDismiss}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
