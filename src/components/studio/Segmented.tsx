import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: Array<{ value: T; label: string; hint?: string }>;
  onChange: (value: T) => void;
  disabled?: boolean;
}

// Base UI does not show "" as a pressed value, so an empty option travels under this key.
const EMPTY = "__empty__";
const toKey = (value: string) => value || EMPTY;
const fromKey = (key: string) => (key === EMPTY ? "" : key);

/** A single-choice row built on ToggleGroup, labelled like an instrument control. */
export function Segmented<T extends string>({ label, value, options, onChange, disabled }: SegmentedProps<T>) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="label-caps shrink-0">{label}</span>
      <ToggleGroup
        aria-label={label}
        value={[toKey(value)]}
        disabled={disabled}
        onValueChange={(values) => values.length > 0 && onChange(fromKey(values[0]) as T)}
        className="rounded-md border bg-background p-0.5"
        spacing={0}
      >
        {options.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={toKey(option.value)}
            title={option.hint}
            className={cn(
              "h-7 rounded-[5px] px-3 font-mono text-xs text-muted-foreground",
              "data-[pressed]:bg-primary data-[pressed]:text-primary-foreground data-[pressed]:shadow-sm",
            )}
          >
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
