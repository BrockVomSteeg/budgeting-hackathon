import type { Budget } from "@/lib/types";

// Fake demo data, tuned so DEMO.md lines land: coffee = yes, jacket = no, PS6 = no.
export const demoBudget: Budget = {
  name: "Maya",
  monthlyIncome: 6200,
  daysLeftInMonth: 14,
  checking: 2350,
  upcomingBills: 900,
  categories: [
    { id: "food", label: "Food & coffee", limit: 600, spent: 458 },
    { id: "shopping", label: "Shopping", limit: 300, spent: 210 },
    { id: "fun", label: "Fun & games", limit: 250, spent: 190 },
    { id: "travel", label: "Travel", limit: 400, spent: 0 },
    { id: "bills", label: "Bills", limit: 1800, spent: 1800 },
  ],
};
