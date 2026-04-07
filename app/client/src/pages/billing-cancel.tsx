import { useEffect } from "react";
import { useLocation } from "wouter";
import { toastManager } from "@/components/shared/toast-manager";

export default function BillingCancel() {
  const [, navigate] = useLocation();

  useEffect(() => {
    toastManager({
      title: "Payment cancelled",
      description: "You have cancelled the payment.",
      status: "failure",
    });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="text-3xl font-semibold text-red-500 mb-2">
          ❌ Payment Cancelled
        </div>
        <p className="text-gray-600 mb-6">
          No charges were made. You can try again later.
        </p>
        <button
          onClick={() => navigate("/")}
          className="bg-beauty-purple hover:bg-beauty-purple-light text-white rounded-lg px-4 py-2"
        >
          Return to Dashboard
        </button>
      </div>
    </div>
  );
}
