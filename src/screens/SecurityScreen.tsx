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
} from "@/kit";

export interface SecurityScreenProps {
  activeProject?: string;
  onJump?: (prompt: string) => void;
}

interface GovernanceItem {
  id: string;
  resource: string;
  policy: string;
  scope: string;
  status: "Compliant" | "Review Required" | "Missing Mask";
  severity: "low" | "medium" | "high";
}

export function SecurityScreen({ activeProject = "streamify-prod", onJump }: SecurityScreenProps) {
  const governanceItems: GovernanceItem[] = [
    {
      id: "gov-1",
      resource: "streamify-prod.prd_gold.customers",
      policy: "PII Data Masking (email, phone)",
      scope: "Column-level policy tag (PII_Confidential)",
      status: "Compliant",
      severity: "low",
    },
    {
      id: "gov-2",
      resource: "streamify-prod.prd_gold.orders_summary",
      policy: "Row-level Security (Finance Group Only)",
      scope: "Row access filter: session_user() IN (...)",
      status: "Compliant",
      severity: "low",
    },
    {
      id: "gov-3",
      resource: "streamify-prod.prd_silver.stg_user_events",
      policy: "Authorized View Delegation",
      scope: "Dataset reader permission bypass via view",
      status: "Review Required",
      severity: "medium",
    },
    {
      id: "gov-4",
      resource: "streamify-prod.raw_logs.dk_api_logs",
      policy: "IP Address Anonymization",
      scope: "Column `client_ip` lacks masking rule",
      status: "Missing Mask",
      severity: "high",
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
          status={<Tag theme="success">Governance Active</Tag>}
        >
          Security & Governance
        </ActionBarTitle>
        <Button
          leftIcon={<MaterialSymbols.Shield className="size-4" />}
          onClick={() =>
            handleTriggerPrompt("Run a complete BigQuery security and governance compliance audit")
          }
        >
          Run Compliance Audit
        </Button>
        <Button
          variant="stroked"
          leftIcon={<MaterialSymbols.Refresh className="size-4" />}
          onClick={() => {}}
        >
          Refresh
        </Button>
        <ActionBarEnd>
          <HelpButton title="Security & Governance Help">
            Audit IAM access, manage column-level policy tags, data masking rules, row-level filters, and CMEK encryption across BigQuery data assets.
          </HelpButton>
        </ActionBarEnd>
      </ActionBar>

      {/* Main Content */}
      <div className="flex flex-1 flex-col gap-6 p-6 overflow-y-auto">
        {/* Governance Posture Scorecards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 bg-cm-surface-variant flex flex-col justify-between">
            <span className="text-cm-label-small text-cm-on-surface-variant uppercase tracking-wider">
              Public Dataset Exposure
            </span>
            <div className="mt-2">
              <span className="text-cm-headline-medium text-cm-status-success font-normal font-sans">
                0
              </span>
              <p className="text-cm-body-small text-cm-on-surface-variant mt-0.5">
                No allAuthenticatedUsers bindings
              </p>
            </div>
          </Card>

          <Card className="p-4 bg-cm-surface-variant flex flex-col justify-between">
            <span className="text-cm-label-small text-cm-on-surface-variant uppercase tracking-wider">
              Column Policy Tags
            </span>
            <div className="mt-2">
              <span className="text-cm-headline-medium text-cm-on-surface font-normal font-sans">
                14
              </span>
              <p className="text-cm-body-small text-cm-status-success mt-0.5">
                Data masking rules active
              </p>
            </div>
          </Card>

          <Card className="p-4 bg-cm-surface-variant flex flex-col justify-between">
            <span className="text-cm-label-small text-cm-on-surface-variant uppercase tracking-wider">
              Row-Level Filters
            </span>
            <div className="mt-2">
              <span className="text-cm-headline-medium text-cm-on-surface font-normal font-sans">
                8
              </span>
              <p className="text-cm-body-small text-cm-on-surface-variant mt-0.5">
                Authorized security filters
              </p>
            </div>
          </Card>

          <Card className="p-4 bg-cm-surface-variant flex flex-col justify-between">
            <span className="text-cm-label-small text-cm-on-surface-variant uppercase tracking-wider">
              CMEK Encryption
            </span>
            <div className="mt-2">
              <span className="text-cm-headline-medium text-cm-status-success font-normal font-sans">
                100%
              </span>
              <p className="text-cm-body-small text-cm-on-surface-variant mt-0.5">
                Cloud KMS protected keys
              </p>
            </div>
          </Card>
        </div>

        {/* Suggestion Chips */}
        <div className="flex flex-col gap-2">
          <div className="text-cm-label-small text-cm-on-surface-variant uppercase tracking-wider">
            AI Security Audits
          </div>
          <div className="flex flex-wrap gap-2">
            <SuggestionChip
              icon={<MaterialSymbols.Shield className="size-4" />}
              onClick={() =>
                handleTriggerPrompt("Audit all BigQuery dataset IAM permissions and flag any overly permissive roles")
              }
            >
              Audit dataset IAM permissions
            </SuggestionChip>
            <SuggestionChip
              icon={<MaterialSymbols.Shield className="size-4" />}
              onClick={() =>
                handleTriggerPrompt("List all tables with column-level policy tags and verify masking rules")
              }
            >
              Verify column data masking
            </SuggestionChip>
            <SuggestionChip
              icon={<MaterialSymbols.Shield className="size-4" />}
              onClick={() =>
                handleTriggerPrompt("Check row-level security policies on sensitive customer and finance tables")
              }
            >
              Inspect row-level security
            </SuggestionChip>
            <SuggestionChip
              icon={<MaterialSymbols.Shield className="size-4" />}
              onClick={() =>
                handleTriggerPrompt("Audit BigQuery table encryption keys and check CMEK rotation compliance")
              }
            >
              Check CMEK key compliance
            </SuggestionChip>
          </div>
        </div>

        {/* Governance Rules Table */}
        <TableFrame>
          <TableTitleBar>
            <TableTitle>Data Governance & Compliance Policies</TableTitle>
          </TableTitleBar>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Resource Identifier</TableHead>
                <TableHead>Policy Type</TableHead>
                <TableHead>Scope & Details</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {governanceItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-cm-code text-cm-on-surface font-medium">
                    {item.resource}
                  </TableCell>
                  <TableCell className="text-cm-body-small text-cm-on-surface">
                    {item.policy}
                  </TableCell>
                  <TableCell className="text-cm-body-small text-cm-on-surface-variant">
                    {item.scope}
                  </TableCell>
                  <TableCell>
                    {item.status === "Compliant" && (
                      <Tag theme="success">Compliant</Tag>
                    )}
                    {item.status === "Review Required" && (
                      <Tag theme="warning">Review Required</Tag>
                    )}
                    {item.status === "Missing Mask" && (
                      <Tag theme="danger-soft">Missing Mask</Tag>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="stroked"
                      onClick={() =>
                        handleTriggerPrompt(`Audit governance and security policy for ${item.resource}`)
                      }
                    >
                      Audit
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
