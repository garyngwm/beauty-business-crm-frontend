import type { Control } from "react-hook-form";
import { BookingFormValues } from "../calendar/appointments/booking-modal";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "~/form";
import ServiceDropdown from "@/components/shared/service-dropdown";

type ServiceItem = { serviceId: number; quantity: number };

export type Service = {
  id: number;
  name: string;
  duration: number;
  creditCost: number;
  cashPrice: number;
};

interface ServiceFieldProps {
  control: Control<BookingFormValues>;
  name: "serviceItems";
  services: Service[];
  isEditMode: boolean;
  disabled?: boolean;
}

export default function ServiceField({
  control,
  name,
  services,
  isEditMode,
  disabled = false,
}: ServiceFieldProps) {
  const getServiceName = (id: number) =>
    services.find((s) => s.id === id)?.name ?? `Service #${id}`;

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const items: ServiceItem[] = Array.isArray(field.value) ? field.value : [];
        const selectedIds = items.map((x) => x.serviceId);

        const upsertItem = (serviceId: number, quantity: number) => {
          if (!Number.isFinite(serviceId)) return;

          const nextQty = Math.max(1, quantity);

          const exists = items.some((x) => x.serviceId === serviceId);
          if (!exists) {
            field.onChange([...items, { serviceId, quantity: nextQty }]);
            return;
          }

          field.onChange(
            items.map((x) =>
              x.serviceId === serviceId ? { ...x, quantity: nextQty } : x
            )
          );
        };

        const increment = (serviceId: number) => {
          const current = items.find((x) => x.serviceId === serviceId);
          const nextQty = (current?.quantity ?? 0) + 1;
          upsertItem(serviceId, nextQty);
        };

        const decrement = (serviceId: number) => {
          const current = items.find((x) => x.serviceId === serviceId);
          const nextQty = (current?.quantity ?? 1) - 1;

          // Remove item if qty goes below 1
          if (nextQty < 1) {
            field.onChange(items.filter((x) => x.serviceId !== serviceId));
            return;
          }

          upsertItem(serviceId, nextQty);
        };

        const onChangeSingle = (id: number) => {
          if (!Number.isFinite(id)) return;

          if (isEditMode) {
            const existingQty = items.find((x) => x.serviceId === id)?.quantity ?? 1;
            field.onChange([{ serviceId: id, quantity: existingQty }]);
            return;
          }

          // create mode: clicking same service again bumps qty
          const existing = items.find((x) => x.serviceId === id);
          if (existing) {
            increment(id);
          } else {
            field.onChange([...items, { serviceId: id, quantity: 1 }]);
          }
        };

        const onChangeMulti = (ids: number[]) => {
          const nextIds = Array.isArray(ids)
            ? ids.filter((x) => Number.isFinite(x))
            : [];

          if (isEditMode) {
            const first = nextIds[0];
            if (!first) {
              field.onChange([]);
              return;
            }
            const existingQty =
              items.find((x) => x.serviceId === first)?.quantity ?? 1;
            field.onChange([{ serviceId: first, quantity: existingQty }]);
            return;
          }

          const nextItems: ServiceItem[] = nextIds.map((sid) => {
            const existingQty = items.find((x) => x.serviceId === sid)?.quantity ?? 1;
            return { serviceId: sid, quantity: existingQty };
          });

          field.onChange(nextItems);
        };

        return (
          <FormItem>
            <FormLabel className="text-slate-600/93 font-semibold">
              {isEditMode ? "Service" : "Services"}
            </FormLabel>

            <FormControl>
              <ServiceDropdown
                services={services}
                disabled={disabled}
                isEditMode={isEditMode}
                value={selectedIds}
                onChangeSingle={onChangeSingle}
                onChangeMulti={onChangeMulti}
              />
            </FormControl>

            {/* Quantity controls */}
            {!isEditMode && items.length > 0 && (
              <div className="mt-3 space-y-2">
                {items.map((item) => (
                  <div
                    key={item.serviceId}
                    className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
                  >
                    <div className="flex flex-col">
                      <span className="text-slate-800 font-medium">
                        {getServiceName(item.serviceId)}
                      </span>
                      <span className="text-sm text-slate-500">
                        Quantity: {item.quantity}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="h-9 w-9 rounded-md border border-slate-300 text-lg"
                        onClick={() => decrement(item.serviceId)}
                        disabled={disabled}
                        aria-label="Decrease quantity"
                      >
                        –
                      </button>

                      <span className="w-10 text-center font-semibold text-slate-800">
                        {item.quantity}
                      </span>

                      <button
                        type="button"
                        className="h-9 w-9 rounded-md border border-slate-300 text-lg"
                        onClick={() => increment(item.serviceId)}
                        disabled={disabled}
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
