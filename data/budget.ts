import type { Budget } from "../lib/types";
import budget from "./budget.json" with { type: "json" };

// Fake demo data lives in budget.json, tuned so DEMO.md lines land: coffee = yes, jacket = no, PS6 = no.
export const demoBudget: Budget = budget as Budget;
