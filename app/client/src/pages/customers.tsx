import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Plus, Edit, Calendar, User } from "lucide-react";
import Sidebar from "@/components/shared/sidebar";
import { Button } from "~/button";
import { Input } from "~/input";
import { Badge } from "~/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/table";
import CustomerModal from "@/components/customer/customer-modal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/tabs";
import { apiRequest } from "@/lib/query-client";
import LoadingSpinner from "@/components/shared/loading-spinner";
import { useMinimumLoadingTime } from "@/hooks/use-min-loading";
import useDebounce from "@/hooks/use-debounce";
import { type CustomerResponse } from "@/lib/types/customer";
import { type AppointmentResponse } from "@/lib/types/appointment/appointment";
import { type ServiceResponse } from "@/lib/types/service/service";
import { type StaffResponse } from "@/lib/types/staff/staff";

type ListResponse<T> = { data: T[] };

type AppointmentWithDetails = AppointmentResponse & {
  service: ServiceResponse | null;
  staffMember: StaffResponse | null;
};

const APPOINTMENTS_WRAPPED_IN_DATA = false;

export default function Customers() {
  // Customer modal state
  const [customerModal, setCustomerModal] = useState(false);
  const [customerId, setCustomerId] = useState(-1);

  const [page, setPage] = useState(1);

  const handleNext = () => setPage((p) => p + 1);
  const handlePrev = () => setPage((p) => Math.max(1, p - 1));
  const [viewingCustomer, setViewingCustomer] = useState<CustomerResponse | null>(
    null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery.trim(), 300);

  const startOfToday = (() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  })();

  // Fetch customers with pagination
  const { data: customersPage, isLoading: isCustomersLoading } = useQuery({
    queryKey: ["/api/customers/list", page],
    queryFn: () => apiRequest("GET", `/api/customers/list?page=${page}&limit=200`),
  });

  const { data: searchResults, isLoading: isSearchLoading } = useQuery({
    queryKey: ["/api/customers/search", debouncedSearch],
    queryFn: () =>
      apiRequest(
        "GET",
        `/api/customers/search?search_query=${encodeURIComponent(debouncedSearch)}`
      ),
    enabled: debouncedSearch.length > 0,
  });

  const customers: CustomerResponse[] =
    debouncedSearch.length > 0 ? searchResults ?? [] : customersPage?.data ?? [];

  // Fetch services
  const { data: services = [], isLoading: isServicesLoading } = useQuery<
    ServiceResponse[]
  >({
    queryKey: ["/api/services"],
    queryFn: () => apiRequest("GET", "/api/services"),
  });

  // Fetch staffs
  const { data: staff = [], isLoading: isStaffsLoading } = useQuery<
    StaffResponse[]
  >({
    queryKey: ["/api/staffs"],
    queryFn: () => apiRequest("GET", "/api/staffs"),
  });

  // Fetch appointments ONLY for selected customer
  const selectedCustomerId = viewingCustomer?.id;

  const {
    data: selectedCustomerAppointmentsRaw,
    isLoading: isSelectedAppointmentsLoading,
  } = useQuery<AppointmentResponse[] | ListResponse<AppointmentResponse>>({
    queryKey: ["/api/appointments/by-customer", selectedCustomerId],
    queryFn: () =>
      apiRequest("GET", `/api/appointments?customerId=${selectedCustomerId}`),
    enabled: !!selectedCustomerId,
  });

  const selectedCustomerAppointments: AppointmentResponse[] =
    APPOINTMENTS_WRAPPED_IN_DATA
      ? ((selectedCustomerAppointmentsRaw as ListResponse<AppointmentResponse>)?.data ??
        [])
      : ((selectedCustomerAppointmentsRaw as AppointmentResponse[]) ?? []);

  const isLoading =
    isCustomersLoading ||
    isSearchLoading ||
    isSelectedAppointmentsLoading ||
    isServicesLoading ||
    isStaffsLoading;

  const showLoading = useMinimumLoadingTime(isLoading);

  const getMembershipBadge = (customer: CustomerResponse) => {
    if (customer.creditBalance && customer.creditBalance > 0) {
      return (
        <Badge variant="default" className="bg-green-100 text-green-800">
          Active ({customer.creditBalance} credits)
        </Badge>
      );
    }
    return <Badge variant="secondary">Regular</Badge>;
  };

  const getSelectedCustomerAppointmentsWithDetails = (): AppointmentWithDetails[] => {
    return selectedCustomerAppointments.map((appointment) => ({
      ...appointment,
      service: services.find((s) => Number(s.id) === Number(appointment.serviceId)) ?? null,
      staffMember: staff.find((st) => Number(st.id) === Number(appointment.staffId)) ?? null,
    }));
  };

  const getSelectedCustomerAppointmentsSplit = (): {
    upcoming: AppointmentWithDetails[];
    history: AppointmentWithDetails[];
  } => {
    const all = getSelectedCustomerAppointmentsWithDetails();

    const upcoming = all
      .filter((a) => new Date(a.startTime) >= startOfToday)
      .sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );

    const history = all
      .filter((a) => new Date(a.startTime) < startOfToday)
      .sort(
        (a, b) =>
          new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      );

    return { upcoming, history };
  };

  const formatDateTime = (dateString: string): string => {
    return new Date(dateString).toLocaleString();
  };

  const getPaymentStatusBadge = (paymentStatus: string) => {
    switch (paymentStatus) {
      case "Paid":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            Paid
          </Badge>
        );
      case "Pending":
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            Pending
          </Badge>
        );
      default:
        return <Badge variant="secondary">Unpaid</Badge>;
    }
  };

  const getSelectedCustomerLifetimeSpending = (): number => {
    const customerAppointments = getSelectedCustomerAppointmentsWithDetails();
    let totalSpent = 0;

    customerAppointments.forEach((appointment) => {
      if (appointment.paymentStatus === "Paid") {
        if (appointment.cashPaid) totalSpent += appointment.cashPaid;
        if (appointment.creditsPaid) totalSpent += appointment.creditsPaid * 190;
      }
    });

    return totalSpent;
  };

  const handleViewCustomer = (customer: CustomerResponse) => {
    setViewingCustomer(customer);
  };

  const formatDate = (dateValue?: string | Date | null): string => {
    if (!dateValue) return "N/A";
    const d = dateValue instanceof Date ? dateValue : new Date(dateValue);
    return Number.isNaN(d.getTime()) ? "N/A" : d.toLocaleDateString();
  };


  let upcoming: AppointmentWithDetails[] = [];
  let history: AppointmentWithDetails[] = [];
  let total = 0;

  if (viewingCustomer) {
    const split = getSelectedCustomerAppointmentsSplit();
    upcoming = split.upcoming;
    history = split.history;
    total = upcoming.length + history.length;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar />

      {/* Customer Modal */}
      <CustomerModal
        isOpen={customerModal}
        onClose={() => {
          setCustomerModal(false);
          setCustomerId(-1);
        }}
        customerId={customerId}
      />

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Customer Management
              </h1>
              <p className="text-gray-600">
                Manage your client database and membership details
              </p>
            </div>
            <Button
              onClick={() => setCustomerModal(true)}
              className="bg-beauty-purple hover:bg-beauty-purple-dark"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Customer
            </Button>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search customers by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Customer Table */}
        {showLoading ? (
          <LoadingSpinner />
        ) : (
          <div className="bg-white rounded-lg border shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Membership</TableHead>
                  <TableHead>Credits</TableHead>
                  <TableHead>Lifetime Spending</TableHead>
                  <TableHead>Appointments</TableHead>
                  <TableHead>Birthday</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer: CustomerResponse) => (
                  <TableRow
                    key={customer.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleViewCustomer(customer)}
                  >
                    <TableCell>
                      <div>
                        <div className="font-medium text-gray-900">
                          {customer.firstName} {customer.lastName}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="text-sm text-gray-900">{customer.email}</div>
                        {customer.phone && (
                          <div className="text-sm text-gray-500">{customer.phone}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getMembershipBadge(customer)}</TableCell>
                    <TableCell>
                      <span className="font-medium">{customer.creditBalance || 0}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-gray-400">-</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-400">-</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-600">
                        {formatDate(customer.birthday)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCustomerId(customer.id);
                          setCustomerModal(true);
                        }}
                        className="h-8 px-2"
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {debouncedSearch.length === 0 && (
              <div className="flex justify-between items-center p-4">
                <Button onClick={handlePrev} disabled={page === 1}>
                  Previous
                </Button>
                <span>
                  Page {customersPage?.page} of {customersPage?.totalPages}
                </span>
                <Button
                  onClick={handleNext}
                  disabled={page === customersPage?.totalPages}
                >
                  Next
                </Button>
              </div>
            )}

            {customers.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                {searchQuery
                  ? "No customers found matching your search."
                  : "No customers found."}
              </div>
            )}
          </div>
        )}

        {/* Customer Detail Sidebar */}
        {viewingCustomer && (
          <div className="fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black bg-opacity-10"
              onClick={() => setViewingCustomer(null)}
            />

            {/* Sidebar */}
            <div className="ml-auto w-96 bg-white shadow-xl h-full overflow-y-auto">
              <div className="p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-beauty-purple-light rounded-full flex items-center justify-center">
                      <span className="text-beauty-purple font-semibold text-lg">
                        {viewingCustomer.firstName.charAt(0)}
                        {viewingCustomer.lastName.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">
                        {viewingCustomer.firstName} {viewingCustomer.lastName}
                      </h2>
                      <div className="mt-1 flex items-center gap-2">
                        {getMembershipBadge(viewingCustomer)}
                        <span className="text-sm font-medium text-green-600">
                          ${getSelectedCustomerLifetimeSpending().toFixed(2)} total
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewingCustomer(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </Button>
                </div>

                {/* Tabs */}
                <Tabs defaultValue="appointments" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="appointments" className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Appointments
                    </TabsTrigger>
                    <TabsTrigger value="details" className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Details
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="appointments" className="mt-4">
                    {isSelectedAppointmentsLoading ? (
                      <div className="py-8">
                        <LoadingSpinner />
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold">Appointments</h3>
                          <div className="text-sm text-gray-500">{total} total appointments</div>
                        </div>

                        {/* UPCOMING */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold">Upcoming</h4>
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-400 text-black text-sm font-semibold">
                              {upcoming.length}
                            </span>
                          </div>
                          <div className="border rounded-lg">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Date & Time</TableHead>
                                  <TableHead>Service</TableHead>
                                  <TableHead>Staff</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead>Payment</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {upcoming.map((appointment: any) => (
                                  <TableRow key={appointment.id}>
                                    <TableCell>
                                      <div className="text-sm">
                                        {formatDateTime(appointment.startTime)}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div>
                                        <div className="font-medium">
                                          {appointment.service?.name || "Unknown Service"}
                                        </div>
                                        {appointment.service?.duration && (
                                          <div className="text-sm text-gray-500">
                                            {appointment.service.duration} min
                                          </div>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="text-sm">
                                        {appointment.staffMember
                                          ? `${appointment.staffMember.firstName} ${appointment.staffMember.lastName}`
                                          : "Unknown Staff"}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <Badge
                                        variant={
                                          appointment.status === "completed"
                                            ? "default"
                                            : "secondary"
                                        }
                                        className={
                                          appointment.status === "completed"
                                            ? "bg-green-100 text-green-800"
                                            : ""
                                        }
                                      >
                                        {appointment.status || "scheduled"}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      {getPaymentStatusBadge(appointment.paymentStatus || "pending")}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                            {upcoming.length === 0 && (
                              <div className="text-center py-6 text-gray-500">
                                No upcoming appointments.
                              </div>
                            )}
                          </div>
                        </div>

                        {/* HISTORY */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold">Appointment History</h4>
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-beauty-purple text-white text-sm font-semibold">
                              {history.length}
                            </span>
                          </div>
                          <div className="border rounded-lg">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Date & Time</TableHead>
                                  <TableHead>Service</TableHead>
                                  <TableHead>Staff</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead>Payment</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {history.map((appointment: any) => (
                                  <TableRow key={appointment.id}>
                                    <TableCell>
                                      <div className="text-sm">
                                        {formatDateTime(appointment.startTime)}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div>
                                        <div className="font-medium">
                                          {appointment.service?.name || "Unknown Service"}
                                        </div>
                                        {appointment.service?.duration && (
                                          <div className="text-sm text-gray-500">
                                            {appointment.service.duration} min
                                          </div>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="text-sm">
                                        {appointment.staffMember
                                          ? `${appointment.staffMember.firstName} ${appointment.staffMember.lastName}`
                                          : "Unknown Staff"}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <Badge
                                        variant={
                                          appointment.status === "completed"
                                            ? "default"
                                            : "secondary"
                                        }
                                        className={
                                          appointment.status === "completed"
                                            ? "bg-green-100 text-green-800"
                                            : ""
                                        }
                                      >
                                        {appointment.status || "scheduled"}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      {getPaymentStatusBadge(appointment.paymentStatus || "pending")}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                            {history.length === 0 && (
                              <div className="text-center py-6 text-gray-500">
                                No past appointments.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="details" className="mt-4">
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Contact Information */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold">Contact Information</h3>
                          <div className="space-y-3">
                            <div>
                              <label className="text-sm font-medium text-gray-500">
                                Email
                              </label>
                              <div className="text-sm">{viewingCustomer.email}</div>
                            </div>
                            {viewingCustomer.phone && (
                              <div>
                                <label className="text-sm font-medium text-gray-500">
                                  Phone
                                </label>
                                <div className="text-sm">{viewingCustomer.phone}</div>
                              </div>
                            )}
                            {viewingCustomer.birthday && (
                              <div>
                                <label className="text-sm font-medium text-gray-500">
                                  Birthday
                                </label>
                                <div className="text-sm">
                                  {formatDate(viewingCustomer.birthday)}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Membership Information */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold">Membership</h3>
                          <div className="space-y-3">
                            <div>
                              <label className="text-sm font-medium text-gray-500">
                                Status
                              </label>
                              <div className="mt-1">{getMembershipBadge(viewingCustomer)}</div>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-gray-500">
                                Credit Balance
                              </label>
                              <div className="text-lg font-semibold">
                                {viewingCustomer.creditBalance || 0} credits
                              </div>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-gray-500">
                                Total Appointments
                              </label>
                              <div className="text-sm">{selectedCustomerAppointments.length}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
