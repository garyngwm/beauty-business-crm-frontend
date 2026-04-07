import { cn } from "@/lib/utils/date-processing";
import { diagonalStripesStyles } from "@/lib/utils/style-processing";

interface GrayRectProps {
  height1: number; // In "minutes"
  height1Actual: number; // In "actual" rems
  height2: number;
  height2Actual: number;
  onClick: () => void;
}

// Gray rectangle with stripes
// Representative of out of shift hours

// Height1 -> Gray rectange 1, due to shift start hour
// Height2 -> Gray rectangle 2, due to shift end hour
export default function GrayRect({
  height1,
  height1Actual,
  height2,
  height2Actual,
  onClick,
}: GrayRectProps) {
  return (
    <div>
      {height1 > 0 && (
        <div
          className={cn(
            "bg-gray-150 w-full text-base cursor-pointer absolute top-0 non-shift",
            height1Actual === 7.5 ? "border-b border-gray-400/50" : undefined
          )}
          style={{
            height: `${height1Actual}rem`,
            backgroundImage: diagonalStripesStyles,
          }}
          onClick={onClick}
        />
      )}

      {height2 > 0 && (
        <div
          className="bg-gray-150 w-full text-base cursor-pointer border-b border-gray-400/50 absolute bottom-0 non-shift"
          style={{
            height: `${height2Actual}rem`,
            backgroundImage: `repeating-linear-gradient(
                45deg,
                rgba(0,0,0,0.1) 0px,
                rgba(0,0,0,0.1) 2px,
                transparent 2px,
                transparent 20px
            )`,
          }}
          onClick={onClick}
        />
      )}
    </div>
  );
}
