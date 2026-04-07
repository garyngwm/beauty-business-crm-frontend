import {
  useStripe,
  Elements,
  PaymentElement,
  useElements,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/query-client";
import { Button } from "~/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/card";
import { ArrowLeft, CreditCard } from "lucide-react";
import { toastManager } from "@/components/shared/toast-manager";
import { useQueryClient } from "@tanstack/react-query";
import type { AppointmentResponse } from "@/lib/types/appointment/appointment";
import type { ServiceResponse } from "@/lib/types/service/service";

// Make sure to call `loadStripe` outside of a component's render to avoid
// recreating the `Stripe` object on every render.
// if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
//   throw new Error("Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY");
// }

// const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

type ApptWithDetails = AppointmentResponse & {
  service?: ServiceResponse | null;
};

const getLineCash = (a: ApptWithDetails) =>
  (a.cashPaid ?? a.service?.cashPrice ?? 0);

const getLineCredits = (a: ApptWithDetails) =>
  (a.creditsPaid ?? a.service?.creditCost ?? 0);

const CheckoutForm = ({
  amount,
  serviceName,
  appointmentIds,
}: {
  amount: number;
  serviceName: string;
  appointmentIds: number[];
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [, setLocation] = useLocation();
  const [isProcessing, setIsProcessing] = useState(false);
  const queryClient = useQueryClient();

  const [selectedAppointments, setSelectedAppointments] = useState<ApptWithDetails[]>([]);
  const [services, setServices] = useState<ServiceResponse[]>([]);

  useEffect(() => {
    if (!appointmentIds.length) return;

    let isCancelled = false;

    (async () => {
      try {
        const appts: AppointmentResponse[] = await Promise.all(
          appointmentIds.map((id) => apiRequest("GET", `/api/appointments/${id}`))
        );

        const allServices: ServiceResponse[] = await apiRequest("GET", "/api/services");
        if (isCancelled) return;

        setServices(allServices);

        const withDetails: ApptWithDetails[] = appts.map((a) => ({
          ...a,
          service: allServices.find((s) => s.id === a.serviceId) ?? null,
        }));

        setSelectedAppointments(withDetails);
      } catch {
        // ignore — visual breakdown shouldn't block payment
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [appointmentIds]);



  const onPaymentSuccess = async (ids: number[], paymentIntentId?: string) => {
    await apiRequest("POST", "/api/appointments/mark-appointments-paid", {
      appointment_ids: ids,
    });

    const appts = await Promise.all(
      ids.map((id) => apiRequest("GET", `/api/appointments/${id}`))
    );

    appts.forEach((appt: any) => {
      queryClient.setQueryData(["/api/appointments", appt.id], (prev: any) => ({
        ...(prev ?? {}),
        ...appt,
      }));
    });

    if (appts.length) {
      const first = appts[0];
      const dateISO = first.startTime.slice(0, 10);
      const outletId = first.outletId;

      await Promise.all([
        ...ids.map((id) =>
          queryClient.invalidateQueries({ queryKey: ["/api/appointments", id] })
        ),
        queryClient.invalidateQueries({
          queryKey: ["/api/appointments/outlet", outletId, dateISO],
        }),
        queryClient.invalidateQueries({
          queryKey: ["/api/customers/with-appointments", dateISO],
        }),
      ]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    if (isProcessing) return; // guard double-submit
    setIsProcessing(true);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
        confirmParams: { return_url: `${window.location.origin}/` },
      });

      // Normal success
      if (paymentIntent?.status === "succeeded") {
        await onPaymentSuccess(appointmentIds, paymentIntent.id); // <-- pass id
        toastManager({
          title: "Payment successful",
          description: "Thank you for your payment",
          status: "success",
        });
        setLocation("/");
        return;
      }

      // Regular error handling
      if (error) {
        toastManager({
          title: "Payment failed",
          description: error.message || "Failed to make payment",
          status: "failure",
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const totalCash = selectedAppointments.reduce((sum, a) => sum + getLineCash(a), 0);
  const totalCredits = selectedAppointments.reduce((sum, a) => sum + getLineCredits(a), 0);

  const shouldShowBreakdown = appointmentIds.length > 0;
  const displayTotal = selectedAppointments.length > 0
    ? totalCash
    : amount;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-beauty-purple rounded-full flex items-center justify-center mx-auto mb-4">
              <CreditCard className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold beauty-purple">
              Complete Payment
            </CardTitle>
            <div className="bg-white rounded-lg p-4 mt-4 space-y-2">
              {shouldShowBreakdown ? (
                selectedAppointments.length > 0 ? (
                  <>
                    <div className="divide-y divide-gray-100">
                      {selectedAppointments.map((a) => (
                        <div key={a.id} className="flex items-center justify-between py-2">
                          <div className="text-sm text-gray-700">
                            {a.service?.name ?? "Service"}{" "}
                            <span className="text-xs text-gray-500">#{a.id}</span>
                          </div>
                          <div className="text-sm font-semibold text-gray-800">
                            ${getLineCash(a).toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600">Total</span>
                      <span className="text-xl font-bold beauty-purple">
                        ${totalCash.toFixed(2)}
                      </span>
                    </div>

                    {totalCredits > 0 && (
                      <div className="text-xs text-gray-500">Credits portion: {totalCredits}</div>
                    )}
                  </>
                ) : (
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-100 rounded animate-pulse" />
                    <div className="h-4 bg-gray-100 rounded animate-pulse w-5/6" />
                    <div className="h-6 bg-gray-100 rounded animate-pulse w-1/3 ml-auto" />
                  </div>
                )
              ) : (
                <>
                  <p className="text-sm font-medium text-gray-700">{serviceName}</p>
                  <p className="text-2xl font-bold beauty-purple">
                    ${Number(amount ?? 0).toFixed(2)}
                  </p>
                </>
              )}
            </div>

          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <PaymentElement
                  options={{
                    layout: "tabs",
                  }}
                />
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation("/")}
                  className="flex-1"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={!stripe || isProcessing}
                  className="flex-1 bg-beauty-purple hover:bg-purple-700 text-white"
                >
                  {isProcessing ? "Processing..." : `Pay $${Number(displayTotal ?? 0).toFixed(2)}`}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default function Checkout() {
  const [amount, setAmount] = useState<number | null>(null);
  const [currency, setCurrency] = useState("SGD");
  const [clientSecret, setClientSecret] = useState("");
  const [publishableKey, setPublishableKey] = useState<string>("");
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Get payment details from URL params or localStorage
  const urlParams = new URLSearchParams(window.location.search);
  const serviceName = urlParams.get("service") || "Beauty Service";
  const serviceId = urlParams.get("serviceId");
  const appointmentId = urlParams.get("appointmentId");

  // Paying for multiple services
  const appointmentIdsParams = urlParams.get("appointmentIds");
  const appointmentIds = appointmentIdsParams
    ? appointmentIdsParams
      .split(",")
      .map((x) => Number(x.trim()))
      .filter(Boolean)
    : appointmentId
      ? [Number(appointmentId)]
      : [];

  useEffect(() => {
    if (appointmentIds.length === 0 && !serviceId) {
      setError("Missing appointment(s) or service");
      setLoading(false);
      return;
    }

    apiRequest("POST", "/api/payments/create-payment-intent", {
      appointment_ids: appointmentIds,
      // Optional
      service_id: serviceId ? Number(serviceId) : undefined,
      outlet_id: Number(urlParams.get("outletId")),
    })
      .then((data) => {
        if (!data?.clientSecret || !data?.publishableKey) throw new Error("Missing Stripe init data");
        setClientSecret(data.clientSecret);
        setPublishableKey(data.publishableKey);
        setAmount(typeof data.amount === "number" ? data.amount : null);
        setCurrency(typeof data.currency === "string" ? data.currency.toUpperCase() : "SGD");
        if (typeof data.amount === "number") setAmount(data.amount);
        if (typeof data.currency === "string")
          setCurrency(data.currency.toUpperCase());
        setLoading(false);
        setStripePromise(loadStripe(data.publishableKey));
      })
      .catch((e) => {
        console.error("init error:", e);
        setError("Failed to initialize payment");
        setLoading(false);
      });
  }, [serviceId, appointmentIdsParams]);

  const titleLabel =
    appointmentIds.length > 1
      ? `Checkout ${appointmentIds.length} services`
      : serviceName;

  const formatAmount = (a: number | null, ccy: string) =>
    a == null
      ? "—"
      : new Intl.NumberFormat("en-SG", {
        style: "currency",
        currency: ccy,
      }).format(a);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-beauty-purple border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-600">Preparing payment...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !clientSecret) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CreditCard className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">
              Payment Error
            </h2>
            <p className="text-gray-600 mb-4">
              {error || "Unable to process payment"}
            </p>
            <Button
              onClick={() => (window.location.href = "/")}
              variant="outline"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return stripePromise && clientSecret ? (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <CheckoutForm
        amount={amount ?? 0}
        serviceName={titleLabel}
        appointmentIds={appointmentIds}
      />
    </Elements>
  ) : null;
}
