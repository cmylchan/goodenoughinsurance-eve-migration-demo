"use client";

// Renders data an agent's tool returned as something a person can read at a glance: a list of
// records becomes a table, a single record becomes label/value rows, and nested lists get their
// own titled table. The raw JSON stays one click away for anyone debugging.
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

import { CodeBlock } from "./code-block";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Row = Record<string, unknown>;

const MAX_DEPTH = 3;

const isRecord = (value: unknown): value is Row => typeof value === "object" && value !== null && !Array.isArray(value);
const isScalar = (value: unknown) => value === null || value === undefined || typeof value !== "object";
const isTable = (value: unknown): value is Row[] => Array.isArray(value) && value.length > 0 && value.every(isRecord);

/** Tool output may arrive as a JSON string; anything that doesn't parse stays text. */
function parse(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return value;
  try {
    return JSON.parse(trimmed) as Json;
  } catch {
    return value;
  }
}

const ACRONYMS: Record<string, string> = { id: "ID", ids: "IDs", url: "URL", api: "API", db: "DB", ref: "Ref", hld: "HLD" };

/** claim_id → "Claim ID", reserveAmount → "Reserve amount". */
export function labelFor(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((word) => ACRONYMS[word.toLowerCase()] ?? word.toLowerCase());
  const [first = key, ...rest] = words;
  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(" ");
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}(?::?\d{2})?)?)?$/;
const MONEY_KEY = /(amount|reserve|price|total|cost|paid|balance)(?!_?band)/i;
const STATUS_KEY = /^(status|state|outcome|decision|verdict|result)$/i;
// Identifiers and years read as written: policy 1042, not 1,042.
const ID_KEY = /(^|_)(id|ids|no|number|ref|year|code)$|[a-z](Id|Ids|Number|Ref)$/;

/** pending_review → "Pending review". Only for short machine codes, never free text. */
const humanizeCode = (value: string) =>
  /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/.test(value) ? `${value.charAt(0).toUpperCase()}${value.slice(1).replaceAll("_", " ")}` : value;

// UTC so the server and every viewer render the same text.
const dateOnly = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });
const dateTime = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const number = new Intl.NumberFormat("en-US");

/** A cell's text: dates, money and counts in the form people read them. */
export function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    if (ID_KEY.test(key)) return String(value);
    return MONEY_KEY.test(key) ? money.format(value) : number.format(value);
  }
  if (typeof value === "string") {
    if (ISO_DATE.test(value)) {
      const date = new Date(value.replace(" ", "T"));
      if (!Number.isNaN(date.getTime())) return value.length <= 10 ? dateOnly.format(date) : `${dateTime.format(date)} UTC`;
    }
    if (MONEY_KEY.test(key) && /^-?\d+(\.\d+)?$/.test(value)) return money.format(Number(value));
    return value;
  }
  if (Array.isArray(value) && value.every(isScalar)) return value.map((item) => formatValue(key, item)).join(", ");
  return JSON.stringify(value);
}

function Cell({ name, value }: { readonly name: string; readonly value: unknown }) {
  const status = STATUS_KEY.test(name) && typeof value === "string" && value !== "";
  const text = status ? humanizeCode(formatValue(name, value)) : formatValue(name, value);
  if (status) {
    return (
      <span className="inline-flex rounded-full bg-accent px-2 py-0.5 font-medium text-accent-foreground text-xs">{text}</span>
    );
  }
  const numeric = typeof value === "number" || (MONEY_KEY.test(name) && text.startsWith("$"));
  return <span className={cn(numeric && "tabular-nums", text === "—" && "text-muted-foreground")}>{text}</span>;
}

function columnsOf(rows: readonly Row[]): string[] {
  const seen = new Set<string>();
  for (const row of rows) for (const key of Object.keys(row)) seen.add(key);
  return [...seen];
}

