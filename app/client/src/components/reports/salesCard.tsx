import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import SalesPerformanceChart from "./salesChart";
import { fetchAppointmentSalesPerformance } from "@/lib/types/appointment/appointment";

function yyyyMmDd(d: Date) {
  return d.toISOString().slice(0, 10);
}

type RangeKey = "7d" | "month" | "ytd";

export default function SalesPerformanceCard() {
  const [range, setRange] = useState<RangeKey>("month");

  const { from, to, groupBy } = useMemo(() => {
    const now = new Date();
    const end = yyyyMmDd(now);

    // last 7 days (including today)
    if (range === "7d") {
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      return { from: yyyyMmDd(start), to: end, groupBy: "day" as const };
    }

    // this month (month-to-date)
    if (range === "month") {
      const start = new Date(now);
      start.setDate(1);
      return { from: yyyyMmDd(start), to: end, groupBy: "day" as const };
    }

    // year-to-date (month-by-month)
    const start = new Date(now);
    start.setMonth(0); // Jan
    start.setDate(1);
    return { from: yyyyMmDd(start), to: end, groupBy: "month" as const };
  }, [range]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["apptSalesPerformance", range, from, to, groupBy],
    queryFn: () =>
      fetchAppointmentSalesPerformance({
        from,
        to,
        groupBy,
        dateField: "start_time",
      }),
  });

  const totalRevenue = data?.totalRevenue ?? 0;
  const totalCount = data?.totalCount ?? 0;

  const isEmpty =
    !isLoading &&
    !error &&
    (totalCount === 0 || (data?.points?.length ?? 0) === 0);

  return (
    <div className="mb-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold text-gray-900">Performance</div>
          <div className="text-sm text-gray-600">
            Paid Cash/Card appointments
          </div>
        </div>

        {/* Range toggle */}
        <div className="inline-flex rounded-lg border bg-white p-1 text-sm">
          {(["7d", "month", "ytd"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setRange(k)}
              className={`rounded-md px-3 py-1.5 ${range === k
                ? "bg-beauty-purple text-white shadow-sm"
                : "text-gray-700 hover:bg-gray-100"
                }`}
              type="button"
            >
              {k === "7d" ? "7D" : k === "month" ? "THIS MONTH" : "YTD"}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4">
        <Kpi
          label="Total revenue"
          value={isLoading ? "…" : formatMoney(totalRevenue)}
        />
        <Kpi
          label="Transactions"
          value={isLoading ? "…" : String(totalCount)}
        />
        <Kpi
          label="Avg / txn"
          value={
            isLoading
              ? "…"
              : formatMoney(totalCount ? totalRevenue / totalCount : 0)
          }
        />
      </div>

      {error ? (
        <div className="rounded-lg border bg-white p-4 text-sm text-red-600">
          Failed to load performance chart.
        </div>
      ) : isEmpty ? (
        <EmptyState range={range} />
      ) : (
        <SalesPerformanceChart data={data?.points ?? []} />
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-gray-900">{value}</div>
    </div>
  );
}

function EmptyState({ range }: { range: RangeKey }) {
  const label =
    range === "7d"
      ? "the last 7 days"
      : range === "month"
        ? "this month"
        : "year-to-date";

  return (
    <div className="h-72 w-full rounded-lg border bg-white p-6 flex items-center justify-center">
      <div className="max-w-md text-center">
        <div className="text-base font-semibold text-gray-900">
          No paid transactions
        </div>
        <div className="mt-1 text-sm text-gray-600">
          No paid Cash/Card appointments were found for {label}.
        </div>
        <div className="mt-3 text-sm text-gray-600">
          Try switching to a different time range, or check if appointments are
          still marked as <span className="font-medium">Pending</span>.
        </div>
      </div>
    </div>
  );
}

function formatMoney(amount: number) {
  if (!Number.isFinite(amount)) return "$0";
  const rounded = Math.round(amount * 100) / 100;
  return `$${rounded.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}
