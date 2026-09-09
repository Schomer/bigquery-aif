import * as React from "react";
import {
  ActionBar,
  ActionBarTitle,
  ActionBarEnd,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Tag,
  SuggestionChip,
  MaterialSymbols,
  HelpButton,
} from "@/kit";

export interface SkillsScreenProps {
  activeProject?: string;
  onJump?: (prompt: string) => void;
}

interface AgentTool {
  name: string;
  category: string;
  description: string;
  parameters: string[];
  testPrompt: string;
  isDestructive?: boolean;
}

export function SkillsScreen({ activeProject = "streamify-prod", onJump }: SkillsScreenProps) {
  const [filter, setFilter] = React.useState("");

  const tools: AgentTool[] = [
    {
      name: "run_query",
      category: "Analytics",
      description: "Executes analytical SQL queries against BigQuery datasets with dry-run cost estimation and automatic type coercion.",
      parameters: ["sql", "task_intent", "visualization_hint", "result_title"],
      testPrompt: "Show top 10 customers by total spend this month",
    },
    {
      name: "get_schema",
      category: "Catalog & Schema",
      description: "Inspects dataset schemas, table field definitions, partition metadata, and fuzzy-matches table names.",
      parameters: ["dataset", "table", "project"],
      testPrompt: "Show schema and columns for the ecommerce orders table",
    },
    {
      name: "plan_analysis",
      category: "Reasoning & Planning",
      description: "Decomposes complex, ambiguous, or multi-step questions into a structured verifiable plan with feedback gates.",
      parameters: ["goal", "steps", "hypotheses", "required_data"],
      testPrompt: "Plan an in-depth churn analysis investigating why customers cancel after 30 days",
    },
    {
      name: "execute_dml",
      category: "Data Management",
      description: "Executes data-modifying operations (INSERT, UPDATE, DELETE, MERGE, DROP) with mandatory user confirmation cards.",
      parameters: ["sql", "operation_type", "affected_table"],
      testPrompt: "Clean up duplicate rows in user_session_staging table",
      isDestructive: true,
    },
    {
      name: "list_resources",
      category: "Discovery",
      description: "Lists all datasets, tables, models, and semantic graphs within the active GCP project.",
      parameters: ["scope", "filter", "project"],
      testPrompt: "List all datasets and tables in this project",
    },
    {
      name: "export_data",
      category: "Export & Sharing",
      description: "Exports BigQuery query results to Google Sheets, CSV downloads, or Cloud Storage buckets.",
      parameters: ["destination", "format", "query_or_table"],
      testPrompt: "Export the monthly sales summary to Google Sheets",
    },
    {
      name: "dataform_pipeline",
      category: "Pipelines",
      description: "Inspects Dataform repository compilations, releases, and workflow execution states.",
      parameters: ["action", "repository", "environment"],
      testPrompt: "Check Dataform compilation and verify data transformations",
    },
    {
      name: "load_csv",
      category: "Ingestion",
      description: "Performs multipart CSV parsing, schema auto-detection, and table creation in BigQuery.",
      parameters: ["target_dataset", "target_table", "csv_content"],
      testPrompt: "Upload a CSV file and create a new BigQuery table",
    },
  ];

  const filteredTools = tools.filter(
    (t) =>
      t.name.toLowerCase().includes(filter.toLowerCase()) ||
      t.category.toLowerCase().includes(filter.toLowerCase()) ||
      t.description.toLowerCase().includes(filter.toLowerCase())
  );

  const handleTriggerPrompt = (prompt: string) => {
    if (onJump) {
      onJump(prompt);
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-auto bg-cm-surface">
      {/* Top Action Bar */}
      <ActionBar>
        <ActionBarTitle
          status={<Tag theme="primary">gemini-3.5-flash</Tag>}
        >
          AI Agent Skills & System Tools
        </ActionBarTitle>
        <ActionBarEnd>
          <HelpButton title="Agent Skills Architecture">
            Autonomous BigQuery tools equipped to the Gemini agent loop. Tools are dynamically invoked to satisfy user intent without brittle keywords.
          </HelpButton>
        </ActionBarEnd>
      </ActionBar>

      {/* Main Content */}
      <div className="flex flex-1 flex-col gap-6 p-6 overflow-y-auto">
        {/* Model Invariant Banner Card */}
        <Card className="p-6 bg-cm-surface-variant">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-cm-primary/10 text-cm-primary">
                <MaterialSymbols.AutoAwesome className="size-6" />
              </div>
              <div>
                <h3 className="text-cm-title-small text-cm-on-surface">
                  Gemini Agent Loop Architecture
                </h3>
                <p className="text-cm-body-medium text-cm-on-surface-variant">
                  Standardized on <span className="font-mono text-cm-code text-cm-on-surface font-semibold">gemini-3.5-flash</span> via Firebase AI Logic SDK. Multimodal function-calling with autonomous step reflection.
                </p>
              </div>
            </div>
            <Tag theme="success">Ready</Tag>
          </div>
        </Card>

        {/* Suggestion Chips */}
        <div className="flex flex-col gap-2">
          <div className="text-cm-label-small text-cm-on-surface-variant uppercase tracking-wider">
            Test Skill Prompts
          </div>
          <div className="flex flex-wrap gap-2">
            <SuggestionChip
              icon={<MaterialSymbols.AutoAwesome className="size-4" />}
              onClick={() =>
                handleTriggerPrompt("Plan an in-depth churn analysis investigating why customers cancel after 30 days")
              }
            >
              Multi-step analytical plan
            </SuggestionChip>
            <SuggestionChip
              icon={<MaterialSymbols.Search className="size-4" />}
              onClick={() =>
                handleTriggerPrompt("Dry-run an analytical query computing monthly cohort retention rates")
              }
            >
              Dry-run cohort SQL
            </SuggestionChip>
            <SuggestionChip
              icon={<MaterialSymbols.Download className="size-4" />}
              onClick={() =>
                handleTriggerPrompt("Export the top 100 customer records to a new Google Sheet")
              }
            >
              Export to Google Sheets
            </SuggestionChip>
            <SuggestionChip
              icon={<MaterialSymbols.Extension className="size-4" />}
              onClick={() =>
                handleTriggerPrompt("Show daily revenue by product category with an interactive date filter dropdown")
              }
            >
              Interactive data widget
            </SuggestionChip>
          </div>
        </div>

        {/* Search Input */}
        <div className="w-full max-w-md relative">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search agent tools by name or capability..."
            className="w-full h-8 pl-8 pr-3 rounded-lg border border-cm-hairline bg-cm-surface text-cm-body-medium text-cm-on-surface focus:outline-none focus:ring-2 focus:ring-cm-outline-focus/50"
          />
          <MaterialSymbols.Search className="size-4 text-cm-on-surface-variant absolute left-2.5 top-2 pointer-events-none" />
        </div>

        {/* Tools Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTools.map((tool) => (
            <Card key={tool.name} className="p-5 bg-cm-surface-variant flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-cm-code text-cm-primary font-semibold">
                    {tool.name}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {tool.isDestructive && (
                      <Tag theme="danger-soft">Gated</Tag>
                    )}
                    <Tag theme="default">{tool.category}</Tag>
                  </div>
                </div>

                <p className="text-cm-body-small text-cm-on-surface-variant mb-4">
                  {tool.description}
                </p>

                <div className="mb-4">
                  <span className="text-cm-label-small text-cm-on-surface-variant uppercase tracking-wider block mb-1.5">
                    Parameters:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {tool.parameters.map((p) => (
                      <span
                        key={p}
                        className="px-2 py-0.5 rounded bg-cm-surface text-cm-on-surface text-[11px] font-mono border border-cm-hairline"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-cm-hairline">
                <Button
                  variant="stroked"
                  className="w-full"
                  leftIcon={<MaterialSymbols.AutoAwesome className="size-4" />}
                  onClick={() => handleTriggerPrompt(tool.testPrompt)}
                >
                  Test in Chat
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
