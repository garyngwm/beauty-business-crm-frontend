import { useEffect } from "react";
import { useLocation } from "wouter";
import { toastManager } from "@/components/shared/toast-manager";

export default function BillingSuccess() {
  const [, navigate] = useLocation();

  useEffect(() => {
    toastManager({
      title: "Payment successful",
      description: "Membership activated. Thank you!",
      status: "success",
    });

    // optional: refresh data or redirect after 2 seconds
    const t = setTimeout(() => navigate("/"), 2000);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="text-3xl font-semibold text-beauty-purple mb-2">
          ✅ Payment Successful!
        </div>
        <p className="text-gray-600 mb-6">
          Redirecting you back to your dashboard...
        </p>
      </div>
    </div>
  );
}
