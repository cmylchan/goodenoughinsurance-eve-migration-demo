"use client";

import { cn } from "@/lib/utils";
import type { ComponentProps, ReactNode } from "react";
import { isValidElement } from "react";

import { DataView } from "./data-view";

export type BashToolContentProps = ComponentProps<"div"> & {
  input: unknown;
  output: unknown;
  errorText: string | undefined;
};

export const BashToolContent = ({
  className,
  input,
  output,
  errorText,
  ...props
}: BashToolContentProps) => {
  const command = getRecordValue(input, "command");
  const stdout = getRecordValue(output, "stdout") ?? (typeof output === "string" ? output : "");
  const stderr = getRecordValue(output, "stderr") ?? errorText ?? "";
  const exitCode = getRecordValue(output, "exitCode");
  const hasResult = Boolean(stdout || stderr || (typeof exitCode === "number" && exitCode !== 0));

  return (
    <div className={cn("space-y-2", className)} {...props}>
      <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-muted/50 p-3 font-mono text-xs leading-relaxed">
        <code>
          <span className="text-muted-foreground">$ </span>
          {command ?? "…"}
        </code>
      </pre>
      {hasResult ? (
        <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-muted/50 p-3 font-mono text-xs leading-relaxed">
          <code>
            <span className="mb-2 block font-sans text-[10px] text-muted-foreground uppercase tracking-wide">
              Output
            </span>
            {stdout ? <span className="block">{String(stdout).trimEnd()}</span> : null}
            {stderr ? (
              <span className="block text-destructive">{String(stderr).trimEnd()}</span>
            ) : null}
            {typeof exitCode === "number" && exitCode !== 0 ? (
              <span className="block text-muted-foreground">Exited with code {exitCode}</span>
            ) : null}
          </code>
        </pre>
      ) : null}
    </div>
  );
};

const getRecordValue = (value: unknown, key: string): string | number | undefined => {
  if (typeof value !== "object" || value === null || !(key in value)) {
    return undefined;
  }

  const property = value[key as keyof typeof value];
  return typeof property === "string" || typeof property === "number" ? property : undefined;
};

export type ToolInputProps = ComponentProps<"div"> & {
  input: unknown;
};

export const ToolInput = ({ className, input, ...props }: ToolInputProps) => {
  // A call with no arguments has nothing to show.
  if (input === undefined || input === null || (typeof input === "object" && Object.keys(input).length === 0)) {
    return null;
  }
  return (
    <div className={cn("overflow-hidden rounded-md bg-muted/50 p-3", className)} {...props}>
      <span className="mb-2 block font-sans text-[10px] text-muted-foreground uppercase tracking-wide">Parameters</span>
      <DataView raw={false} value={input} />
    </div>
  );
};

export type ToolOutputProps = ComponentProps<"div"> & {
  output: unknown;
  errorText: string | undefined;
};

export const ToolOutput = ({ className, output, errorText, ...props }: ToolOutputProps) => {
  if (!(output || errorText)) {
    return null;
  }

  // Tool results are data: tables for lists of records, label/value rows for one record.
  const Output = isValidElement(output) ? (output as ReactNode) : output === undefined ? null : <DataView value={output} />;

  return (
    <div
      className={cn(
        "rounded-md p-3 text-xs",
        errorText ? "bg-destructive/10 text-destructive" : "bg-muted/50 text-foreground",
        className,
      )}
      {...props}
    >
      <span className="mb-2 block font-sans text-[10px] text-muted-foreground uppercase tracking-wide">
        {errorText ? "Error" : "Result"}
      </span>
      {errorText && <div className="pb-2">{errorText}</div>}
      {Output}
    </div>
  );
};
