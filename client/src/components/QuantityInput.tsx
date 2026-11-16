import { useState, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";

type QuantityInputProps = Pick<ComponentProps<typeof Input>, "style"> & {
  quantity: number;
  onQuantityChange: (quantity: number) => void;
};

export function QuantityInput({ quantity, onQuantityChange, style }: QuantityInputProps) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <Input
      type="number"
      min="1"
      step="1"
      aria-label="Cantidad"
      value={draft ?? quantity}
      style={style}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={(event) => {
        const nextQuantity = event.currentTarget.valueAsNumber;
        setDraft(null);
        if (Number.isSafeInteger(nextQuantity) && nextQuantity >= 1 && nextQuantity !== quantity) {
          onQuantityChange(nextQuantity);
        }
      }}
      onWheel={(event) => event.currentTarget.blur()}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
    />
  );
}
