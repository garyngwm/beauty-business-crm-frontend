// src/components/shared/CustomerField.tsx
import { Button } from "~/button";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "~/form";
import CustomerDropdown from "@/components/shared/customer-dropdown";

type CustomerFieldProps = {
  control: any;
  name?: "customerId";
  disabled?: boolean;
  label?: string;
  onClickAdd?: () => void;
  addButtonText?: string;
  className?: string;
};

export default function CustomerField({
  control,
  name = "customerId",
  disabled,
  label = "Customer",
  onClickAdd,
  addButtonText = "+ Add",
  className,
}: CustomerFieldProps) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel className="text-slate-600/93 font-semibold">
            {label}
          </FormLabel>
          {onClickAdd && (
            <Button
              type="button"
              className="bg-purple-600 hover:bg-purple-700 text-white h-6 px-2 ml-2 text-xs"
              onClick={onClickAdd}
            >
              {addButtonText}
            </Button>
          )}
          <FormControl>
            <CustomerDropdown
              value={field.value}
              onChange={field.onChange}
              disabled={disabled ?? false}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