function DataTable({ rows, depth }: { readonly rows: readonly Row[]; readonly depth: number }) {
  const columns = columnsOf(rows);
  return (
    <div className="overflow-x-auto rounded-md border border-border bg-background">
      <table className="w-max min-w-full border-collapse text-left text-xs [&_td]:max-w-72">
        <thead className="bg-muted">
          <tr>
            {columns.map((column) => (
              <th className="whitespace-nowrap px-3 py-2 font-medium text-muted-foreground" key={column} scope="col">
                {labelFor(column)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            // Records have no guaranteed id field, and the list never reorders.
            <tr className="border-border border-t align-top" key={index}>
              {columns.map((column) => (
                <td className="px-3 py-2" key={column}>
                  {isScalar(row[column]) || (Array.isArray(row[column]) && (row[column] as unknown[]).every(isScalar)) ? (
                    <Cell name={column} value={row[column]} />
                  ) : (
                    <DataNode depth={depth + 1} value={row[column]} />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Fields({ entries }: { readonly entries: readonly [string, unknown][] }) {
  return (
    <dl className="grid grid-cols-[minmax(6rem,auto)_1fr] gap-x-4 gap-y-1.5 rounded-md border border-border bg-background px-3 py-2.5 text-xs">
      {entries.map(([key, value]) => (
        <div className="contents" key={key}>
          <dt className="text-muted-foreground">{labelFor(key)}</dt>
          <dd className="min-w-0 break-words">
            <Cell name={key} value={value} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Section({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h4 className="font-medium text-foreground text-xs">{title}</h4>
      {children}
    </section>
  );
}

function DataNode({ value, depth }: { readonly value: unknown; readonly depth: number }): ReactNode {
  if (depth > MAX_DEPTH) return <code className="break-all font-mono text-[11px]">{JSON.stringify(value)}</code>;
  if (isTable(value)) return <DataTable depth={depth} rows={value} />;
  if (Array.isArray(value)) {
    if (value.length === 0) return <p className="text-muted-foreground text-xs">No records.</p>;
    if (value.every(isScalar)) {
      return (
        <ul className="list-disc space-y-0.5 pl-5 text-xs">
          {value.map((item, index) => (
            <li key={index}>{formatValue("", item)}</li>
          ))}
        </ul>
      );
    }
    return <code className="break-all font-mono text-[11px]">{JSON.stringify(value)}</code>;
  }
  if (isRecord(value)) {
    const entries = Object.entries(value);
    const scalars = entries.filter(([, item]) => isScalar(item) || (Array.isArray(item) && item.every(isScalar)));
    const nested = entries.filter(([, item]) => !(isScalar(item) || (Array.isArray(item) && item.every(isScalar))));
    return (
      <div className="space-y-3">
        {scalars.length > 0 ? <Fields entries={scalars} /> : null}
        {nested.map(([key, item]) => (
          <Section key={key} title={labelFor(key)}>
            <DataNode depth={depth + 1} value={item} />
          </Section>
        ))}
      </div>
    );
  }
  return <p className="whitespace-pre-wrap break-words text-xs">{formatValue("", value)}</p>;
}

export type DataViewProps = {
  readonly value: unknown;
  readonly className?: string;
  /** Show a collapsed raw-JSON view under the formatted one. */
  readonly raw?: boolean;
};

/** Formatted view of a tool's input or output. Plain text stays plain text. */
export function DataView({ value, className, raw = true }: DataViewProps) {
  const data = parse(value);
  const structured = typeof data === "object" && data !== null;
  return (
    <div className={cn("space-y-2", className)}>
      <DataNode depth={0} value={data} />
      {raw && structured ? (
        <details className="group text-xs">
          <summary className="cursor-pointer select-none text-muted-foreground hover:text-foreground">Raw JSON</summary>
          <CodeBlock
            className="mt-1.5 rounded-md border-0 bg-background [&_code]:text-xs [&_pre]:!bg-transparent [&_pre]:p-3 [&_pre]:text-xs"
            code={JSON.stringify(data, null, 2)}
            language="json"
          />
        </details>
      ) : null}
    </div>
  );
}
