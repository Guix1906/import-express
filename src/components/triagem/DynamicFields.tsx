import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";
import type { DynField } from "@/lib/practice-area-fields";
import { shouldShowField } from "@/lib/practice-area-fields";

type Props = {
  fields: DynField[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  title?: string;
  accent?: "primary" | "muted";
};

export function DynamicFields({ fields, values, onChange, title, accent = "primary" }: Props) {
  const visible = fields.filter((f) => shouldShowField(f, values));
  if (visible.length === 0) return null;

  return (
    <div
      className={cn(
        "rounded-xl border p-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-300",
        accent === "primary" ? "border-primary/20 bg-primary/5" : "border-border bg-muted/30",
      )}
    >
      {title && <Label className="text-xs uppercase tracking-wide text-primary">{title}</Label>}
      <div className="grid sm:grid-cols-2 gap-3">
        {visible.map((f) => (
          <FieldRow key={f.key} field={f} value={values[f.key]} onChange={onChange} />
        ))}
      </div>
    </div>
  );
}

function FieldRow({
  field,
  value,
  onChange,
}: {
  field: DynField;
  value: unknown;
  onChange: (key: string, value: unknown) => void;
}) {
  if (field.type === "boolean") {
    const v = value as boolean | undefined;
    return (
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">{field.label}</Label>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => onChange(field.key, v === true ? undefined : true)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs border transition",
              v === true
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                : "bg-background hover:bg-muted border-input",
            )}
          >
            <Check className="h-3 w-3" /> Sim
          </button>
          <button
            type="button"
            onClick={() => onChange(field.key, v === false ? undefined : false)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs border transition",
              v === false
                ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30"
                : "bg-background hover:bg-muted border-input",
            )}
          >
            <X className="h-3 w-3" /> Não
          </button>
        </div>
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <div>
        <Label className="text-xs">{field.label}</Label>
        <select
          value={(value as string) ?? ""}
          onChange={(e) => onChange(field.key, e.target.value || undefined)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
        >
          <option value="">—</option>
          {field.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === "number") {
    return (
      <div>
        <Label className="text-xs">{field.label}</Label>
        <Input
          type="number"
          value={(value as number | string) ?? ""}
          onChange={(e) =>
            onChange(field.key, e.target.value === "" ? undefined : Number(e.target.value))
          }
        />
      </div>
    );
  }

  if (field.type === "date") {
    return (
      <div>
        <Label className="text-xs">{field.label}</Label>
        <Input
          type="date"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(field.key, e.target.value || undefined)}
        />
      </div>
    );
  }

  // text / textarea
  return (
    <div>
      <Label className="text-xs">{field.label}</Label>
      <Input
        value={(value as string) ?? ""}
        onChange={(e) => onChange(field.key, e.target.value || undefined)}
        placeholder={field.type === "text" ? field.placeholder : undefined}
      />
    </div>
  );
}
