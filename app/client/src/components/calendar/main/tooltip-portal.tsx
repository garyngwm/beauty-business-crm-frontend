import { useEffect, useState, useRef, ReactNode } from "react";
import { createPortal } from "react-dom";

interface TooltipPortalProps {
  children: ReactNode;
  side: "left" | "right";
  targetElement: HTMLElement | null;
}

const SIDE_OFFSET = 15;

const TooltipPortal = ({
  children,
  side,
  targetElement,
}: TooltipPortalProps) => {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (targetElement && tooltipRef.current) {
      const updatePosition = () => {
        const rect = targetElement.getBoundingClientRect();
        const tooltipRect = tooltipRef.current?.getBoundingClientRect();

        // Setting the x (left) and y (top) translations
        setPosition({
          top: rect.top,
          left:
            side === "right"
              ? rect.right + SIDE_OFFSET
              : rect.left - (tooltipRect?.width || 0) - SIDE_OFFSET,
        });
      };

      // Initial call
      updatePosition();

      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);

      return () => {
        window.removeEventListener("scroll", updatePosition, true);
        window.removeEventListener("resize", updatePosition);
      };
    }
  }, [targetElement, side]);

  return createPortal(
    <div
      ref={tooltipRef}
      className="fixed pointer-events-none"
      style={{
        // Position at viewport origin (top-left)
        // Then, translate by the required pixel amounts along x and y
        top: 0,
        left: 0,
        transform: `translate(${position.left}px, ${position.top}px)`,
      }}
    >
      {children}
    </div>,
    document.body
  );
};

export default TooltipPortal;
