// MembershipCheckout.tsx
import { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/query-client";
import { Button } from "~/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/card";
import { ArrowLeft, CreditCard } from "lucide-react";

const extractMembershipParams = () => {
  const path = window.location.pathname;
  const planMatch = path.match(/\/checkout\/membership\/(\d+)/);
  const planId = planMatch ? Number(planMatch[1]) : NaN;

  const urlParams = new URLSearchParams(window.location.search);
  const customerIdStr = urlParams.get("customerId");
  const customerId = customerIdStr ? Number(customerIdStr) : NaN;
  const outletId = Number(urlParams.get("outletId"));

  return { planId, customerId, outletId };
};

export default function MembershipCheckout() {
  const { planId, customerId, outletId } = extractMembershipParams();
  const [, navigate] = useLocation();
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  const formattedAmount = useMemo(() => {
    if (!plan?.amount) return "";
    const amt =
      typeof plan.amount === "string" ? parseFloat(plan.amount) : plan.amount;
    return new Intl.NumberFormat("en-SG", {
      style: "currency",
      currency: "SGD",
    }).format(amt || 0);
  }, [plan]);

  useEffect(() => {
    const init = async () => {
      try {
        if (!planId || !customerId) {
          setError("Missing plan or customer info.");
          setLoading(false);
          return;
        }

        // Fetch membership info for display
        const planData = await apiRequest("GET", `/api/membership/${planId}`);
        setPlan(planData);

        // Send to backend to create a Stripe Checkout Session (recurring)
        const success_url = `${window.location.origin}/billing/success`;
        const cancel_url = `${window.location.origin}/billing/cancel`;

        const res = await apiRequest("POST", "/api/membership/subscribe", {
          outlet_id: outletId,
          customer_id: customerId,
          membership_id: planId,
          success_url,
          cancel_url,
        });

        const checkoutUrl = res?.checkout_url;
        if (!checkoutUrl) throw new Error("No checkout_url returned.");

        // Redirect user to Stripe Checkout
        setRedirecting(true);
        window.location.assign(checkoutUrl);
      } catch (e: any) {
        console.error("Subscription init failed:", e);
        setError(e?.message || "Failed to start subscription checkout.");
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [planId, customerId]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CreditCard className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">
              Payment Error
            </h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button variant="outline" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="w-16 h-16 bg-beauty-purple rounded-full flex items-center justify-center mx-auto mb-4">
            <CreditCard className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold beauty-purple">
            {redirecting ? "Redirecting to Stripe…" : "Preparing Checkout…"}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          {plan && (
            <>
              <div className="font-semibold text-gray-700">{plan.title}</div>
              <div className="text-2xl font-bold beauty-purple">
                {formattedAmount}
              </div>
              <p className="text-sm text-gray-500">
                Billed monthly until cancelled.
              </p>
            </>
          )}

          {!redirecting && (
            <div className="pt-4">
              <Button
                variant="outline"
                onClick={() => navigate("/")}
                className="w-full"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
