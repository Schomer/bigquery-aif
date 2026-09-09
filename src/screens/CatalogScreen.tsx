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
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  TableFrame,
  TableTitleBar,
  TableTitle,
  Tag,
  SuggestionChip,
  MaterialSymbols,
  HelpButton,
  EmptyState,
  EmptyStateTitle,
  EmptyStateBody,
} from "@/kit";
import { listAllDatasets, listTables } from "@/lib/bigquery-client";
import { BQ_TREE_DATA } from "@/lib/data/bigquery-data";

export interface CatalogScreenProps {
  activeProject?: string;
  onJump?: (prompt: string) => void;
}

interface DatasetItem {
  id: string;
  name: string;
  location?: string;
  tablesCount?: number;
}

interface TableItem {
  id: string;
  name: string;
  datasetId: string;
  type: string;
  numRows?: string;
  numBytes?: string;
}

interface ColumnSchema {
  name: string;
  type: string;
  mode: string;
  description?: string;
}

export function CatalogScreen({ activeProject = "streamify-prod", onJump }: CatalogScreenProps) {
  const [datasets, setDatasets] = React.useState<DatasetItem[]>([]);
  const [selectedDataset, setSelectedDataset] = React.useState<string | null>(null);
  const [tables, setTables] = React.useState<TableItem[]>([]);
  const [selectedTable, setSelectedTable] = React.useState<TableItem | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [loadingDatasets, setLoadingDatasets] = React.useState(false);
  const [loadingTables, setLoadingTables] = React.useState(false);

  // Load datasets on project change
  React.useEffect(() => {
    let mounted = true;
    async function loadData() {
      setLoadingDatasets(true);
      try {
        if (activeProject) {
          const apiDatasets = await listAllDatasets(activeProject);
          if (mounted && apiDatasets.length > 0) {
            setDatasets(apiDatasets.map((d) => ({
              id: d.datasetId,
              name: d.datasetId,
              location: d.location || "US",
            })));
            setSelectedDataset(apiDatasets[0].datasetId);
            return;
          }
        }
      } catch {
        // Fallback to reference mock tree
      }

      if (mounted) {
        const fallback = (BQ_TREE_DATA.children || []).map((c) => ({
          id: c.id,
          name: c.label,
          location: "US",
          tablesCount: c.children?.length || 0,
        }));
        setDatasets(fallback);
        if (fallback.length > 0) {
          setSelectedDataset(fallback[0].id);
        }
      }
      setLoadingDatasets(false);
    }
    loadData();
    return () => {
      mounted = false;
    };
  }, [activeProject]);

  // Load tables when dataset changes
  React.useEffect(() => {
    if (!selectedDataset) {
      setTables([]);
      setSelectedTable(null);
      return;
    }
    let mounted = true;
    async function loadTableList() {
      setLoadingTables(true);
      try {
        if (activeProject && selectedDataset) {
          const apiTables = await listTables(activeProject, selectedDataset);
          if (mounted && apiTables.length > 0) {
            const mapped = apiTables.map((t) => ({
              id: t.tableId,
              name: t.tableId,
              datasetId: selectedDataset,
              type: t.type || "TABLE",
              numRows: t.numRows,
              numBytes: t.numBytes,
            }));
            setTables(mapped);
            setSelectedTable(mapped[0]);
            setLoadingTables(false);
            return;
          }
        }
      } catch {
        // Fallback to reference mock
      }

      if (mounted && selectedDataset) {
        const found = (BQ_TREE_DATA.children || []).find((d) => d.id === selectedDataset);
        const fallbackTables = (found?.children || []).map((t) => ({
          id: t.id,
          name: t.label,
          datasetId: selectedDataset,
          type: t.type === "model" ? "MODEL" : t.type === "graph" ? "GRAPH" : "TABLE",
          numRows: "1,248,500",
          numBytes: "184.2 MB",
        }));
        setTables(fallbackTables);
        setSelectedTable(fallbackTables[0] || null);
        setLoadingTables(false);
      }
    }
    loadTableList();
    return () => {
      mounted = false;
    };
  }, [activeProject, selectedDataset]);

  const filteredDatasets = datasets.filter((d) =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sampleColumns: ColumnSchema[] = [
    { name: "event_id", type: "STRING", mode: "REQUIRED", description: "Unique UUID for the transaction event" },
    { name: "user_id", type: "STRING", mode: "REQUIRED", description: "Customer account identifier" },
    { name: "event_timestamp", type: "TIMESTAMP", mode: "REQUIRED", description: "UTC timestamp of event arrival" },
    { name: "amount_usd", type: "NUMERIC", mode: "NULLABLE", description: "Billed gross value in USD" },
    { name: "device_type", type: "STRING", mode: "NULLABLE", description: "Client device category (iOS, Android, Web)" },
    { name: "country_code", type: "STRING", mode: "NULLABLE", description: "ISO 3166-1 alpha-2 country code" },
    { name: "is_active_subscriber", type: "BOOLEAN", mode: "NULLABLE", description: "Subscription status flag" },
  ];

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
          status={<Tag theme="primary">{datasets.length} Datasets</Tag>}
        >
          Data Catalog
        </ActionBarTitle>
        <Button
          variant="stroked"
          leftIcon={<MaterialSymbols.Refresh className="size-4" />}
          onClick={() => {
            const first = datasets[0]?.id || null;
            setSelectedDataset(first);
          }}
        >
          Refresh
        </Button>
        <ActionBarEnd>
          <HelpButton title="Data Catalog Help">
            Browse BigQuery datasets, inspect table schemas, view metadata partitions, and launch AI data analyses.
          </HelpButton>
        </ActionBarEnd>
      </ActionBar>

      {/* Main 2-column catalog view */}
      <div className="flex flex-1 overflow-hidden p-6 gap-6">
        {/* Left column: Dataset & Table tree */}
        <div className="flex w-80 flex-col gap-4 shrink-0 overflow-hidden">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter datasets..."
              className="w-full h-8 pl-8 pr-3 rounded-lg border border-cm-hairline bg-cm-surface text-cm-body-medium text-cm-on-surface focus:outline-none focus:ring-2 focus:ring-cm-outline-focus/50"
            />
            <MaterialSymbols.Search className="size-4 text-cm-on-surface-variant absolute left-2.5 top-2 pointer-events-none" />
          </div>

          <Card className="flex flex-1 flex-col overflow-hidden p-2 bg-cm-surface-variant">
            <div className="px-3 py-2 text-cm-label-small uppercase tracking-wider text-cm-on-surface-variant">
              Datasets in {activeProject || "Project"}
            </div>
            <div className="flex-1 overflow-y-auto space-y-1">
              {loadingDatasets ? (
                <div className="p-4 text-center text-cm-body-small text-cm-on-surface-variant">
                  Loading datasets...
                </div>
              ) : filteredDatasets.length === 0 ? (
                <div className="p-4 text-center text-cm-body-small text-cm-on-surface-variant">
                  No datasets found
                </div>
              ) : (
                filteredDatasets.map((ds) => {
                  const isSelected = selectedDataset === ds.id;
                  return (
                    <button
                      key={ds.id}
                      type="button"
                      onClick={() => setSelectedDataset(ds.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-cm-body-medium transition-colors ${
                        isSelected
                          ? "bg-cm-selection-container text-cm-primary font-medium"
                          : "text-cm-on-surface hover:bg-cm-surface/60"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <MaterialSymbols.Folder className="size-4 text-cm-on-surface-variant shrink-0" />
                        <span className="truncate">{ds.name}</span>
                      </div>
                      <Tag theme="default" className="text-[11px] shrink-0">
                        {ds.location || "US"}
                      </Tag>
                    </button>
                  );
                })
              )}
            </div>
          </Card>
        </div>

        {/* Right column: Tables and Schema inspector */}
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto min-w-0">
          {selectedDataset ? (
            <>
              {/* Dataset & Table header card */}
              <Card className="p-6 bg-cm-surface-variant">
                <CardHeader>
                  <div className="flex items-center justify-between w-full">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Tag theme="primary">Dataset</Tag>
                        <span className="text-cm-code text-cm-on-surface-variant">
                          `{activeProject}.{selectedDataset}`
                        </span>
                      </div>
                      <CardTitle level={3}>{selectedDataset}</CardTitle>
                      <CardDescription>
                        Explore tables, schema definitions, and initiate AI-assisted queries.
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="stroked"
                        leftIcon={<MaterialSymbols.AutoAwesome className="size-4" />}
                        onClick={() =>
                          handleTriggerPrompt(`Tell me more about the ${selectedDataset} dataset and summarize its contents`)
                        }
                      >
                        Dataset Summary
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {/* Table pill selector */}
                <div className="mt-4 pt-4 border-t border-cm-hairline flex flex-wrap items-center gap-2">
                  <span className="text-cm-label-small text-cm-on-surface-variant mr-1">Tables:</span>
                  {loadingTables ? (
                    <span className="text-cm-body-small text-cm-on-surface-variant">Loading tables...</span>
                  ) : tables.length === 0 ? (
                    <span className="text-cm-body-small text-cm-on-surface-variant">No tables in dataset</span>
                  ) : (
                    tables.map((tbl) => {
                      const isTblSelected = selectedTable?.id === tbl.id;
                      return (
                        <button
                          key={tbl.id}
                          type="button"
                          onClick={() => setSelectedTable(tbl)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-cm-body-small transition-colors ${
                            isTblSelected
                              ? "bg-cm-primary text-cm-on-primary font-medium"
                              : "bg-cm-surface border border-cm-hairline text-cm-on-surface hover:bg-cm-surface-variant"
                          }`}
                        >
                          <MaterialSymbols.Storage className="size-3.5" />
                          {tbl.name}
                        </button>
                      );
                    })
                  )}
                </div>
              </Card>

              {/* Selected table details & Schema */}
              {selectedTable && (
                <div className="flex flex-col gap-4">
                  {/* Table summary bar */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-cm-title-small text-cm-on-surface flex items-center gap-2">
                        <MaterialSymbols.Storage className="size-5 text-cm-primary" />
                        {selectedTable.name}
                        <Tag theme="default">{selectedTable.type}</Tag>
                      </h3>
                      <p className="text-cm-body-small text-cm-on-surface-variant">
                        Estimated {selectedTable.numRows || "1,248,500"} rows • {selectedTable.numBytes || "184 MB"} storage size
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="stroked"
                        leftIcon={<MaterialSymbols.Search className="size-4" />}
                        onClick={() =>
                          handleTriggerPrompt(`Show me the ${selectedDataset}.${selectedTable.name} table`)
                        }
                      >
                        Sample Table
                      </Button>
                      <Button
                        leftIcon={<MaterialSymbols.AutoAwesome className="size-4" />}
                        onClick={() =>
                          handleTriggerPrompt(`Analyze schema and generate insights for ${selectedDataset}.${selectedTable.name}`)
                        }
                      >
                        Analyze Table
                      </Button>
                    </div>
                  </div>

                  {/* Schema table frame */}
                  <TableFrame>
                    <TableTitleBar>
                      <TableTitle>Schema Definition</TableTitle>
                    </TableTitleBar>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Field Name</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Mode</TableHead>
                          <TableHead>Description</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sampleColumns.map((col) => (
                          <TableRow key={col.name}>
                            <TableCell className="font-mono font-medium text-cm-on-surface">
                              {col.name}
                            </TableCell>
                            <TableCell>
                              <Tag theme="primary" className="font-mono text-[11px]">
                                {col.type}
                              </Tag>
                            </TableCell>
                            <TableCell className="text-cm-body-small text-cm-on-surface-variant">
                              {col.mode}
                            </TableCell>
                            <TableCell className="text-cm-body-medium text-cm-on-surface">
                              {col.description || "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableFrame>

                  {/* AI Suggestion Chips */}
                  <div className="flex flex-col gap-2 pt-2">
                    <div className="text-cm-label-small text-cm-on-surface-variant uppercase tracking-wider">
                      Suggested Actions
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <SuggestionChip
                        icon={<MaterialSymbols.Search className="size-4" />}
                        onClick={() =>
                          handleTriggerPrompt(`Show me 10 sample rows from ${selectedDataset}.${selectedTable.name}`)
                        }
                      >
                        Sample 10 rows
                      </SuggestionChip>
                      <SuggestionChip
                        icon={<MaterialSymbols.TrendingUp className="size-4" />}
                        onClick={() =>
                          handleTriggerPrompt(`Analyze distribution and key metrics in ${selectedDataset}.${selectedTable.name}`)
                        }
                      >
                        Analyze metric distribution
                      </SuggestionChip>
                      <SuggestionChip
                        icon={<MaterialSymbols.CheckCircle className="size-4" />}
                        onClick={() =>
                          handleTriggerPrompt(`Check for null values and anomalies in ${selectedDataset}.${selectedTable.name}`)
                        }
                      >
                        Find nulls and anomalies
                      </SuggestionChip>
                      <SuggestionChip
                        icon={<MaterialSymbols.Monitoring className="size-4" />}
                        onClick={() =>
                          handleTriggerPrompt(`Recommend partitioning and clustering optimization for ${selectedDataset}.${selectedTable.name}`)
                        }
                      >
                        Optimization recommendations
                      </SuggestionChip>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <EmptyState>
              <EmptyStateTitle>No Dataset Selected</EmptyStateTitle>
              <EmptyStateBody>Choose a dataset from the list on the left to inspect its tables and schema.</EmptyStateBody>
            </EmptyState>
          )}
        </div>
      </div>
    </div>
  );
}
