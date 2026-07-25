export type GoldenCase = {
  id: string;
  prompt: string;
  phase?: number; // minimum phase required (cases 12-13 need Phase 2)
  setup?: { requires_tables?: string[]; induce_error?: string };
  assert: {
    tools_called?: { name: string; min?: number; max?: number }[];
    tool_order?: string[][];
    asked_user?: boolean;
    gate_fired?: string | null;
    retries?: { max: number };
    latency_budget_ms?: number;
    answer_must_mention?: string[];
    answer_must_not_mention?: string[];
  };
};

export type TraceRecord = {
  case_id: string;
  pass: boolean;
  reason?: string;
  latency_ms: number;
  retries: number;
  tools_called: string[];
  gate_fired: string | null;
  asked_user: boolean;
  answer: string;
  raw_envelopes?: any[];
};
