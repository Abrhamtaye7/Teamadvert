import { useId } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "./ui/Button";
import { Input } from "./ui/form";
import { COMPANY } from "../lib/company";
import { amount } from "../lib/format";
import { useItemCatalog } from "../lib/queries";
import { lineTotal, round2 } from "../lib/totals";

export type EditableLine = {
  key: string;
  itemId?: number;
  name: string;
  description: string;
  quantity: string;
  unit: string;
  price: string;
  discount: string;
  vatPercent: string;
};

let counter = 0;
export const newLine = (partial: Partial<EditableLine> = {}): EditableLine => ({
  key: `l${++counter}`,
  name: "",
  description: "",
  quantity: "1",
  unit: "pcs",
  price: "",
  discount: "",
  vatPercent: String(COMPANY.vatPercent),
  ...partial,
});

const n = (v: string) => (v.trim() === "" ? 0 : Number(v));
export const linesValid = (lines: EditableLine[]) => lines.length > 0 && lines.every((l) => l.name.trim() && n(l.quantity) > 0 && n(l.price) >= 0 && l.price.trim() !== "");

/** Proforma lines: VAT and discount per line. */
export const toProformaLines = (lines: EditableLine[]) =>
  lines.map((l) => ({
    itemId: l.itemId,
    name: l.name.trim(),
    description: l.description.trim() || undefined,
    quantity: n(l.quantity),
    unit: l.unit.trim() || undefined,
    sellingPrice: n(l.price),
    discount: l.discount.trim() ? n(l.discount) : undefined,
    vatPercent: l.vatPercent.trim() === "" ? undefined : n(l.vatPercent),
  }));

/** Job lines: plain quantity × price. */
export const toJobLines = (lines: EditableLine[]) =>
  lines.map((l) => ({ itemId: l.itemId, name: l.name.trim(), description: l.description.trim() || undefined, quantity: n(l.quantity), unit: l.unit.trim() || undefined, price: n(l.price) }));

/**
 * Editable line items. Typing a known item name fills its id, unit and selling price.
 * `withTax` shows discount and VAT columns (proformas); jobs use plain prices.
 */
export function LineItemsEditor({ lines, onChange, withTax }: { lines: EditableLine[]; onChange: (lines: EditableLine[]) => void; withTax?: boolean }) {
  const listId = useId();
  const { data: catalog } = useItemCatalog();
  const items = catalog?.data ?? [];

  const update = (key: string, patch: Partial<EditableLine>) => onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const onName = (line: EditableLine, name: string) => {
    const match = items.find((i) => i.name.toLowerCase() === name.trim().toLowerCase());
    update(
      line.key,
      match
        ? { name: match.name, itemId: match.id, unit: match.measurementUnit?.unitName ?? match.unit ?? line.unit, price: String(match.sellingPrice ?? match.basePrice ?? line.price) }
        : { name, itemId: undefined },
    );
  };

  const total = (l: EditableLine) =>
    withTax
      ? lineTotal({ quantity: n(l.quantity), sellingPrice: n(l.price), discount: n(l.discount), vatPercent: l.vatPercent.trim() === "" ? undefined : n(l.vatPercent) }).net
      : round2(n(l.quantity) * n(l.price));

  return (
    <div className="space-y-3">
      <datalist id={listId}>
        {items.map((i) => (
          <option key={i.id} value={i.name} />
        ))}
      </datalist>

      {lines.map((line, index) => (
        <div key={line.key} className="rounded-lg border border-line bg-surface-muted/50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Line {index + 1}</span>
            <div className="flex items-center gap-3">
              {/* Proforma lines show the amount before VAT, like the printout; VAT is added once in the totals */}
              <span className="text-sm font-semibold tabular-nums">
                ETB {amount(total(line))}
                {withTax && <span className="ml-1 text-xs font-normal text-ink-subtle">+ VAT</span>}
              </span>
              <button
                type="button"
                aria-label={`Remove line ${index + 1}`}
                disabled={lines.length === 1}
                onClick={() => onChange(lines.filter((l) => l.key !== line.key))}
                className="rounded p-1 text-ink-subtle hover:text-rose-600 disabled:opacity-30"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
            <Input className="col-span-2 sm:col-span-3" list={listId} placeholder="Item or service" aria-label="Item name" value={line.name} onChange={(e) => onName(line, e.target.value)} />
            <Input className="col-span-2 sm:col-span-3" placeholder="Description (size, material…)" aria-label="Description" value={line.description} onChange={(e) => update(line.key, { description: e.target.value })} />
            <label className="text-xs text-ink-subtle">
              Qty
              <Input inputMode="decimal" value={line.quantity} onChange={(e) => update(line.key, { quantity: e.target.value })} />
            </label>
            <label className="text-xs text-ink-subtle">
              Unit
              <Input value={line.unit} onChange={(e) => update(line.key, { unit: e.target.value })} />
            </label>
            <label className="text-xs text-ink-subtle">
              Unit price
              <Input inputMode="decimal" value={line.price} onChange={(e) => update(line.key, { price: e.target.value })} />
            </label>
            {withTax && (
              <>
                <label className="text-xs text-ink-subtle">
                  Discount
                  <Input inputMode="decimal" placeholder="0" value={line.discount} onChange={(e) => update(line.key, { discount: e.target.value })} />
                </label>
                <label className="text-xs text-ink-subtle">
                  VAT %
                  <Input inputMode="decimal" value={line.vatPercent} onChange={(e) => update(line.key, { vatPercent: e.target.value })} />
                </label>
              </>
            )}
          </div>
        </div>
      ))}

      <Button variant="secondary" icon={Plus} onClick={() => onChange([...lines, newLine()])} className="w-full sm:w-auto">
        Add line
      </Button>
    </div>
  );
}
