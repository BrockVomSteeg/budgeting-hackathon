"use client";

import { useEffect, useState } from "react";
import { demoLedger } from "@/data/budget";
import type { Ledger } from "@/lib/ledger";

const KEY = "ciai-ledger-v1";

function load(): Ledger {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const l = JSON.parse(raw) as Ledger;
      if (Array.isArray(l.transactions) && Array.isArray(l.categories) && Array.isArray(l.recurrings)) return l;
    }
  } catch {
    // corrupt or blocked storage: start from the demo
  }
  return demoLedger;
}

/** The user's money data, kept on the phone. Client-only: render it after mount. */
export function useLedger() {
  const [ledger, setLedger] = useState<Ledger>(load);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(ledger));
    } catch {
      // private mode: changes last until reload
    }
  }, [ledger]);
  return [ledger, setLedger] as const;
}
