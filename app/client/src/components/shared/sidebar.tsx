import {
  Calendar,
  Tag,
  Users,
  BookOpen,
  UserCog,
  BarChart,
  Settings,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/tooltip";
import { TooltipPortal } from "@radix-ui/react-tooltip";

export default function Sidebar() {
  const [location] = useLocation();

  return (
    <div className="flex md:flex-shrink-0 bg-gray-900 text-gray-300 relative z-20">
      <div className="flex flex-col bg-gray-900 border-r border-gray-800">
        <nav className="flex flex-col px-3 py-4 space-y-2 flex-1 justify-center">
          {/* Dashboard */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/"
                className={`flex items-center justify-center px-2 py-2 rounded-lg transition-colors ${location === "/"
                    ? "bg-green-700 text-white"
                    : "hover:bg-green-700 hover:text-white"
                  }`}
              >
                <Calendar className="w-7 h-7" strokeWidth={1.5} />
              </Link>
            </TooltipTrigger>
            <TooltipPortal>
              <TooltipContent
                side="right"
                align="start"
                sideOffset={18}
                className="text-base bg-gray-800 text-gray-200 border border-gray-800"
              >
                Calendar
              </TooltipContent>
            </TooltipPortal>
          </Tooltip>

          {/* Payments */}
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href="/sales"
                className="flex items-center justify-center px-2 py-2 rounded-lg transition-colors hover:bg-green-700 hover:text-white"
              >
                <Tag className="w-7 h-7" strokeWidth={1.5} />
              </a>
            </TooltipTrigger>
            <TooltipPortal>
              <TooltipContent
                side="right"
                align="start"
                sideOffset={18}
                className="text-base bg-gray-800 text-gray-200 border border-gray-800"
              >
                Sales
              </TooltipContent>
            </TooltipPortal>
          </Tooltip>

          {/* Customers */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/customers"
                className={`flex items-center justify-center px-2 py-2 rounded-lg transition-colors ${location === "/customers"
                    ? "bg-green-700 text-white"
                    : "hover:bg-green-700 hover:text-white"
                  }`}
              >
                <Users className="w-7 h-7" strokeWidth={1.5} />
              </Link>
            </TooltipTrigger>
            <TooltipPortal>
              <TooltipContent
                side="right"
                align="start"
                sideOffset={18}
                className="text-base bg-gray-800 text-gray-200 border border-gray-800"
              >
                Clients
              </TooltipContent>
            </TooltipPortal>
          </Tooltip>

          {/* Services */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/services"
                className={`flex items-center justify-center px-2 py-2 rounded-lg transition-colors ${location === "/services"
                    ? "bg-green-700 text-white"
                    : "hover:bg-green-700 hover:text-white"
                  }`}
              >
                <BookOpen className="w-7 h-7" strokeWidth={1.5} />
              </Link>
            </TooltipTrigger>
            <TooltipPortal>
              <TooltipContent
                side="right"
                align="start"
                sideOffset={18}
                className="text-base bg-gray-800 text-gray-200 border border-gray-800"
              >
                Services
              </TooltipContent>
            </TooltipPortal>
          </Tooltip>

          {/* Staff */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/staffs"
                className={`flex items-center justify-center px-2 py-2 rounded-lg transition-colors ${location === "/staffs"
                    ? "bg-green-700 text-white"
                    : "hover:bg-green-700 hover:text-white"
                  }`}
              >
                <UserCog className="w-7 h-7" strokeWidth={1.5} />
              </Link>
            </TooltipTrigger>
            <TooltipPortal>
              <TooltipContent
                side="right"
                align="start"
                sideOffset={18}
                className="text-base bg-gray-800 text-gray-200 border border-gray-800"
              >
                Staff
              </TooltipContent>
            </TooltipPortal>
          </Tooltip>

          {/* Reports */}
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href="#"
                className="flex items-center justify-center px-2 py-2 rounded-lg transition-colors hover:bg-green-700 hover:text-white"
              >
                <BarChart className="w-7 h-7" strokeWidth={1.5} />
              </a>
            </TooltipTrigger>
            <TooltipPortal>
              <TooltipContent
                side="right"
                align="start"
                sideOffset={18}
                className="text-base bg-gray-800 text-gray-200 border border-gray-800"
              >
                Reports
              </TooltipContent>
            </TooltipPortal>
          </Tooltip>

          <div className="w-[90%] h-[2.5px] bg-green-700 mx-auto" />

          {/* Settings */}
          <div>
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href="#"
                  className="flex items-center justify-center px-2 py-2 rounded-lg transition-colors hover:bg-green-700 hover:text-white mt-7 mt-6"
                >
                  <Settings className="w-7 h-7" strokeWidth={1.5} />
                </a>
              </TooltipTrigger>
              <TooltipPortal>
                <TooltipContent
                  side="right"
                  align="start"
                  sideOffset={18}
                  className="text-base bg-gray-800 text-gray-200 border border-gray-800"
                >
                  Settings
                </TooltipContent>
              </TooltipPortal>
            </Tooltip>
          </div>
        </nav>
      </div>
    </div>
  );
}
