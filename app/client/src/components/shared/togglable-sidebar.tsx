import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/date-processing";
import React, { useState, useRef, useLayoutEffect } from "react";

interface CollapsibleSidebarProps {
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  sidebarItems: { name: string; href: string }[];
}

// In rems
const MAIN_SIDEBAR_WIDTH = 4.25; // I think I manually measured this lmao
const CLOSED_WIDTH = 1.75;
const BUTTON_CLOSED_DISPLACEMENT = MAIN_SIDEBAR_WIDTH + CLOSED_WIDTH / 2;

// Standard conversion
const REM_TO_PX = 16;

export default function CollapsibleSidebar({
  isOpen,
  setIsOpen,
  sidebarItems,
}: CollapsibleSidebarProps) {
  const [activeSection, setActiveSection] = useState(sidebarItems[0].name);

  // Measure the full/expanded width of sidebar
  const [sidebarWidth, setSidebarWidth] = useState(0);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Synchronously before this component is painted
  // Get the expanded width in rem
  useLayoutEffect(() => {
    if (!sidebarRef.current) return;

    const widthPx = sidebarRef.current.getBoundingClientRect().width;
    setSidebarWidth(widthPx / REM_TO_PX);
  }, [sidebarItems]);

  return (
    <>
      {/* 
        [Offscreen measuring container trick]

        Problem 
         - We need the stupid sidebar and the button to animate at the same time 
         - However, we need the sidebar's final width for the button to animate 

         - So, we simulate the sidebar's final width via a hidden div 
         - We syncronously get that info via useLayoutEffect before rendering 
        
         - Now, at render time 
         - We have enough info to animate together, accurately!!
      */}
      {/* Simulated expanded sidebar */}
      <div
        ref={sidebarRef}
        style={{
          position: "absolute",
          top: 0,
          left: "-9999px",
          visibility: "hidden",
        }}
      >
        <div className="h-full flex items-center justify-center px-2.5">
          <div className="space-y-1.5">
            {sidebarItems.map((item) => (
              <span
                key={item.name}
                className="block px-4 py-2 text-base whitespace-nowrap"
              >
                {item.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-[50%] z-10 bg-slate-500 rounded-r-md p-1.5 transition-all ease-in-out duration-300"
        style={{
          left: `${isOpen ? MAIN_SIDEBAR_WIDTH + sidebarWidth : BUTTON_CLOSED_DISPLACEMENT}rem`,
        }}
      >
        {isOpen ? (
          <ChevronLeft className="w-4 h-4 text-white" strokeWidth={2.5} />
        ) : (
          <ChevronRight className="w-4 h-4 text-white" strokeWidth={2.5} />
        )}
      </button>

      {/* 
        [GRID TRICK to animate auto width]
         
        So by default, width auto is not animatable xd 
        However, we can make the sidebar display: grid 

        Then, set a width transition between 0fr and 1fr
        Also, set a minWidth of what is desired 

        Compiler seems to be smart enough to 
          - Know that at 0fr state, still respect the minWidth 
          - Know that at 1fr state, its width auto equivalent 
        
        Thus, we have successfully
          - Transitioned from fixed to variable/auto width
          - AND also preserving smooth animations 
      */}
      <div
        className="bg-gray-700 border-r border-gray-300 overflow-hidden"
        style={{
          display: "grid",
          gridTemplateColumns: isOpen ? "1fr" : "0fr",
          transition: "grid-template-columns 300ms ease-in-out",
          width: "auto",
          minWidth: `${CLOSED_WIDTH}rem`,
        }}
      >
        <div className="min-w-0">
          <div className={cn("h-full flex items-center justify-center px-2.5")}>
            <div className="space-y-1.5">
              {sidebarItems.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  onClick={() => setActiveSection(item.name)}
                  className={cn(
                    "block px-4 py-2 text-base text-white hover:bg-green-600 rounded-lg whitespace-nowrap",
                    activeSection === item.name ? "bg-green-600" : undefined,
                    // This visually disables the sidebar items
                    // In the non-open state!!
                    !isOpen
                      ? "text-gray-700 bg-transparent pointer-events-none select-none"
                      : "text-white",
                    "transition-colors duration-300"
                  )}
                >
                  {item.name}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
