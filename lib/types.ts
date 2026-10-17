export const PERSONA_IDS = ["sergeant", "grandma", "chef", "bestie"] as const;
export type PersonaId = (typeof PERSONA_IDS)[number];

export const CATEGORY_IDS = ["food", "shopping", "fun", "travel", "bills"] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

export interface Category {
  id: CategoryId;
  label: string;
  limit: number;
  spent: number;
}

export interface Budget {
  name: string;
  monthlyIncome: number;
  daysLeftInMonth: number;
  checking: number;
  upcomingBills: number;
  categories: Category[];
}

export interface Persona {
  id: PersonaId;
  name: string;
  emoji: string;
  vibe: string;
  rules: string;
  voiceId: string;
  fishVoiceId?: string;
  browserVoice: { pitch: number; rate: number };
}

export interface Turn {
  role: "user" | "assistant";
  text: string;
}

export type Verdict = "yes" | "no" | "tight" | "info";

export interface AskRequest {
  text: string;
  persona: PersonaId;
  history: Turn[];
}

export interface AskResponse {
  verdict: Verdict;
  item: string | null;
  amount: number | null;
  category: CategoryId | null;
  remainingAfter: number | null;
  line: string;
  source: "claude" | "mock";
}

export const LIMITS = { textMax: 300, speakMax: 400, historyMax: 6 } as const;
