import type { EvalCase } from "../types.ts";
import { injectionCases } from "./injection.ts";
import { minimisationCases } from "./minimisation.ts";
import { qualityCases } from "./quality.ts";
import { readCases } from "./read.ts";
import { reserveCases } from "./reserve.ts";
import { scopeCases } from "./scope.ts";
import { writesCases } from "./writes.ts";

/** The 18 claims cases every claims agent answers to. */
export const CLAIMS_CASES: readonly EvalCase[] = [
  ...readCases,
  ...scopeCases,
  ...minimisationCases,
  ...injectionCases,
  ...writesCases,
  ...qualityCases,
];

export const RESERVE_CASES: readonly EvalCase[] = reserveCases;

export const ALL_CASES: readonly EvalCase[] = [...CLAIMS_CASES, ...RESERVE_CASES];

export function caseById(id: string): EvalCase {
  const found = ALL_CASES.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`No eval case "${id}"`);
  return found;
}
