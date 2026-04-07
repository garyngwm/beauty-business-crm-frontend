import { Switch, Route } from "wouter";
import { queryClient } from "./lib/query-client";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "~/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Customers from "@/pages/customers";
import Services from "@/pages/services";
import Staffs from "@/pages/staffs";
import Checkout from "@/pages/checkout";
import MembershipCheckout from "./pages/checkout-membership";
import ServiceView from "./components/service/service-view";
import StaffView from "./components/staff/staff-view";
import BillingSuccess from "./pages/billing-success";
import BillingCancel from "./pages/billing-cancel";
import SalesRecordsPage from "./components/sales/sales";
import { Toaster } from "sonner";

import Login from "@/pages/login";
import RequireAuth from "@/auth/requireAuth";
import {
  enforceDailyReloginOnLoad,
  startIdleLogout,
} from "@/auth/sessionPolicy";
import { useEffect, useState } from "react";

function Router() {
  return (

    <Switch>
      {/* Public */}
      <Route path="/login" component={Login} />

      {/* Protected */}
      <RequireAuth>
        <Route path="/" component={Dashboard} />
        <Route path="/sales" component={SalesRecordsPage} />
        <Route path="/customers" component={Customers} />
        <Route path="/services" component={Services} />
        <Route path="/services/view" component={ServiceView} />
        <Route path="/staffs" component={Staffs} />
        <Route path="/staffs/view" component={StaffView} />
        <Route path="/checkout" component={Checkout} />
        <Route path="/checkout/membership/:planId" component={MembershipCheckout} />
        <Route path="/billing/success" component={BillingSuccess} />
        <Route path="/billing/cancel" component={BillingCancel} />
      </RequireAuth>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [warnSeconds, setWarnSeconds] = useState<number | null>(null);

  useEffect(() => {
    // Force relogin if app opened on a new day
    enforceDailyReloginOnLoad();

    // Start idle logout timer
    const stop = startIdleLogout({
      onWarn: (s) => setWarnSeconds(s),
      onLogout: () => {
        window.location.href = "/login";
      },
    });

    return () => stop();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* 
        DelayDuration -> how much time before show 
        SkipDelayDuration -> whats the time window that we can switch between two tooltips, without incurring the delays
      */}
      <TooltipProvider delayDuration={250} skipDelayDuration={0}>
        {/* Using sonner's toaster version, NOT shadcn's version */}
        <Toaster
          toastOptions={{
            style: {
              isolation: "isolate", // Creates a new stacking context
            },
          }}
          // Enable pointer-events-auto on all toast children
          // So they can respond to clicks when above an overlay
          className="[&>*]:pointer-events-auto"
        />

        {warnSeconds !== null && warnSeconds > 0 && (
          <div
            style={{
              position: "fixed",
              bottom: 16,
              right: 16,
              padding: 12,
              background: "white",
              border: "1px solid #ddd",
              borderRadius: 8,
              zIndex: 9999,
            }}
          >
            Session expires in {warnSeconds}s due to inactivity.
            <button
              onClick={() => setWarnSeconds(null)}
              style={{ marginLeft: 12 }}
            >
              Continue
            </button>
          </div>
        )}
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
