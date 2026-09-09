import * as React from "react";
import {
  ActionBar,
  ActionBarTitle,
  ActionBarEnd,
  Button,
  Card,
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
  Progress,
} from "@/kit";

export interface InfrastructureScreenProps {
  activeProject?: string;
  onJump?: (prompt: string) => void;
}

interface ReservationItem {
  id: string;
  name: string;
  edition: string;
  baselineSlots: number;
  maxSlots: number;
  assignments: string;
  location: string;
  status: "active" | "idle";
}

export function InfrastructureScreen({ activeProject = "streamify-prod", onJump }: InfrastructureScreenProps) {
  const reservations: ReservationItem[] = [
    {
      id: "res-1",
      name: "prod_interactive_analytics",
      edition: "Enterprise",
      baselineSlots: 150,
      maxSlots: 400,
      assignments: "streamify-prod (Interactive queries)",
      location: "us-central1",
      status: "active",
    },
    {
      id: "res-2",
      name: "batch_etl_pipeline",
      edition: "Enterprise",
      baselineSlots: 100,
      maxSlots: 250,
      assignments: "streamify-prod (Scheduled / Batch)",
      location: "us-central1",
      status: "active",
    },
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
          status={<Tag theme="primary">Enterprise Edition</Tag>}
        >
          Infrastructure & Capacity
        </ActionBarTitle>
        <Button
          leftIcon={<MaterialSymbols.DashboardCustomize className="size-4" />}
          onClick={() =>
            handleTriggerPrompt("Recommend optimal BigQuery slot reservations and capacity configuration")
          }
        >
          Optimize Capacity
        </Button>
        <Button
          variant="stroked"
          leftIcon={<MaterialSymbols.Refresh className="size-4" />}
          onClick={() => {}}
        >
          Refresh
        </Button>
        <ActionBarEnd>
          <HelpButton title="BigQuery Infrastructure & Capacity Help">
            Manage BigQuery slot commitments, autoscale reservations, storage billing models (physical vs logical), and resource quota limits.
          </HelpButton>
        </ActionBarEnd>
      </ActionBar>

      {/* Main Content */}
      <div className="flex flex-1 flex-col gap-6 p-6 overflow-y-auto">
        {/* Capacity Scorecards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 bg-cm-surface-variant flex flex-col justify-between">
            <span className="text-cm-label-small text-cm-on-surface-variant uppercase tracking-wider">
              BigQuery Edition
            </span>
            <div className="mt-2">
              <span className="text-cm-headline-medium text-cm-on-surface font-normal font-sans">
                Enterprise
              </span>
              <p className="text-cm-body-small text-cm-status-success mt-0.5">
                Autoscaling enabled
              </p>
            </div>
          </Card>

          <Card className="p-4 bg-cm-surface-variant flex flex-col justify-between">
            <span className="text-cm-label-small text-cm-on-surface-variant uppercase tracking-wider">
              Total Baseline Slots
            </span>
            <div className="mt-2">
              <span className="text-cm-headline-medium text-cm-on-surface font-normal font-sans">
                250
              </span>
              <p className="text-cm-body-small text-cm-on-surface-variant mt-0.5">
                Max autoscale: 650 slots
              </p>
            </div>
          </Card>

          <Card className="p-4 bg-cm-surface-variant flex flex-col justify-between">
            <span className="text-cm-label-small text-cm-on-surface-variant uppercase tracking-wider">
              Storage Billing Model
            </span>
            <div className="mt-2">
              <span className="text-cm-headline-medium text-cm-status-success font-normal font-sans">
                Physical
              </span>
              <p className="text-cm-body-small text-cm-on-surface-variant mt-0.5">
                ~48% compression savings
              </p>
            </div>
          </Card>

          <Card className="p-4 bg-cm-surface-variant flex flex-col justify-between">
            <span className="text-cm-label-small text-cm-on-surface-variant uppercase tracking-wider">
              Daily Slot Quota
            </span>
            <div className="mt-2">
              <div className="flex items-center justify-between text-cm-body-small mb-1">
                <span>Utilization</span>
                <span className="font-medium">38%</span>
              </div>
              <Progress value={38} />
              <p className="text-cm-body-small text-cm-status-success mt-1.5">
                Well within quota limits
              </p>
            </div>
          </Card>
        </div>

        {/* Suggestion Chips */}
        <div className="flex flex-col gap-2">
          <div className="text-cm-label-small text-cm-on-surface-variant uppercase tracking-wider">
            Capacity & Cost Prompts
          </div>
          <div className="flex flex-wrap gap-2">
            <SuggestionChip
              icon={<MaterialSymbols.QueryStats className="size-4" />}
              onClick={() =>
                handleTriggerPrompt("Compare costs between physical and logical storage billing across all datasets in this project")
              }
            >
              Compare physical vs logical storage cost
            </SuggestionChip>
            <SuggestionChip
              icon={<MaterialSymbols.Monitoring className="size-4" />}
              onClick={() =>
                handleTriggerPrompt("Analyze BigQuery slot reservation utilization and identify periods of slot starvation")
              }
            >
              Analyze slot utilization
            </SuggestionChip>
            <SuggestionChip
              icon={<MaterialSymbols.DashboardCustomize className="size-4" />}
              onClick={() =>
                handleTriggerPrompt("Recommend partitioning and clustering optimization to reduce data scan volume")
              }
            >
              Scan reduction recommendations
            </SuggestionChip>
            <SuggestionChip
              icon={<MaterialSymbols.Delete className="size-4" />}
              onClick={() =>
                handleTriggerPrompt("Find tables without partition expiration policies and estimate storage savings")
              }
            >
              Check partition expiration policies
            </SuggestionChip>
          </div>
        </div>

        {/* Reservations Table */}
        <TableFrame>
          <TableTitleBar>
            <TableTitle>Slot Reservations & Assignments</TableTitle>
          </TableTitleBar>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reservation Name</TableHead>
                <TableHead>Edition</TableHead>
                <TableHead>Baseline Slots</TableHead>
                <TableHead>Max Autoscale</TableHead>
                <TableHead>Assigned Workload</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reservations.map((res) => (
                <TableRow key={res.id}>
                  <TableCell className="font-medium text-cm-on-surface">
                    {res.name}
                  </TableCell>
                  <TableCell>
                    <Tag theme="primary">{res.edition}</Tag>
                  </TableCell>
                  <TableCell className="font-mono text-cm-code text-cm-on-surface">
                    {res.baselineSlots}
                  </TableCell>
                  <TableCell className="font-mono text-cm-code text-cm-on-surface">
                    {res.maxSlots}
                  </TableCell>
                  <TableCell className="text-cm-body-small text-cm-on-surface-variant">
                    {res.assignments}
                  </TableCell>
                  <TableCell className="text-cm-body-small text-cm-on-surface">
                    {res.location}
                  </TableCell>
                  <TableCell>
                    <Tag theme="success">Active</Tag>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="stroked"
                      onClick={() =>
                        handleTriggerPrompt(`Inspect performance and slot utilization for reservation "${res.name}"`)
                      }
                    >
                      Analyze
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableFrame>
      </div>
    </div>
  );
}
