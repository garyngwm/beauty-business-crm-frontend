import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/dialog";
import { Button } from "~/button";
import { cn } from "@/lib/utils/date-processing";
import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/query-client";
import CustomerField from "@/components/customer/customer-field";
import { Form } from "~/form";
import { useLocation } from "wouter";

type Plan = {
  id: number;
  title: string;
  subtitle: string;
};

type MembershipResponse = {
  id: number;
  title: string | null;
  subtitle: string | null;
  amount: string | number;
  credits: number;
  created_at: string;
};

interface MembershipModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect?: (plan: Plan) => void;
  customerName?: string;
  customerId?: number;
  outletId?: number;
}

export default function MembershipModal({
  isOpen,
  onClose,
  onSelect,
  customerName,
  customerId,
  outletId,
}: MembershipModalProps) {
  const [, navigate] = useLocation();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const form = useForm<{ customerId?: number }>({
    defaultValues: { customerId: customerId ?? undefined },
  });
  const watchedCustomerId = form.watch("customerId");
  const effectiveCustomerId = customerId ?? watchedCustomerId;

  useEffect(() => {
    if (isOpen) {
      form.reset({ customerId: customerId ?? undefined });
    }
  }, [isOpen, customerId, form]);

  const {
    data: memberships = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<MembershipResponse[]>({
    queryKey: ["/api/membership"],
    queryFn: () => apiRequest("GET", "/api/membership"),
    enabled: isOpen, // only fetch when modal is open
  });

  const plans: Plan[] = useMemo(() => {
    const fmtAmount = (a: string | number) => {
      const n = typeof a === "string" ? parseFloat(a) : a;
      if (Number.isFinite(n)) return `SGD ${n.toFixed(2)}`;
      return `SGD ${a}`;
    };

    return memberships.map((m) => {
      const sessions = `${m.credits} ${m.credits === 1 ? "session" : "sessions"}`;
      const autoSubtitle = `${sessions} · ${fmtAmount(m.amount)}`;
      return {
        id: m.id,
        title: m.title ?? "Untitled membership",
        subtitle:
          m.subtitle && m.subtitle.trim().length > 0
            ? m.subtitle
            : autoSubtitle,
      };
    });
  }, [memberships]);

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === selectedId) ?? null,
    [selectedId, plans]
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl w-full max-h-[85vh] overflow-auto p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Purchase Membership {customerName ? `for ${customerName}` : ""}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <div className="mb-4">
            <CustomerField
              control={form.control}
              name="customerId"
              disabled={!!customerId}
            />
          </div>
        </Form>

        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="h-4 w-2/3 bg-slate-200 rounded mb-2 animate-pulse" />
                <div className="h-3 w-4/5 bg-slate-200 rounded animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {isError && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Failed to load memberships.
            <Button
              variant="outline"
              onClick={() => refetch()}
              className="ml-2 h-7 px-2 text-sm"
            >
              Retry
            </Button>
          </div>
        )}

        {/* Grid of plans */}
        {!isLoading && !isError && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            {plans.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedId(p.id)}
                className={cn(
                  "w-full text-left rounded-xl border bg-white px-4 py-3",
                  "shadow-sm hover:shadow transition-shadow",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-black/15",
                  selectedId === p.id
                    ? "border-beauty-purple ring-2 ring-beauty-purple/30"
                    : "border-gray-200"
                )}
              >
                <div className="text-[15px] font-semibold text-slate-900">
                  {p.title}
                </div>
                <div className="mt-1 text-sm text-slate-600 truncate">
                  {p.subtitle}
                </div>
              </button>
            ))}

            {plans.length === 0 && (
              <div className="col-span-full text-sm text-slate-600">
                No memberships available.
              </div>
            )}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} className="text-base">
            Cancel
          </Button>
          <Button
            className="bg-beauty-purple hover:bg-beauty-purple-light text-white text-base"
            disabled={!selectedPlan || !effectiveCustomerId}
            onClick={() => {
              if (!selectedPlan || !effectiveCustomerId) return;

              onSelect?.(selectedPlan);
              const planId = selectedPlan.id ?? selectedId;

              navigate(
                `/checkout/membership/${planId}?customerId=${effectiveCustomerId}&outletId=${outletId}`
              );
              onClose();
            }}
          >
            {selectedPlan ? "Checkout" : "Select a plan"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
