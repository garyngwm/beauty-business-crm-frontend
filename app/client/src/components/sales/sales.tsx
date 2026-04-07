// pages/sales.tsx
import { useState } from "react";
import Sidebar from "@/components/shared/sidebar";
import { BadgeDollarSign } from "lucide-react";
import { cn } from "@/lib/utils/date-processing";
import CreditSalesView from "@/components/sales/credit-sales-view";
import AppointmentSalesView from "@/components/sales/appointment-sales-view";
import SalesPerformanceCard from "../reports/salesCard";

type TopTab = "credits" | "appointments";

export default function SalesPage() {
  const [activeTab, setActiveTab] = useState<TopTab>("credits");

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 overflow-auto p-6">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <BadgeDollarSign className="h-6 w-6 text-beauty-purple" />
              Sales
            </h1>
            <p className="text-gray-600 mt-1">
              View, filter and export the history of your sales.
            </p>
          </div>
        </div>
        <SalesPerformanceCard />
        {/* Top-level tabs: credit ledger vs appointment payments */}
        <div className="mb-6 inline-flex rounded-lg border bg-white p-1 text-sm">
          <button
            type="button"
            onClick={() => setActiveTab("credits")}
            className={cn(
              "px-4 py-2 rounded-md",
              activeTab === "credits"
                ? "bg-beauty-purple text-white shadow-sm"
                : "text-gray-700 hover:bg-gray-100"
            )}
          >
            Credit ledger
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("appointments")}
            className={cn(
              "px-4 py-2 rounded-md",
              activeTab === "appointments"
                ? "bg-beauty-purple text-white shadow-sm"
                : "text-gray-700 hover:bg-gray-100"
            )}
          >
            Appointment payments
          </button>
        </div>

        {/* Content switches here */}
        {activeTab === "credits" ? <CreditSalesView /> : <AppointmentSalesView />}
      </div>
    </div>
  );
}
