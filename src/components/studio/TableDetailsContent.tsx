import { useState } from "react";
import {
  Button,
  MaterialSymbols,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
} from "@/kit";
import { TableIcon } from "@/components/chat/ChatIcons";
import { getTableDetailsData } from "@/lib/data/bigquery-data";

export function TableDetailsContent({
  tableName,
  onClose,
  onBack,
  onOpenStudio,
}: {
  tableName: string;
  onClose: () => void;
  onBack?: () => void;
  onOpenStudio?: (targetTabId?: string) => void;
}) {
  const isLogFile =
    tableName.toLowerCase().includes("log") ||
    tableName.toLowerCase().includes(".txt") ||
    tableName.toLowerCase().includes("feedback") ||
    tableName.toLowerCase().includes("gs://");

  const [activeTab, setActiveTab] = useState("Schema");
  const [filterText, setFilterText] = useState("");

  const tableData = getTableDetailsData(tableName);
  const schemaRows = tableData.schemaRows;
  const previewRows = tableData.previewRows;

  const filteredRows = schemaRows.filter((r) =>
    r.name.toLowerCase().includes(filterText.toLowerCase())
  );
  const previewCols = previewRows.length > 0 ? Object.keys(previewRows[0]) : [];

  const rawLogEntries = [
    { line: 1, time: "2026-04-01T09:14:13Z", level: "INFO", user: "USR0982", text: "Requesting more payment options... Region: Asia" },
    { line: 2, time: "2026-04-01T13:02:02Z", level: "WARN", user: "USR0505", text: "Frustrated with the slow page transitions... Region: Europe" },
    { line: 3, time: "2026-04-02T11:45:10Z", level: "ERROR", user: "USR1104", text: "Checkout API gateway timeout 504. Region: North America" },
    { line: 4, time: "2026-04-02T15:20:44Z", level: "WARN", user: "USR0312", text: "SMS verification code delivery delayed. Region: Europe" },
    { line: 5, time: "2026-04-03T08:30:19Z", level: "INFO", user: "USR0877", text: "Session initiated successfully. Region: LATAM" },
    { line: 6, time: "2026-04-03T10:11:05Z", level: "INFO", user: "USR0441", text: "Profile updated successfully. Region: Asia" },
    { line: 7, time: "2026-04-03T14:55:22Z", level: "WARN", user: "USR0619", text: "Multiple failed login attempts detected. Region: North America" },
    { line: 8, time: "2026-04-04T07:40:01Z", level: "ERROR", user: "USR0210", text: "Payment gateway connection refused 502. Region: Europe" },
    { line: 9, time: "2026-04-04T12:05:30Z", level: "INFO", user: "USR0993", text: "Cart item added. Region: LATAM" },
    { line: 10, time: "2026-04-05T09:18:42Z", level: "INFO", user: "USR0144", text: "Password reset requested. Region: Asia" },
  ];

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between h-12 px-4 shrink-0 border-b border-cm-hairline/60">
        <div className="flex items-center gap-2.5 min-w-0">
          {onBack && (
            <Tooltip content="Back to execution plan" position="bottom">
              <Button
                variant="text"
                size="icon"
                aria-label="Back to execution plan"
                onClick={onBack}
                className="shrink-0 -ml-1"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
              </Button>
            </Tooltip>
          )}
          {isLogFile ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--cm-sys-color-on-surface)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          ) : (
            <TableIcon className="shrink-0 text-cm-on-surface" />
          )}
          <h2 className="text-cm-label-large text-cm-on-surface truncate">
            {tableName}
          </h2>
          {!isLogFile && (
            <Button
              variant="text"
              size="icon"
              aria-label="Favorite"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
              </svg>
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isLogFile && onOpenStudio && (
            <Tooltip content="Open in Studio" position="bottom">
              <Button
                variant="text"
                size="icon"
                aria-label="Open in Studio"
                onClick={() => onOpenStudio(tableName)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 14V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H9" />
                  <line x1="12" y1="3" x2="12" y2="21" />
                  <line x1="12" y1="12" x2="21" y2="12" />
                  <path d="M1.5 22.5L11 13" />
                  <path d="M6.5 13H11v4.5" />
                </svg>
              </Button>
            </Tooltip>
          )}
          <Tooltip content="Close" position="bottom">
            <Button
              variant="text"
              size="icon"
              aria-label="Close"
              onClick={onClose}
            >
              <MaterialSymbols.Close className="size-4" />
            </Button>
          </Tooltip>
        </div>
      </div>

      {isLogFile ? (
        <div className="flex-1 flex flex-col min-h-0 bg-cm-surface">
          {/* Monospaced Log Output Area */}
          <div className="flex-1 overflow-auto bg-cm-surface p-3 font-mono text-cm-body-medium text-cm-on-surface select-text">
            {rawLogEntries.map((entry) => (
              <div key={entry.line} className="flex items-start gap-3 hover:bg-cm-on-surface-inverse px-2 py-1 rounded font-mono border-b border-cm-on-surface-inverse/80">
                <span className="w-6 text-right text-cm-on-surface-variant-low shrink-0 text-cm-body-small font-mono select-none">{entry.line}</span>
                <span className="text-cm-on-surface-variant-low shrink-0 font-mono text-cm-body-small">{entry.time}</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-cm-label-small shrink-0 ${entry.level === "ERROR"
                    ? "bg-cm-status-error-container text-cm-status-error border border-cm-status-error"
                    : entry.level === "WARN"
                      ? "bg-cm-status-warning-container text-cm-status-warning border border-cm-status-warning"
                      : "bg-cm-container-primary-outline text-cm-primary-on-container border border-cm-hairline"
                    }`}
                >
                  [{entry.level}]
                </span>
                <span className="text-cm-on-surface text-cm-label-medium shrink-0">User {entry.user}:</span>
                <span className="text-cm-on-surface break-all">{entry.text}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0">
          <TabsList>
            {["Schema", "Details", "Preview"].map((tab) => (
              <TabsTrigger key={tab} value={tab}>
                {tab}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="Schema" className="flex flex-col min-h-0 pt-0">
            {/* Filter toolbar */}
            <div className="flex items-center justify-between px-5 py-2.5 border-b border-cm-hairline shrink-0">
              <div className="flex items-center gap-2 text-cm-on-surface-variant">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="4" y1="6" x2="20" y2="6" />
                  <line x1="7" y1="12" x2="17" y2="12" />
                  <line x1="10" y1="18" x2="14" y2="18" />
                </svg>
                <span className="text-cm-label-medium">
                  Filter
                </span>
                <input
                  type="text"
                  placeholder="Filter table"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  className="ml-2 bg-transparent text-cm-body-medium text-cm-on-surface placeholder-cm-on-surface-variant-low outline-none border-b border-transparent focus:border-cm-primary"
                />
              </div>
              <Tooltip content="Help" position="bottom">
                <Button variant="ghost" size="icon" aria-label="Schema help">
                  <MaterialSymbols.Help aria-hidden />
                </Button>
              </Tooltip>
            </div>

            {/* Table grid content */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-cm-surface-variant border-b border-cm-hairline/60 h-[29px] text-cm-label-medium text-cm-on-surface">
                    <th className="h-[29px] px-3 border-r border-cm-hairline/60 text-cm-label-medium align-middle whitespace-nowrap">Field name</th>
                    <th className="h-[29px] px-3 border-r border-cm-hairline/60 text-cm-label-medium align-middle whitespace-nowrap">Type</th>
                    <th className="h-[29px] px-3 border-r border-cm-hairline/60 text-cm-label-medium align-middle whitespace-nowrap">Mode</th>
                    <th className="h-[29px] px-3 border-r border-cm-hairline/60 text-cm-label-medium align-middle whitespace-nowrap">Description</th>
                    <th className="h-[29px] px-3 border-r border-cm-hairline/60 text-cm-label-medium align-middle whitespace-nowrap">Key</th>
                    <th className="h-[29px] px-3 border-r border-cm-hairline/60 text-cm-label-medium align-middle whitespace-nowrap">Collation</th>
                    <th className="h-[29px] px-3 text-cm-label-medium align-middle whitespace-nowrap">Default Value</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, i) => (
                    <tr key={i} className="border-b border-cm-hairline/60 hover:bg-cm-surface-variant h-[29px] text-cm-body-medium text-cm-on-surface-variant">
                      <td className="h-[29px] px-3 text-cm-on-surface-variant border-r border-cm-hairline/60 text-cm-label-medium align-middle">
                        {row.name}
                      </td>
                      <td className="h-[29px] px-3 uppercase text-cm-on-surface-variant border-r border-cm-hairline/60 text-cm-body-medium align-middle">
                        {row.type}
                      </td>
                      <td className="h-[29px] px-3 text-cm-on-surface-variant border-r border-cm-hairline/60 text-cm-body-medium align-middle">
                        {row.mode}
                      </td>
                      <td className="h-[29px] px-3 text-cm-on-surface-variant border-r border-cm-hairline/60 truncate max-w-[200px] text-cm-body-medium align-middle">
                        {row.description}
                      </td>
                      <td className="h-[29px] px-3 text-cm-on-surface-variant border-r border-cm-hairline/60 text-cm-body-medium align-middle">-</td>
                      <td className="h-[29px] px-3 text-cm-on-surface-variant border-r border-cm-hairline/60 text-cm-body-medium align-middle">-</td>
                      <td className="h-[29px] px-3 text-cm-on-surface-variant text-cm-body-medium align-middle">-</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="Details" className="overflow-y-auto min-h-0 px-6 py-5 space-y-6 text-cm-on-surface">
            {/* Table info */}
            <div>
              <h3 className="text-cm-title-small text-cm-on-surface mb-3">
                Table info
              </h3>
              <table className="w-full text-left border-collapse text-cm-body-medium">
                <tbody>
                  <tr className="border-b border-cm-hairline/60 h-[29px]">
                    <td className="w-[240px] text-cm-label-medium text-cm-on-surface align-middle">Table ID</td>
                    <td className="text-cm-on-surface-variant align-middle break-all">
                      {tableData.tableId}
                    </td>
                  </tr>
                  <tr className="border-b border-cm-hairline/60 h-[29px]">
                    <td className="w-[240px] text-cm-label-medium text-cm-on-surface align-middle">Created</td>
                    <td className="text-cm-on-surface-variant align-middle">Sep 14, 2023, 1:11:12 PM UTC-7</td>
                  </tr>
                  <tr className="border-b border-cm-hairline/60 h-[29px]">
                    <td className="w-[240px] text-cm-label-medium text-cm-on-surface align-middle">Last modified</td>
                    <td className="text-cm-on-surface-variant align-middle">Jun 29, 2026, 5:56:26 AM UTC-7</td>
                  </tr>
                  <tr className="border-b border-cm-hairline/60 h-[29px]">
                    <td className="w-[240px] text-cm-label-medium text-cm-on-surface align-middle">Table expiration</td>
                    <td className="text-cm-on-surface-variant align-middle">NEVER</td>
                  </tr>
                  <tr className="border-b border-cm-hairline/60 h-[29px]">
                    <td className="w-[240px] text-cm-label-medium text-cm-on-surface align-middle">Data location</td>
                    <td className="text-cm-on-surface-variant align-middle">US</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Storage info */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-cm-title-small text-cm-on-surface">
                  Storage info
                </h3>
              </div>
              <table className="w-full text-left border-collapse text-cm-body-medium">
                <tbody>
                  <tr className="border-b border-cm-hairline/60 h-[29px]">
                    <td className="w-[240px] text-cm-label-medium text-cm-on-surface align-middle">Number of rows</td>
                    <td className="text-cm-on-surface align-middle">{tableData.rowCount}</td>
                  </tr>
                  <tr className="border-b border-cm-hairline/60 h-[29px]">
                    <td className="w-[240px] text-cm-label-medium text-cm-on-surface align-middle">Total logical bytes</td>
                    <td className="text-cm-on-surface align-middle">{tableData.totalBytes}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="Preview" className="overflow-y-auto min-h-0 pt-0">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-cm-surface-variant border-b border-cm-hairline/60 h-[29px] text-cm-label-medium text-cm-on-surface">
                  {previewCols.map((col) => (
                    <th key={col} className="h-[29px] px-3 border-r border-cm-hairline/60 text-cm-label-medium align-middle whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr key={i} className="border-b border-cm-hairline/60 hover:bg-cm-surface-variant h-[29px] text-cm-body-medium text-cm-on-surface-variant">
                    {previewCols.map((col) => (
                      <td key={col} className="h-[29px] px-3 border-r border-cm-hairline/60 text-cm-body-medium align-middle whitespace-nowrap">
                        {String((row as Record<string, unknown>)[col] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
