import type { Budget } from "../lib/types";
import { toBudget, type Ledger } from "../lib/ledger.ts";
import ledger from "./budget.json" with { type: "json" };

// Fake demo data lives in budget.json, tuned so DEMO.md lines land: coffee = yes, jacket = no, PS6 = no.
export const demoLedger: Ledger = ledger as Ledger;
export const demoBudget: Budget = toBudget(demoLedger);
