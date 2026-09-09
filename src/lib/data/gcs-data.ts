// --- GCS Browser data ---
export const BUCKETS = [
  "America_sessions",
  "Asia_sessions",
  "Europe_sessions",
  "budgets2025",
  "budgets2026",
  "Test_bucket",
  "sales_information",
  "sales_team_coordination",
];

export const BUCKET_FILES: Record<string, { folder: string; files: string[] }> = {
  Test_bucket: {
    folder: "cusotmer_feedbacks",
    files: [
      "customer_feedbacks_logs.txt",
      "customer_feedbacks_logs_Q1.txt",
      "customer_feedbacks_logs_Q2.txt",
      "customer_feedbacks_logs_Q3.txt",
    ],
  },
};
