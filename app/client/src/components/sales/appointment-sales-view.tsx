// components/sales/appointment-sales-view.tsx
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import LoadingSpinner from "@/components/shared/loading-spinner";
import { useMinimumLoadingTime } from "@/hooks/use-min-loading";
import { apiRequest } from "@/lib/query-client";
import {
  appointmentSaleSchema,
  type AppointmentSaleResponse,
} from "@/lib/types/sales/sales";
import { z } from "zod";
import { cn, formatDateToStandardLabel } from "@/lib/utils/date-processing";

const currency = new Intl.NumberFormat("en-SG", {
  style: "currency",
  currency: "SGD",
});

const formatTime12h = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-SG", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

const formatDateInput = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

type PaySection = "all" | "pending" | "paid";
type PaySortKey = "apptId" | "client" | "status" | "date" | "location" | "amount" | "gst";
type PaySortDir = "asc" | "desc";

export default function AppointmentSalesView() {
  const [section, setSection] = useState<PaySection>("all");
  const [sortKey, setSortKey] = useState<PaySortKey>("date");
  const [sortDir, setSortDir] = useState<PaySortDir>("desc");
  const [page, setPage] = useState(1);
  const rowsPerPage = 25;

  const today = new Date();
  const [dateFrom, setDateFrom] = useState<string>(formatDateInput(today));
  const [dateTo, setDateTo] = useState<string>(formatDateInput(today));

  const [locationFilter, setLocationFilter] = useState<string>("all");

  const {
    data: raw,
    isLoading,
    isError,
    error,
  } = useQuery<AppointmentSaleResponse[]>({
    queryKey: ["/api/appointments/sales"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/appointments/sales");
      const parsed = z.array(appointmentSaleSchema).safeParse(res);
      if (!parsed.success) {
        console.error("Appointment sales validation failed", parsed.error);
        throw new Error("Invalid appointment sales data");
      }
      return parsed.data;
    },
  });

  const data = raw ?? [];
  const showSpinner = useMinimumLoadingTime(isLoading);

  const dateFiltered = useMemo(() => {
    if (!data.length) return [];

    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const to = dateTo ? new Date(`${dateTo}T23:59:59.999`) : null;

    return data.filter((row) => {
      const dt = new Date(row.startTime);
      if (from && dt < from) return false;
      if (to && dt > to) return false;
      return true;
    });
  }, [data, dateFrom, dateTo]);

  const outletOptions = useMemo(
    () => {
      const map = new Map<number, string>();
      dateFiltered.forEach((row) => {
        if (row.outletId) {
          const label = row.outletName || `Outlet #${row.outletId}`;
          map.set(row.outletId, label);
        }
      });
      return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
    },
    [dateFiltered]
  );

  const baseFiltered = useMemo(
    () => {
      if (locationFilter === "all") return dateFiltered;
      return dateFiltered.filter(
        (row) => String(row.outletId ?? "") === locationFilter
      );
    },
    [dateFiltered, locationFilter]
  );

  const filtered = useMemo(() => {
    if (section === "pending") {
      return baseFiltered.filter((row) => row.paymentStatus === "Pending");
    }
    if (section === "paid") {
      return baseFiltered.filter((row) => row.paymentStatus === "Paid");
    }
    return baseFiltered;
  }, [baseFiltered, section]);


  const handleSort = (key: PaySortKey) => {
    setSortKey((prevKey) => {
      if (prevKey !== key) {
        setSortDir("asc");
        return key;
      }
      setSortDir((prevDir) => (prevDir === "asc" ? "desc" : "asc"));
      return key;
    });
  };

  const sortedRows = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "apptId":
          cmp = a.id - b.id;
          break;
        case "client":
          cmp = (a.customerName ?? "").localeCompare(b.customerName ?? "");
          break;
        case "status":
          cmp = a.paymentStatus.localeCompare(b.paymentStatus);
          break;
        case "location":
          cmp = (a.outletName || "").localeCompare(b.outletName || "");
          break;
        case "amount": {
          const aAmt = a.cashPaid;
          const bAmt = b.cashPaid;
          cmp = aAmt - bAmt;
          break;
        }
        case "gst": {
          cmp = (a.gstPercent ?? 0) - (b.gstPercent ?? 0);
          break;
        }
        case "date":
        default:
          cmp =
            new Date(a.startTime).getTime() -
            new Date(b.startTime).getTime();
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return sortedRows.slice(start, start + rowsPerPage);
  }, [sortedRows, page]);

  const sortIcon = (key: PaySortKey) => {
    if (sortKey !== key) return "↕";
    return sortDir === "asc" ? "↑" : "↓";
  };

  const totals = useMemo(() => {
    const paidRows = filtered.filter((r) => r.paymentStatus === "Paid");

    const gross = paidRows.reduce((sum, r) => sum + (r.cashPaid ?? 0), 0);

    const gst = paidRows.reduce((sum, r) => {
      const paid = r.cashPaid ?? 0;
      const rate = (r.gstPercent ?? 0) / 100;
      return sum + paid * rate;
    }, 0);

    const stripeFees = paidRows.reduce((sum, r) => {
      if (r.paymentMethod !== "Card") return sum;
      return sum + (r.stripeFee ?? 0);
    }, 0);

    const revenue = gross - gst - stripeFees;

    return { gross, gst, stripeFees, revenue };
  }, [filtered]);

  if (showSpinner) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-4 text-sm text-red-500">
        Failed to load appointment sales: {error?.message}
      </div>
    );
  }

  return (
    <div className="flex gap-6">
      <div className="w-60">
        <div className="bg-white rounded-lg border shadow-sm p-2 space-y-1">
          <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase">
            Appointment payments
          </div>

          <button
            type="button"
            onClick={() => {
              setSection("all");
              setPage(1);
            }}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm",
              section === "all"
                ? "bg-beauty-purple-light text-beauty-purple font-semibold"
                : "text-gray-700 hover:bg-gray-100"
            )}
          >
            <span>All</span>
            <span className="text-xs text-gray-400">
              {baseFiltered.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSection("pending");
              setPage(1);
            }}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm",
              section === "pending"
                ? "bg-beauty-purple-light text-beauty-purple font-semibold"
                : "text-gray-700 hover:bg-gray-100"
            )}
          >
            <span>Pending</span>
            <span className="text-xs text-gray-400">
              {baseFiltered.filter((r) => r.paymentStatus === "Pending").length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSection("paid");
              setPage(1);
            }}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm",
              section === "paid"
                ? "bg-beauty-purple-light text-beauty-purple font-semibold"
                : "text-gray-700 hover:bg-gray-100"
            )}
          >
            <span>Paid</span>
            <span className="text-xs text-gray-400">
              {baseFiltered.filter((r) => r.paymentStatus === "Paid").length}
            </span>
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-4">
        <div className="bg-white border rounded-lg shadow-sm p-4 flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              From
            </label>
            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="border rounded px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              To
            </label>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="border rounded px-2 py-1 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              const todayStr = formatDateInput(new Date());
              setDateFrom(todayStr);
              setDateTo(todayStr);
              setPage(1);
            }}
            className="mr-auto px-3 py-1.5 border rounded text-xs font-medium hover:bg-gray-50"
          >
            Today
          </button>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              Location
            </label>
            <select
              value={locationFilter}
              onChange={(e) => {
                setLocationFilter(e.target.value);
                setPage(1);
              }}
              className="border rounded px-2 py-1 text-sm min-w-[140px]"
            >
              <option value="all">All locations</option>
              {outletOptions.map((o) => (
                <option key={o.id} value={String(o.id)}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border rounded-lg shadow-sm p-4 flex items-center">
            <div>
              <div className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
                Revenue (ex GST)
              </div>
              <div className="mt-1 text-2xl font-semibold text-green-700">
                {currency.format(totals.revenue)}
              </div>
            </div>
            <div className="ml-auto text-xs text-gray-500 text-right">
              {sortedRows.length}{" "}
              {sortedRows.length === 1 ? "appointment" : "appointments"}
            </div>
          </div>
          <div className="bg-white border rounded-lg shadow-sm p-2 flex items-center">
            <div>
              <div className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
                GST collected
              </div>
              <div className="mt-0.5 text-2xl font-semibold">
                {currency.format(totals.gst)}
              </div>
            </div>
          </div>
          <div className="bg-white border rounded-lg shadow-sm p-2 flex items-center">
            <div>
              <div className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
                Stripe fees
              </div>
              <div className="mt-0.5 text-2xl font-semibold">
                {currency.format(totals.stripeFees)}
              </div>
            </div>
          </div>
          <div className="bg-white border rounded-lg shadow-sm p-4">
            <div className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
              Gross sales (incl GST and Stripe Fees)
            </div>
            <div className="mt-1 text-2xl font-semibold text-green-700">
              {currency.format(totals.gross)}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border shadow-sm">
          <div className="overflow-x-auto">
            <div className="flex justify-between items-center px-4 py-3 text-sm text-gray-600">
              <div>
                Page {page} of {Math.max(1, Math.ceil(sortedRows.length / rowsPerPage))}
              </div>

              <div className="space-x-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1 border rounded disabled:opacity-40"
                >
                  Previous
                </button>

                <button
                  disabled={page >= Math.ceil(sortedRows.length / rowsPerPage)}
                  onClick={() =>
                    setPage((p) =>
                      Math.min(
                        p + 1,
                        Math.ceil(sortedRows.length / rowsPerPage)
                      )
                    )
                  }
                  className="px-3 py-1 border rounded disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>

            <table className="min-w-full text-sm">
              <thead className="border-b bg-gray-100 text-xs uppercase text-gray-500">
                <tr>
                  <th
                    className="px-4 py-3 text-left cursor-pointer select-none"
                    onClick={() => handleSort("apptId")}
                  >
                    <span className="inline-flex items-center gap-1">
                      Appointment #
                      <span className="text-[10px]">
                        {sortIcon("apptId")}
                      </span>
                    </span>
                  </th>
                  <th
                    className="px-4 py-3 text-left cursor-pointer select-none"
                    onClick={() => handleSort("client")}
                  >
                    <span className="inline-flex items-center gap-1">
                      Client
                      <span className="text-[10px]">
                        {sortIcon("client")}
                      </span>
                    </span>
                  </th>
                  <th
                    className="px-4 py-3 text-left cursor-pointer select-none"
                    onClick={() => handleSort("status")}
                  >
                    <span className="inline-flex items-center gap-1">
                      Status
                      <span className="text-[10px]">
                        {sortIcon("status")}
                      </span>
                    </span>
                  </th>
                  <th
                    className="px-4 py-3 text-left cursor-pointer select-none"
                    onClick={() => handleSort("date")}
                  >
                    <span className="inline-flex items-center gap-1">
                      Date
                      <span className="text-[10px]">
                        {sortIcon("date")}
                      </span>
                    </span>
                  </th>
                  <th
                    className="px-4 py-3 text-left cursor-pointer select-none"
                    onClick={() => handleSort("location")}
                  >
                    <span className="inline-flex items-center gap-1">
                      Location
                      <span className="text-[10px]">
                        {sortIcon("location")}
                      </span>
                    </span>
                  </th>
                  <th className="px-4 py-3 text-left">Method</th>
                  <th
                    className="px-4 py-3 text-right cursor-pointer select-none"
                    onClick={() => handleSort("amount")}
                  >
                    <span className="inline-flex items-center gap-1 justify-end w-full">
                      Cash paid
                      <span className="text-[10px]">
                        {sortIcon("amount")}
                      </span>
                    </span>
                  </th>
                  <th className="px-4 py-3 text-right">
                    Stripe fee
                  </th>
                  <th
                    className="px-4 py-3 text-right cursor-pointer select-none"
                    onClick={() => handleSort("gst")}
                  >
                    <span className="inline-flex items-center gap-1 justify-end w-full">
                      GST %
                      <span className="text-[10px]">{sortIcon("gst")}</span>
                    </span>
                  </th>
                  <th className="px-4 py-3 text-right">
                    Credits used
                  </th>
                </tr>
              </thead>

              <tbody>
                {sortedRows.length ? (
                  paginatedRows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b last:border-b-0 hover:bg-gray-50"
                    >
                      <td className="px-4 py-3 text-beauty-purple font-medium">
                        {row.id}
                      </td>
                      <td className="px-4 py-3">
                        {row.customerName || `Customer #${row.customerId}`}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                            row.paymentStatus === "Paid"
                              ? "bg-green-100 text-green-800"
                              : row.paymentStatus === "Pending"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-gray-100 text-gray-700"
                          )}
                        >
                          {row.paymentStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {formatDateToStandardLabel(row.startTime)},{" "}
                        {formatTime12h(row.startTime)}
                      </td>
                      <td className="px-4 py-3">
                        {row.outletName ||
                          (row.outletId ? `Outlet #${row.outletId}` : "-")}
                      </td>
                      <td className="px-4 py-3">{row.paymentMethod}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {currency.format(row.cashPaid ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {row.paymentMethod === "Card" ? currency.format(row.stripeFee ?? 0) : "-"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {(row.gstPercent ?? 0).toFixed(2)}%
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {row.creditsPaid ?? 0}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-4 py-6 text-center text-gray-500"
                    >
                      No appointment payments found for the selected date range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}