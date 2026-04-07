import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import LoadingSpinner from "@/components/shared/loading-spinner";
import { useMinimumLoadingTime } from "@/hooks/use-min-loading";
import { formatDateToStandardLabel, cn } from "@/lib/utils/date-processing";
import { apiRequest } from "@/lib/query-client";
import { SalesRecordResponse, salesRecordSchema } from "@/lib/types/sales/sales";
import { z } from "zod";

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

type SalesSection = "all" | "usage" | "refund" | "membership" | "stripe_recurring";
type SortKey = "saleId" | "client" | "date" | "location" | "amount";
type SortDir = "asc" | "desc";

export default function CreditSalesView() {
  const [activeSection, setActiveSection] = useState<SalesSection>("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const rowsPerPage = 25;

  const today = new Date();
  const [dateFrom, setDateFrom] = useState<string>(formatDateInput(today));
  const [dateTo, setDateTo] = useState<string>(formatDateInput(today));

  const [locationFilter, setLocationFilter] = useState<string>("all");

  const { data: salesRaw, isLoading, isError, error } = useQuery<SalesRecordResponse[]>({
    queryKey: ["/api/sales-records"],
    queryFn: async () => {
      const raw = await apiRequest("GET", "/api/sales-records");
      const parsed = z.array(salesRecordSchema).safeParse(raw);
      if (!parsed.success) {
        console.error("Sales validation failed", parsed.error);
        throw new Error("Invalid sales records");
      }
      return parsed.data;
    },
  });

  const sales = salesRaw ?? [];
  const showSpinner = useMinimumLoadingTime(isLoading);

  const dateFiltered = useMemo(() => {
    if (!sales.length) return [];

    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const to = dateTo ? new Date(`${dateTo}T23:59:59.999`) : null;

    return sales.filter((row) => {
      const dt = new Date(row.createdAt);
      if (from && dt < from) return false;
      if (to && dt > to) return false;
      return true;
    });
  }, [sales, dateFrom, dateTo]);

  const outletOptions = useMemo(() => {
    const map = new Map<number, string>();
    dateFiltered.forEach((row) => {
      if (row.outletId) {
        const label = row.outletName || `Outlet #${row.outletId}`;
        map.set(row.outletId, label);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [dateFiltered]);

  const baseFiltered = useMemo(() => {
    if (locationFilter === "all") return dateFiltered;
    return dateFiltered.filter((row) => String(row.outletId ?? "") === locationFilter);
  }, [dateFiltered, locationFilter]);

  const usageSales = useMemo(() => baseFiltered.filter((s) => s.type === "usage"), [baseFiltered]);
  const refundSales = useMemo(() => baseFiltered.filter((s) => s.type === "refund"), [baseFiltered]);
  const membershipSales = useMemo(() => baseFiltered.filter((s) => s.type === "purchase"), [baseFiltered]);
  const stripeRecurringSales = useMemo(
    () => baseFiltered.filter((s) => s.type === "stripe_recurring"),
    [baseFiltered]
  );

  const sectionData = useMemo(() => {
    switch (activeSection) {
      case "usage":
        return usageSales;
      case "refund":
        return refundSales;
      case "membership":
        return membershipSales;
      case "stripe_recurring":
        return stripeRecurringSales;
      case "all":
      default:
        return baseFiltered;
    }
  }, [activeSection, baseFiltered, usageSales, refundSales, membershipSales, stripeRecurringSales]);

  const handleSort = (key: SortKey) => {
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
    const arr = [...sectionData];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "saleId":
          cmp = a.id - b.id;
          break;
        case "client":
          cmp = (a.customerName ?? "").localeCompare(b.customerName ?? "");
          break;
        case "location":
          cmp = (a.outletName || "").localeCompare(b.outletName || "");
          break;
        case "amount":
          cmp = a.amount - b.amount;
          break;
        case "date":
        default:
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [sectionData, sortKey, sortDir]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return sortedRows.slice(start, start + rowsPerPage);
  }, [sortedRows, page, rowsPerPage]);

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return "↕";
    return sortDir === "asc" ? "↑" : "↓";
  };

  const totals = useMemo(() => {
    const moneyRows =
      activeSection === "all"
        ? baseFiltered.filter((r) => r.type !== "usage" && r.type !== "refund")
        : sectionData.filter((r) => r.type !== "usage" && r.type !== "refund");

    const gross = moneyRows.reduce((sum, r) => sum + (r.amount ?? 0), 0);
    const gst = moneyRows.reduce((sum, r) => sum + (r.gstFee ?? 0), 0);
    const stripeFees = moneyRows.reduce((sum, r) => sum + (r.stripeFee ?? 0), 0);

    const revenue = gross - gst - stripeFees;

    return { gross, gst, stripeFees, revenue, moneyCount: moneyRows.length };
  }, [activeSection, baseFiltered, sectionData]);

  const total = (() => {
    if (activeSection === "all") {
      return baseFiltered
        .filter((row) => row.type !== "usage" && row.type !== "refund")
        .reduce((sum, row) => sum + row.amount, 0);
    }

    if (activeSection === "usage") return usageSales.reduce((sum, row) => sum + row.amount, 0);
    if (activeSection === "refund") return refundSales.reduce((sum, row) => sum + row.amount, 0);
    if (activeSection === "membership") return membershipSales.reduce((sum, row) => sum + row.amount, 0);
    if (activeSection === "stripe_recurring")
      return stripeRecurringSales.reduce((sum, row) => sum + row.amount, 0);

    return 0;
  })();

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
        Failed to load sales records: {error?.message}
      </div>
    );
  }

  return (
    <div className="flex gap-6">
      <div className="w-60">
        <div className="bg-white rounded-lg border shadow-sm p-2 space-y-1">
          <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase">
            Credit ledger views
          </div>

          <button
            type="button"
            onClick={() => {
              setActiveSection("all");
              setPage(1);
            }}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm",
              activeSection === "all"
                ? "bg-beauty-purple-light text-beauty-purple font-semibold"
                : "text-gray-700 hover:bg-gray-100"
            )}
          >
            <span>All sales</span>
            <span className="text-xs text-gray-400">{baseFiltered.length}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSection("usage");
              setPage(1);
            }}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm",
              activeSection === "usage"
                ? "bg-beauty-purple-light text-beauty-purple font-semibold"
                : "text-gray-700 hover:bg-gray-100"
            )}
          >
            <span>Credit usage</span>
            <span className="text-xs text-gray-400">{usageSales.length}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSection("refund");
              setPage(1);
            }}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm",
              activeSection === "refund"
                ? "bg-beauty-purple-light text-beauty-purple font-semibold"
                : "text-gray-700 hover:bg-gray-100"
            )}
          >
            <span>Refunds</span>
            <span className="text-xs text-gray-400">{refundSales.length}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSection("membership");
              setPage(1);
            }}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm",
              activeSection === "membership"
                ? "bg-beauty-purple-light text-beauty-purple font-semibold"
                : "text-gray-700 hover:bg-gray-100"
            )}
          >
            <span>Memberships sold</span>
            <span className="text-xs text-gray-400">{membershipSales.length}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSection("stripe_recurring");
              setPage(1);
            }}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm",
              activeSection === "stripe_recurring"
                ? "bg-beauty-purple-light text-beauty-purple font-semibold"
                : "text-gray-700 hover:bg-gray-100"
            )}
          >
            <span>Stripe renewals</span>
            <span className="text-xs text-gray-400">{stripeRecurringSales.length}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-4">
        <div className="bg-white border rounded-lg shadow-sm p-4 flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">From</label>
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
            <label className="block text-xs font-semibold text-gray-500 mb-1">To</label>
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
            <label className="block text-xs font-semibold text-gray-500 mb-1">Location</label>
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

        {activeSection === "usage" || activeSection === "refund" ? (
          <div className="bg-white border rounded-lg shadow-sm p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
                {activeSection === "usage"
                  ? "Total credits used"
                  : "Total credits refunded"}
              </div>
              <div className="mt-1 text-2xl font-semibold text-green-700">
                {total}
              </div>
            </div>
            <div className="text-xs text-gray-500">
              {sortedRows.length} {sortedRows.length === 1 ? "record" : "records"}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Revenue (ex GST & Stripe) */}
            <div className="bg-white border rounded-lg shadow-sm p-4 flex items-center">
              <div>
                <div className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
                  Revenue (ex GST & Stripe)
                </div>
                <div className="mt-1 text-2xl font-semibold text-green-700">
                  {currency.format(totals.revenue)}
                </div>
              </div>
              <div className="ml-auto text-xs text-gray-500 text-right">
                {totals.moneyCount} {totals.moneyCount === 1 ? "sale" : "sales"}
              </div>
            </div>

            {/* GST card */}
            <div className="bg-white border rounded-lg shadow-sm p-2 flex items-center">
              <div>
                <div className="text-[10px] font-semibold tracking-wide text-gray-500 uppercase">
                  GST collected
                </div>
                <div className="mt-0.5 text-lg font-semibold">
                  {currency.format(totals.gst)}
                </div>
              </div>
            </div>

            {/* Stripe card */}
            <div className="bg-white border rounded-lg shadow-sm p-2 flex items-center">
              <div>
                <div className="text-[10px] font-semibold tracking-wide text-gray-500 uppercase">
                  Stripe fees
                </div>
                <div className="mt-0.5 text-lg font-semibold">
                  {currency.format(totals.stripeFees)}
                </div>
              </div>
            </div>
          </div>
        )}

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
                      Math.min(p + 1, Math.ceil(sortedRows.length / rowsPerPage))
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
                    onClick={() => handleSort("saleId")}
                  >
                    <span className="inline-flex items-center gap-1">
                      Sale #
                      <span className="text-[10px]">{sortIcon("saleId")}</span>
                    </span>
                  </th>

                  <th
                    className="px-4 py-3 text-left cursor-pointer select-none"
                    onClick={() => handleSort("client")}
                  >
                    <span className="inline-flex items-center gap-1">
                      Client
                      <span className="text-[10px]">{sortIcon("client")}</span>
                    </span>
                  </th>

                  {activeSection !== "membership" && (
                    <th className="px-4 py-3 text-left">Type</th>
                  )}

                  <th
                    className="px-4 py-3 text-left cursor-pointer select-none"
                    onClick={() => handleSort("date")}
                  >
                    <span className="inline-flex items-center gap-1">
                      Sale date
                      <span className="text-[10px]">{sortIcon("date")}</span>
                    </span>
                  </th>

                  <th
                    className="px-4 py-3 text-left cursor-pointer select-none"
                    onClick={() => handleSort("location")}
                  >
                    <span className="inline-flex items-center gap-1">
                      Location
                      <span className="text-[10px]">{sortIcon("location")}</span>
                    </span>
                  </th>

                  <th
                    className="px-4 py-3 text-right cursor-pointer select-none"
                    onClick={() => handleSort("amount")}
                  >
                    <span className="inline-flex items-center gap-1 justify-end w-full">
                      Amount
                      <span className="text-[10px]">{sortIcon("amount")}</span>
                    </span>
                  </th>
                  {(activeSection === "membership" ||
                    activeSection === "stripe_recurring" ||
                    activeSection === "all") && (
                      <th className="px-4 py-3 text-right">
                        Stripe fee
                      </th>
                    )}
                  {(activeSection === "membership" ||
                    activeSection === "stripe_recurring" ||
                    activeSection === "all") && (
                      <th className="px-4 py-3 text-right">GST fee</th>
                    )}
                  <th className="px-4 py-3 text-left">
                    {activeSection === "usage"
                      ? "Usage details"
                      : activeSection === "refund"
                        ? "Refund reason"
                        : activeSection === "membership"
                          ? "Membership plan"
                          : activeSection === "stripe_recurring"
                            ? "Stripe status"
                            : "Description"}
                  </th>

                  {activeSection === "membership" && (
                    <th className="px-4 py-3 text-left">Description</th>
                  )}
                </tr>
              </thead>

              <tbody>
                {sortedRows.length ? (
                  paginatedRows.map((row) => (
                    <tr key={row.id} className="border-b last:border-b-0 hover:bg-gray-50">
                      <td className="px-4 py-3 text-beauty-purple font-medium">{row.id}</td>

                      <td className="px-4 py-3">
                        {row.customerName || `Customer #${row.customerId}`}
                      </td>

                      {activeSection !== "membership" && (
                        <td className="px-4 py-3 capitalize">
                          {row.type === "purchase" ? "Membership purchase" : row.type}
                        </td>
                      )}

                      <td className="px-4 py-3">
                        {formatDateToStandardLabel(row.createdAt)}, {formatTime12h(row.createdAt)}
                      </td>

                      <td className="px-4 py-3">
                        {row.outletName || (row.outletId ? `Outlet #${row.outletId}` : "-")}
                      </td>

                      <td className="px-4 py-3 text-center font-medium tabular-nums">
                        {row.type === "usage" || row.type === "refund" ? row.amount : currency.format(row.amount)}
                      </td>
                      {(activeSection === "membership" ||
                        activeSection === "stripe_recurring" ||
                        activeSection === "all") && (
                          <td className="px-4 py-3 text-right font-medium tabular-nums">
                            {row.stripeFee && row.stripeFee > 0
                              ? currency.format(row.stripeFee)
                              : "-"}
                          </td>
                        )}
                      {(activeSection === "membership" ||
                        activeSection === "stripe_recurring" ||
                        activeSection === "all") && (
                          <td className="px-4 py-3 text-right tabular-nums">
                            {row.gstFee && row.gstFee > 0 ? currency.format(row.gstFee) : "-"}
                          </td>
                        )}
                      <td className="px-4 py-3 max-w-xs truncate">
                        {activeSection === "stripe_recurring" ? (
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                              row.stripeStatus === "paid"
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            )}
                          >
                            {row.stripeStatus === "paid" ? "Paid" : "Failed"}
                          </span>
                        ) : activeSection === "membership" ? (
                          row.membershipTitle || "-"
                        ) : (
                          row.description || "-"
                        )}
                      </td>

                      {activeSection === "membership" && (
                        <td className="px-4 py-3 max-w-xs truncate">
                          {row.description || "-"}
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={
                        activeSection === "membership" ? 8 : 8
                      }
                      className="px-4 py-6 text-center text-gray-500"
                    >
                      No credit sales records found for the selected date range.
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
