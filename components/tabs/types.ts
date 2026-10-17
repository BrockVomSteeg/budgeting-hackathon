export const TABS = ["dashboard", "categories", "transactions", "recurrings", "plan"] as const;
export type Tab = (typeof TABS)[number];
export const TAB_LABEL: Record<Tab, string> = {
  dashboard: "Dashboard",
  categories: "Categories",
  transactions: "Transactions",
  recurrings: "Recurrings",
  plan: "Plan",
};
