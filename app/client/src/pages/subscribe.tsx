import {
  useStripe,
  Elements,
  PaymentElement,
  useElements,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/query-client";
import { Button } from "~/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/select";
import { Badge } from "~/badge";
import { ArrowLeft, Crown, Check } from "lucide-react";
import { toastManager } from "@/components/shared/toast-manager";
import { type CustomerResponse } from "@/lib/types/customer";

// NOT INTEGRATED INTO PAGES
// NO CLUE WHAT THIS VIBE-CODED NONSENSE IS
// GOOD FUCKING LUCK

// Make sure to call `loadStripe` outside of a component's render to avoid
// recreating the `Stripe` object on every render.
if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error("Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY");
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

const MEMBERSHIP_PLANS = [
  {
    id: "monthly",
    name: "Premium Monthly",
    price: 380,
    credits: 2,
    interval: "month",
    description: "Perfect for regular beauty treatments",
    features: [
      "2 treatment credits per month",
      "Valid for 90% of our services",
      "50% discount on additional services",
      "Priority booking",
      "Birthday special offer",
    ],
  },
  {
    id: "quarterly",
    name: "Premium Quarterly",
    price: 1080,
    credits: 6,
    interval: "quarter",
    description: "Best value for beauty enthusiasts",
    features: [
      "6 treatment credits per quarter",
      "Valid for 90% of our services",
      "50% discount on additional services",
      "Priority booking",
      "Birthday special offer",
      "5% savings vs monthly plan",
    ],
  },
];

const SubscribeForm = ({
  customerId,
  selectedPlan,
}: {
  customerId: number;
  selectedPlan: (typeof MEMBERSHIP_PLANS)[0];
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [, setLocation] = useLocation();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/`,
      },
    });

    setIsProcessing(false);

    if (error) {
      toastManager({
        title: "Subscription failed",
        description: error.message || "Failed to subscribe",
        status: "failure",
      });
    } else {
      toastManager({
        title: "Subscription successful",
        description: "Welcome to Premium Membership!",
        status: "success",
      });

      setLocation("/");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Plan Summary */}
      <Card className="bg-beauty-purple-light border-purple-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Crown className="w-6 h-6 beauty-purple mr-2" />
              <h3 className="text-lg font-bold beauty-purple">
                {selectedPlan.name}
              </h3>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold beauty-purple">
                ${selectedPlan.price}
              </p>
              <p className="text-sm text-gray-600">
                per {selectedPlan.interval}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center bg-white rounded-lg p-4 mb-4">
            <div className="text-center">
              <p className="text-3xl font-bold beauty-purple">
                {selectedPlan.credits}
              </p>
              <p className="text-sm text-gray-600">
                Credits per {selectedPlan.interval}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {selectedPlan.features.map((feature, index) => (
              <div key={index} className="flex items-center text-sm">
                <Check className="w-4 h-4 text-green-600 mr-2 flex-shrink-0" />
                <span className="text-gray-700">{feature}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Payment Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Crown className="w-5 h-5 beauty-purple mr-2" />
            Payment Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
            <PaymentElement
              options={{
                layout: "tabs",
              }}
            />
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-yellow-800">
              <strong>Important:</strong> Your membership will auto-renew every{" "}
              {selectedPlan.interval}. You can cancel anytime from your account
              settings.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
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
          {isProcessing
            ? "Processing..."
            : `Subscribe for $${selectedPlan.price}`}
        </Button>
      </div>
    </form>
  );
};

export default function Subscribe() {
  const [clientSecret, setClientSecret] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(
    null
  );
  const [selectedPlanId, setSelectedPlanId] = useState<string>("monthly");

  const { data: customers = [] } = useQuery<CustomerResponse[]>({
    queryKey: ["/api/customers"],
  });

  const selectedPlan =
    MEMBERSHIP_PLANS.find((plan) => plan.id === selectedPlanId) ||
    MEMBERSHIP_PLANS[0];
  const selectedCustomer = customers.find(
    (c: CustomerResponse) => c.id === selectedCustomerId
  );

  useEffect(() => {
    if (!selectedCustomerId) {
      setLoading(false);
      return;
    }

    // For demo purposes, using a fixed price ID. In production, this would be configured per plan.
    const priceId =
      selectedPlanId === "monthly"
        ? "price_monthly_380"
        : "price_quarterly_1080";

    // Create subscription as soon as customer and plan are selected
    apiRequest("POST", "/api/create-subscription", {
      customerId: selectedCustomerId,
      priceId: priceId,
    })
      .then((res) => res.json())
      .then((data) => {
        setClientSecret(data.clientSecret);
        setLoading(false);
      })
      .catch((err) => {
        setError("Failed to initialize subscription");
        setLoading(false);
      });
  }, [selectedCustomerId, selectedPlanId]);

  // Customer Selection Phase
  if (!selectedCustomerId) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-beauty-purple rounded-full flex items-center justify-center mx-auto mb-4">
              <Crown className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold beauty-purple mb-2">
              Premium Membership
            </h1>
            <p className="text-gray-600">
              Join our exclusive membership program for the best beauty
              experience
            </p>
          </div>

          {/* Plan Selection */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {MEMBERSHIP_PLANS.map((plan) => (
              <Card
                key={plan.id}
                className={`cursor-pointer transition-all hover:shadow-lg ${
                  selectedPlanId === plan.id
                    ? "ring-2 ring-beauty-purple bg-beauty-purple-light"
                    : "hover:bg-gray-50"
                }`}
                onClick={() => setSelectedPlanId(plan.id)}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center">
                      <Crown className="w-5 h-5 beauty-purple mr-2" />
                      {plan.name}
                    </CardTitle>
                    {plan.id === "quarterly" && (
                      <Badge className="bg-green-100 text-green-700">
                        Best Value
                      </Badge>
                    )}
                  </div>
                  <div className="text-center py-4">
                    <p className="text-4xl font-bold beauty-purple">
                      ${plan.price}
                    </p>
                    <p className="text-gray-600">per {plan.interval}</p>
                    <p className="text-sm text-gray-500 mt-2">
                      {plan.description}
                    </p>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-white rounded-lg p-4 mb-4 text-center">
                    <p className="text-2xl font-bold beauty-purple">
                      {plan.credits}
                    </p>
                    <p className="text-sm text-gray-600">
                      Credits per {plan.interval}
                    </p>
                  </div>

                  <div className="space-y-2">
                    {plan.features.map((feature, index) => (
                      <div key={index} className="flex items-center text-sm">
                        <Check className="w-4 h-4 text-green-600 mr-2 flex-shrink-0" />
                        <span className="text-gray-700">{feature}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Customer Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Select Customer</CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={selectedCustomerId?.toString()}
                onValueChange={(value) =>
                  setSelectedCustomerId(parseInt(value))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a customer to subscribe..." />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer: CustomerResponse) => (
                    <SelectItem
                      key={customer.id}
                      value={customer.id.toString()}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span>
                          {customer.firstName} {customer.lastName}
                        </span>
                        <span className="text-sm text-gray-500 ml-4">
                          {customer.creditBalance} credits
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex justify-between mt-6">
                <Button
                  variant="outline"
                  onClick={() => (window.location.href = "/")}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Dashboard
                </Button>
                <Button
                  disabled={!selectedCustomerId}
                  onClick={() => setLoading(true)}
                  className="bg-beauty-purple hover:bg-purple-700 text-white"
                >
                  Continue to Payment
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-beauty-purple border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-600">Preparing subscription...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error State
  if (error || !clientSecret) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Crown className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">
              Subscription Error
            </h2>
            <p className="text-gray-600 mb-4">
              {error || "Unable to process subscription"}
            </p>
            <Button
              onClick={() => setSelectedCustomerId(null)}
              variant="outline"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Payment Form
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold beauty-purple mb-2">
            Complete Subscription
          </h1>
          <p className="text-gray-600">
            Subscribing {selectedCustomer?.firstName}{" "}
            {selectedCustomer?.lastName} to {selectedPlan.name}
          </p>
        </div>

        {/* Make SURE to wrap the form in <Elements> which provides the stripe context. */}
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <SubscribeForm
            customerId={selectedCustomerId}
            selectedPlan={selectedPlan}
          />
        </Elements>
      </div>
    </div>
  );
}
