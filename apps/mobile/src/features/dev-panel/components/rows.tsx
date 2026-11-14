import { Children, Fragment, type ReactNode } from 'react';
import { View } from 'react-native';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Switch } from '@/shared/components/ui/switch';
import { Text } from '@/shared/components/ui/text';
import { cn } from '@/shared/lib/utils';

/** Group of settings (DESIGN_SYSTEM.md §3.5): heading outside, rows in an RNR `Card` split by `Separator`. */
export function Group({ title, children }: { title: string; children: ReactNode }) {
  const rows = Children.toArray(children);
  return (
    <View className="gap-2">
      <Text
        role="heading"
        className="text-muted-foreground text-micro px-1 font-semibold uppercase"
      >
        {title}
      </Text>
      <View className="border-border overflow-hidden rounded-lg border">
        {rows.map((row, i) => (
          <Fragment key={(row as { key?: string }).key ?? i}>
            {i > 0 ? <View className="bg-border ml-4 h-px" /> : null}
            {row}
          </Fragment>
        ))}
      </View>
    </View>
  );
}

/** One row: label, optional one-line hint and a control on the right (or below when stacked). */
export function Row({
  label,
  hint,
  children,
  stacked = false,
}: {
  label: string;
  hint?: string;
  children?: ReactNode;
  stacked?: boolean;
}) {
  return (
    <View
      className={cn(
        'min-h-row-settings gap-3 px-4 py-2.5',
        !stacked && 'flex-row items-center justify-between',
      )}
    >
      <View className={cn('gap-0.5', !stacked && 'flex-1 pr-3')}>
        <Text className="text-body-sm font-medium">{label}</Text>
        {hint ? <Text className="text-tertiary text-caption">{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

export function SwitchRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Row label={label} hint={hint}>
      <Switch checked={value} onCheckedChange={onChange} accessibilityLabel={label} />
    </Row>
  );
}

/** RNR `Select` over a list of `{ value, label }` options (values are strings). */
export function Picker({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string | undefined;
  onChange: (value: string) => void;
}) {
  const selected = options.find((o) => o.value === value);
  return (
    <Select
      value={selected}
      onValueChange={(option) => {
        if (option) onChange(option.value);
      }}
    >
      <SelectTrigger className="h-12 w-full" accessibilityLabel={label}>
        <SelectValue placeholder={label} className="text-base" />
      </SelectTrigger>
      <SelectContent className="w-72">
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} label={o.label} className="min-h-12" />
        ))}
      </SelectContent>
    </Select>
  );
}

/** Monospace block for raw values (last envelope, etc.). */
export function Code({ children }: { children: string }) {
  return (
    <Text className="bg-muted text-muted-foreground text-caption rounded-md p-2 font-mono">
      {children}
    </Text>
  );
}
