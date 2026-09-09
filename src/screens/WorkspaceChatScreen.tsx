import * as React from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  Button,
  ConsoleIcons,
  Icons,
  MaterialSymbols,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  SuggestionChip,
  cn,
  snackbar,
} from "@/kit";
import type { Chip, ChipType, ModelId } from "@/types/chat";
import { getRandomGreetingName } from "@/types/chat";
import { AssetChip } from "@/components/chat/AssetChip";
import { AtMentionMenu } from "@/components/chat/AtMentionMenu";
import { PlusMenu } from "@/components/chat/PlusMenu";
import { ModelDropdown } from "@/components/chat/ModelDropdown";
import { BigQueryDialog } from "@/components/dialogs/BigQueryDialog";
import { GCSDialog } from "@/components/dialogs/GCSDialog";
import {
  FullscreenIcon,
  FullscreenExitIcon,
  PlusIcon,
  SendIcon,
  ThumbUpIcon,
  ThumbDownIcon,
} from "@/components/chat/ChatIcons";

export interface WorkspaceOption {
  id: string;
  label: string;
}

export interface WorkspaceChatScreenProps {
  workspaceName?: string;
  chatTitle?: string;
  workspaces?: WorkspaceOption[];
  activeWorkspaceId?: string;
  onSelectWorkspace?: (id: string) => void;
  onSubmitPrompt?: (prompt: string, chips: Chip[], model: ModelId) => void;
  onNavigateWorkspace?: () => void;
  initialChips?: Chip[];
  memberName?: string;
  isStartScreen?: boolean;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
  isNewChat?: boolean;
}

interface MessageItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  chips?: Chip[];
  thinking?: string;
  timestamp: string;
}

const DEFAULT_WORKSPACES: WorkspaceOption[] = [
  { id: "workspace-churn", label: "Customer churn analysis" },
  { id: "workspace-01", label: "Myworkspace01" },
];

export function WorkspaceChatScreen({
  workspaceName,
  chatTitle,
  workspaces = DEFAULT_WORKSPACES,
  activeWorkspaceId = "workspace-churn",
  onSelectWorkspace,
  onSubmitPrompt,
  onNavigateWorkspace,
  initialChips = [],
  memberName,
  isStartScreen = false,
  isMaximized: propIsMaximized,
  onToggleMaximize,
  isNewChat = false,
}: WorkspaceChatScreenProps) {
  const [selectedWorkspaceId, setSelectedWorkspaceId] = React.useState(activeWorkspaceId);
  const [panelOpen, setPanelOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");
  const [chips, setChips] = React.useState<Chip[]>(initialChips);
  const [model, setModel] = React.useState<ModelId>("flash");
  const [localIsMaximized, setLocalIsMaximized] = React.useState(false);
  const [expandedThinking, setExpandedThinking] = React.useState(false);
  const [isThinking, setIsThinking] = React.useState(Boolean(isNewChat));

  const isMaximized = propIsMaximized !== undefined ? propIsMaximized : localIsMaximized;

  const isTop10Chat =
    chatTitle?.toLowerCase().includes("top 10") ||
    chatTitle?.toLowerCase().includes("spend") ||
    chatTitle?.toLowerCase().includes("sql query") ||
    initialChips.some((c) => c.label === "account" || c.label === "orders_summary");

  // Dynamic random greeting name between Lena, Chenyu, Timo, James, Isaac
  const [internalMemberName] = React.useState<string>(
    () => memberName || getRandomGreetingName()
  );
  const currentMemberName = memberName || internalMemberName;

  // @ mention menu
  const [showAtMenu, setShowAtMenu] = React.useState(false);
  const [atFilterQuery, setAtFilterQuery] = React.useState("");
  const [atSelectedIndex, setAtSelectedIndex] = React.useState(0);
  const [atMenuLeft, setAtMenuLeft] = React.useState(20);

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (activeWorkspaceId) {
      setSelectedWorkspaceId(activeWorkspaceId);
    }
  }, [activeWorkspaceId]);

  // Auto-resize textarea height
  React.useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        180
      )}px`;
    }
  }, [inputValue]);

  const activeWorkspace =
    workspaces.find((w) => w.id === selectedWorkspaceId) || workspaces[0];

  const handleWorkspaceChange = (wsId: string) => {
    setSelectedWorkspaceId(wsId);
    onSelectWorkspace?.(wsId);
    const ws = workspaces.find((w) => w.id === wsId);
    snackbar(`Switched to workspace "${ws?.label || wsId}"`);
  };

  const [messages, setMessages] = React.useState<MessageItem[]>(() => {
    if (isStartScreen || !workspaceName) return [];

    const isTop10 =
      chatTitle?.toLowerCase().includes("top 10") ||
      chatTitle?.toLowerCase().includes("spend") ||
      initialChips.some((c) => c.label === "account" || c.label === "orders_summary");

    if (isNewChat) {
      return [
        {
          id: "msg-1",
          role: "user",
          content:
            chatTitle ||
            "Can you write a SQL query to find our top 10 customers based on their total purchase spend this month? I'm not sure which dataset is the right one.",
          chips:
            initialChips.length > 0
              ? initialChips
              : isTop10
              ? [
                  { id: "c5", label: "account", type: "table" },
                  { id: "c6", label: "orders_summary", type: "table" },
                ]
              : [],
          timestamp: "Just now",
        },
      ];
    }

    if (isTop10) {
      return [
        {
          id: "msg-1",
          role: "user",
          content:
            "Can you write a SQL query to find our top 10 customers based on their total purchase spend this month? I'm not sure which dataset is the right one.",
          chips: [
            { id: "c5", label: "account", type: "table" },
            { id: "c6", label: "orders_summary", type: "table" },
          ],
          timestamp: "11:20 AM",
        },
        {
          id: "msg-2",
          role: "assistant",
          thinking:
            "Scanned the enterprise BigQuery catalog for customer purchase and billing records. Identified `account` (customer metadata, tier, region) and `orders_summary` (order transaction amounts, timestamps, and status). Joined both tables on `account_id`, filtered for completed orders within the current calendar month, aggregated total spend, and ordered descending with LIMIT 10.",
          content: `To find your top 10 customers by total purchase spend this month, you will want to query the **\`orders_summary\`** table joined with the **\`account\`** table.

Here is the BigQuery SQL query:

\`\`\`sql
SELECT 
    a.account_id,
    a.customer_name,
    a.account_tier,
    COUNT(o.order_id) AS total_orders_this_month,
    ROUND(SUM(o.total_amount), 2) AS total_spend_usd
FROM 
    \`daui-storage.ecommerce.orders_summary\` AS o
JOIN 
    \`bq-gca-autopush.chatsession_data.account\` AS a 
    ON o.account_id = a.account_id
WHERE 
    DATE(o.order_timestamp) >= DATE_TRUNC(CURRENT_DATE(), MONTH)
    AND o.status = 'COMPLETED'
GROUP BY 
    a.account_id,
    a.customer_name,
    a.account_tier
ORDER BY 
    total_spend_usd DESC
LIMIT 10;
\`\`\`

### Summary of Datasets Used:
* **\`orders_summary\`**: Provides transactional metrics including \`order_id\`, \`order_timestamp\`, \`total_amount\`, and order \`status\`.
* **\`account\`**: Provides customer profile metadata including \`customer_name\` and \`account_tier\`.

### 3 Sample Insights:
1. **Acme Global ($184.2K)**: Generated highest total spend this month across 42 orders (22.4% of top-10 spend).
2. **Enterprise Tier Share (78%)**: 7 of the top 10 accounts belong to Enterprise Tier, driving $712K in cumulative revenue.
3. **MoM Order Velocity (+14.2%)**: Average order frequency among top customers grew by 14.2% compared to last month.

Would you like to run this query directly in BigQuery Studio or export the result?`,
          timestamp: "11:21 AM",
        },
      ];
    }

    return [
      {
        id: "msg-1",
        role: "user",
        content: chatTitle || "Train a churn classification model",
        chips: initialChips.length > 0 ? initialChips : [
          { id: "c1", label: "user_behavior_table", type: "table" },
          { id: "c2", label: "churn_prediction_model", type: "notebook" },
        ],
        timestamp: "11:20 AM",
      },
      {
        id: "msg-2",
        role: "assistant",
        thinking:
          "Analyzed 1.2M rows from user_behavior_table. Joined with churn_prediction_model outputs across 4 regional cohorts. Verified that 30-day inactivity is the primary predictor (p < 0.001) for subscription cancellations.",
        content: `### Customer Churn & Retention Analysis

Based on the referenced **\`user_behavior_table\`** and **\`churn_prediction_model\`**, here are the findings for ${workspaceName}:

1. **Top Churn Predictors**:
   - Inactive sessions > 14 days correlates with an **82% probability** of cancellation.
   - Users with zero dashboard shares in month 2 churn at **3.4× the baseline rate**.

2. **Cohort Retention Overview**:
   - **Month 1 Retention**: 88.4%
   - **Month 3 Retention**: 71.2%
   - **Month 6 Retention**: 59.8% (Target: >65%)

\`\`\`sql
SELECT cohort_month, 
       COUNT(DISTINCT user_id) as total_users,
       ROUND(AVG(retention_rate_m3) * 100, 2) as m3_retention_pct
FROM \`bq-analytics-prod.churn_features.user_behavior_table\`
WHERE workspace = '${workspaceName}'
GROUP BY 1 ORDER BY 1 DESC;
\`\`\`

Would you like me to generate an automated alert pipeline or retrain the churn model with updated features?`,
        timestamp: "11:21 AM",
      },
    ];
  });

  // Dynamic response timer when a new chat flow starts
  React.useEffect(() => {
    if (!isNewChat) return;

    const timer = setTimeout(() => {
      setIsThinking(false);

      const isTop10 =
        chatTitle?.toLowerCase().includes("top 10") ||
        chatTitle?.toLowerCase().includes("spend") ||
        chatTitle?.toLowerCase().includes("sql query") ||
        initialChips.some((c) => c.label === "account" || c.label === "orders_summary");

      const assistantMsg: MessageItem = isTop10
        ? {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            thinking:
              "Scanned the enterprise BigQuery catalog for customer purchase and billing records. Identified `account` (customer metadata, tier, region) and `orders_summary` (order transaction amounts, timestamps, and status). Joined both tables on `account_id`, filtered for completed orders within the current calendar month, aggregated total spend, and ordered descending with LIMIT 10.",
            content: `To find your top 10 customers by total purchase spend this month, you will want to query the **\`orders_summary\`** table joined with the **\`account\`** table.

Here is the BigQuery SQL query:

\`\`\`sql
SELECT 
    a.account_id,
    a.customer_name,
    a.account_tier,
    COUNT(o.order_id) AS total_orders_this_month,
    ROUND(SUM(o.total_amount), 2) AS total_spend_usd
FROM 
    \`daui-storage.ecommerce.orders_summary\` AS o
JOIN 
    \`bq-gca-autopush.chatsession_data.account\` AS a 
    ON o.account_id = a.account_id
WHERE 
    DATE(o.order_timestamp) >= DATE_TRUNC(CURRENT_DATE(), MONTH)
    AND o.status = 'COMPLETED'
GROUP BY 
    a.account_id,
    a.customer_name,
    a.account_tier
ORDER BY 
    total_spend_usd DESC
LIMIT 10;
\`\`\`

### Summary of Datasets Used:
* **\`orders_summary\`**: Provides transactional metrics including \`order_id\`, \`order_timestamp\`, \`total_amount\`, and order \`status\`.
* **\`account\`**: Provides customer profile metadata including \`customer_name\` and \`account_tier\`.

### 3 Sample Insights:
1. **Acme Global ($184.2K)**: Generated highest total spend this month across 42 orders (22.4% of top-10 spend).
2. **Enterprise Tier Share (78%)**: 7 of the top 10 accounts belong to Enterprise Tier, driving $712K in cumulative revenue.
3. **MoM Order Velocity (+14.2%)**: Average order frequency among top customers grew by 14.2% compared to last month.

Would you like to run this query directly in BigQuery Studio or export the result?`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          }
        : {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            thinking: `Analyzed query prompt and evaluated active tables in workspace "${workspaceName || "Workspace"}".`,
            content: `I've analyzed your query with **Gemini 3.5 Flash**.\n\nAll queries were validated against Google Cloud BigQuery and Vertex AI for **${workspaceName || "this workspace"}**.`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          };

      setMessages((prev) => [...prev, assistantMsg]);
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 850);

    return () => clearTimeout(timer);
  }, [isNewChat, chatTitle, initialChips, workspaceName]);

  const [showBigQueryDialog, setShowBigQueryDialog] = React.useState(false);
  const [showGCSDialog, setShowGCSDialog] = React.useState(false);

  const addChip = (chip: Chip) => {
    if (!chips.some((c) => c.id === chip.id || c.label === chip.label)) {
      setChips((prev) => [...prev, chip]);
    }
  };

  const removeChip = (id: string) => {
    setChips((prev) => prev.filter((c) => c.id !== id));
  };

  const handleBigQuerySelect = (tables: string[]) => {
    tables.forEach((table, idx) => {
      addChip({
        id: `bq-${Date.now()}-${idx}`,
        label: table,
        type: "table",
      });
    });
    if (tables.length > 0) {
      snackbar(`Attached ${tables.length} BigQuery table${tables.length > 1 ? "s" : ""}`);
    }
  };

  const handleGCSSelect = (paths: string[]) => {
    paths.forEach((p, idx) => {
      addChip({
        id: `gcs-${Date.now()}-${idx}`,
        label: p,
        type: "gcs",
      });
    });
    if (paths.length > 0) {
      snackbar(`Attached ${paths.length} Cloud Storage item${paths.length > 1 ? "s" : ""}`);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputValue(val);

    const cursorPos = e.target.selectionStart ?? val.length;
    const textUpToCursor = val.slice(0, cursorPos);
    const lastAt = textUpToCursor.lastIndexOf("@");
    const isAt =
      lastAt !== -1 &&
      !textUpToCursor.slice(lastAt + 1).includes(" ") &&
      !textUpToCursor.slice(lastAt + 1).includes("\n");

    setShowAtMenu(isAt);
    setAtSelectedIndex(0);

    if (isAt) {
      const query = textUpToCursor.slice(lastAt + 1);
      setAtFilterQuery(query);
      const approxLeft = Math.min(Math.max(16, lastAt * 8 + 24), 260);
      setAtMenuLeft(approxLeft);
    } else {
      setAtFilterQuery("");
    }
  };

  const handleAtSelect = (name: string, type: ChipType) => {
    const cursorPos = textareaRef.current?.selectionStart ?? inputValue.length;
    const textUpToCursor = inputValue.slice(0, cursorPos);
    const lastAt = textUpToCursor.lastIndexOf("@");
    const actualAt = lastAt !== -1 ? lastAt : inputValue.lastIndexOf("@");
    const prefix = actualAt !== -1 ? inputValue.slice(0, actualAt) : inputValue;
    const suffix = inputValue.slice(cursorPos);

    setInputValue(prefix + suffix);
    setShowAtMenu(false);

    addChip({
      id: `chip-${name}-${Date.now()}`,
      label: name,
      type,
    });

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const nextPos = prefix.length;
        textareaRef.current.setSelectionRange(nextPos, nextPos);
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showAtMenu) {
      if (e.key === "Escape") {
        e.preventDefault();
        setShowAtMenu(false);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setAtSelectedIndex((prev) => prev + 1);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setAtSelectedIndex((prev) => Math.max(0, prev - 1));
        return;
      }
    }

    if (e.key === "Backspace" && !inputValue && chips.length > 0) {
      const lastChip = chips[chips.length - 1];
      removeChip(lastChip.id);
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    const text = inputValue.trim();
    if (!text && chips.length === 0) return;

    if (isStartScreen && onSubmitPrompt) {
      onSubmitPrompt(text, chips, model);
      return;
    }

    const currentChips = [...chips];
    const userMsg: MessageItem = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      chips: currentChips,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setChips([]);

    setTimeout(() => {
      const assistantMsg: MessageItem = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        thinking: `Evaluating prompt "${text || "context query"}" using ${model} model against active context. Found matching table metadata and executed analytical summary.`,
        content: `I've analyzed your query with **${model === "flash" ? "Gemini 3.5 Flash" : "Gemini Pro"}**.\n\nHere is the breakdown for the requested operation:\n\n- **Target Entity**: \`${activeWorkspace?.label || workspaceName || "Active Workspace"}\`\n- **Contextual References**: ${
          currentChips.length > 0
            ? currentChips.map((c) => `\`${c.label}\` (${c.type})`).join(", ")
            : "Direct workspace session"
        }\n\nAll queries were validated against Google Cloud BigQuery and Vertex AI.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 600);
  };

  const toggleMaximize = () => {
    if (onToggleMaximize) {
      onToggleMaximize();
    } else {
      setLocalIsMaximized((prev) => !prev);
    }
    snackbar(isMaximized ? "Restored default view" : "Maximized chat view (Esc to exit)");
  };

  React.useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isMaximized) {
        toggleMaximize();
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [isMaximized, onToggleMaximize]);

  const hasContent = inputValue.trim().length > 0 || chips.length > 0;
  const showStartView = isStartScreen || (!workspaceName && messages.length === 0);

  // -------------------------------------------------------------
  // START CHAT VIEW: "How can I help, {name}?" with ca. 10% higher offset
  // -------------------------------------------------------------
  if (showStartView) {
    return (
      <div
        className={cn(
          "relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-[#f7f9fd] select-none transition-all duration-200",
          isMaximized && "fixed inset-0 z-[100] w-screen h-screen"
        )}
      >
        {/* Top right maximize/restore icon */}
        <div className="absolute top-4 right-5 z-30">
          <Button
            variant="text"
            size="icon"
            onClick={toggleMaximize}
            title={isMaximized ? "Restore default view (Esc)" : "Maximize entire chat view"}
            aria-label={isMaximized ? "Restore view" : "Maximize chat view"}
          >
            {isMaximized ? <FullscreenExitIcon size={20} /> : <FullscreenIcon size={20} />}
          </Button>
        </div>

        {/* Atmospheric Ambient Radial Glow */}
        <div
          className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
          aria-hidden="true"
        >
          <div
            className="absolute top-[18%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[840px] h-[480px] rounded-full blur-[90px] opacity-60"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(188, 212, 255, 0.75) 0%, rgba(215, 228, 255, 0.5) 45%, rgba(240, 245, 255, 0) 75%)",
            }}
          />
          <div
            className="absolute top-[28%] left-[45%] -translate-x-1/2 -translate-y-1/2 w-[540px] h-[320px] rounded-full blur-[75px] opacity-40"
            style={{
              background:
                "radial-gradient(circle, rgba(162, 192, 255, 0.6) 0%, rgba(210, 225, 255, 0.3) 50%, transparent 80%)",
            }}
          />
        </div>

        {/* Main Centered Content (Shifted ca. 10% higher via -translate-y-[10vh] -mt-16) */}
        <div className="relative z-10 flex flex-col items-center w-full max-w-[660px] px-5 -mt-16 -translate-y-[10vh]">
          {/* Main Heading */}
          <h1 className="text-[34px] font-normal tracking-tight text-[#1b2559] text-center mb-6 font-sans">
            How can I help, {currentMemberName}?
          </h1>

          {/* Workspace Dropdown Selector Pill (Right above composer) */}
          <div className="w-full flex items-center justify-start pl-2 mb-2">
            <Menu>
              <MenuTrigger asChild>
                <Button
                  variant="ghost"
                  leftIcon={<Icons.FolderOpen className="size-4 text-cm-primary" />}
                >
                  <span>{activeWorkspace?.label}</span>
                  <MaterialSymbols.KeyboardArrowDown className="size-4" />
                </Button>
              </MenuTrigger>
              <MenuContent align="start" className="w-64 p-1 z-50">
                <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-cm-on-surface-variant-low">
                  Workspaces
                </div>
                {workspaces.map((ws) => (
                  <MenuItem
                    key={ws.id}
                    onClick={() => handleWorkspaceChange(ws.id)}
                    className="flex items-center justify-between py-2 px-3 text-cm-body-medium cursor-pointer"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Icons.FolderOpen className="size-4 shrink-0 text-cm-primary" />
                      <span className="truncate">{ws.label}</span>
                    </div>
                    {ws.id === selectedWorkspaceId && (
                      <MaterialSymbols.Check className="size-4 text-cm-primary shrink-0" />
                    )}
                  </MenuItem>
                ))}
                <div className="h-px bg-cm-hairline/60 my-1" />
                <MenuItem
                  onClick={() => snackbar("Create new workspace modal")}
                  className="flex items-center gap-2 py-2 px-3 text-cm-body-medium text-cm-primary cursor-pointer"
                >
                  <MaterialSymbols.CreateNewFolder className="size-4" />
                  <span>New workspace</span>
                </MenuItem>
              </MenuContent>
            </Menu>
          </div>

          {/* Chat Composer Box */}
          <div className="relative w-full">
            {/* @ Mention Popover Menu */}
            {showAtMenu && (
              <AtMentionMenu
                leftOffset={atMenuLeft}
                filterQuery={atFilterQuery}
                selectedIndex={atSelectedIndex}
                onSelect={handleAtSelect}
                onClose={() => setShowAtMenu(false)}
              />
            )}

            <div
              className="w-full bg-white rounded-[24px] border border-[#dce3f0] shadow-[0_4px_20px_rgba(0,0,0,0.05),0_1px_3px_rgba(0,0,0,0.03)] focus-within:border-cm-outline focus-within:shadow-[0_8px_32px_rgba(73,108,195,0.12)] transition-all p-3.5 flex flex-col gap-2.5 cursor-text"
              onClick={() => textareaRef.current?.focus()}
            >
              {/* Chips Tray */}
              {chips.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1 px-1">
                  {chips.map((chip) => (
                    <AssetChip
                      key={chip.id}
                      chip={chip}
                      onRemove={() => removeChip(chip.id)}
                    />
                  ))}
                </div>
              )}

              {/* Text Input Area */}
              <div className="px-1">
                <textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={handleTextChange}
                  onKeyDown={handleKeyDown}
                  rows={2}
                  placeholder="Ask anything, @ mention context, or add files..."
                  className="w-full bg-transparent outline-none resize-none text-[15px] leading-relaxed text-[#1b2559] placeholder-[#808ea3] overflow-hidden"
                />
              </div>

              {/* Bottom Toolbar Controls (No dividing line) */}
              <div className="flex items-center justify-between pt-1">
                {/* Left Action Buttons */}
                <div
                  className="flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* 1. Plus Menu (+) */}
                  <PlusMenu
                    onAttachFile={(fileName) => {
                      addChip({
                        id: `file-${Date.now()}`,
                        label: fileName,
                        type: "file",
                      });
                    }}
                    onAttachBigQuery={() => setShowBigQueryDialog(true)}
                    onAttachGCS={() => setShowGCSDialog(true)}
                  >
                    <Button
                      variant="text"
                      size="icon"
                      title="Add context, files or tables"
                      aria-label="Add context, files or tables"
                    >
                      <PlusIcon size={17} />
                    </Button>
                  </PlusMenu>

                  {/* 2. Extension Button (Middle) */}
                  <Menu>
                    <MenuTrigger asChild>
                      <Button
                        variant="text"
                        size="icon"
                        title="Extensions & context templates"
                        aria-label="Extensions & context templates"
                      >
                        <ConsoleIcons.Extension className="size-[18px]" />
                      </Button>
                    </MenuTrigger>
                    <MenuContent align="start" side="top" sideOffset={8} className="w-68 p-1 z-50">
                      <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-cm-on-surface-variant-low">
                        Context Templates
                      </div>
                      <MenuItem
                        onClick={() => {
                          setInputValue("Analyze churn predictors and retention drivers for Q3 enterprise accounts");
                          addChip({
                            id: `chip-churn-${Date.now()}`,
                            label: "churn_prediction_model",
                            type: "notebook",
                          });
                          addChip({
                            id: `chip-behavior-${Date.now()}`,
                            label: "user_behavior_table",
                            type: "table",
                          });
                          snackbar("Loaded Churn Analysis Template");
                        }}
                        className="flex flex-col items-start py-2 px-3 cursor-pointer"
                      >
                        <span className="font-medium text-cm-label-medium">Customer Churn Analysis</span>
                        <span className="text-[12px] text-cm-on-surface-variant-low">Attaches ML model & user behavior table</span>
                      </MenuItem>
                      <MenuItem
                        onClick={() => {
                          setInputValue("Examine monthly revenue trends and active subscription cohorts");
                          addChip({
                            id: `chip-rev-${Date.now()}`,
                            label: "active_subscriptions",
                            type: "table",
                          });
                          addChip({
                            id: `chip-cohort-${Date.now()}`,
                            label: "user_retention_cohorts",
                            type: "table",
                          });
                          snackbar("Loaded Retention Analysis Template");
                        }}
                        className="flex flex-col items-start py-2 px-3 cursor-pointer"
                      >
                        <span className="font-medium text-cm-label-medium">Revenue & Retention Cohorts</span>
                        <span className="text-[12px] text-cm-on-surface-variant-low">Attaches subscriptions & retention tables</span>
                      </MenuItem>
                    </MenuContent>
                  </Menu>

                  {/* 3. Cloud Project Button */}
                  <Button
                    variant={chips.some((c) => c.type === "graph") ? "default" : "text"}
                    size="icon"
                    title="Toggle cloud project context"
                    aria-label="Toggle cloud project context"
                    onClick={() => {
                      const graphLabel = "customer_churn_graph";
                      if (chips.some((c) => c.label === graphLabel)) {
                        setChips((prev) => prev.filter((c) => c.label !== graphLabel));
                        snackbar("Removed cloud project context");
                      } else {
                        addChip({
                          id: `graph-${Date.now()}`,
                          label: graphLabel,
                          type: "graph",
                        });
                        snackbar("Attached cloud project context");
                      }
                    }}
                  >
                    <ConsoleIcons.CloudProject className="size-[18px]" />
                  </Button>
                </div>

                {/* Right Controls */}
                <div
                  className="flex items-center gap-1.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ModelDropdown modelId={model} onModelChange={setModel} />
                  <Button
                    variant="default"
                    size="icon"
                    onClick={handleSend}
                    disabled={!hasContent}
                    title="Send prompt (Enter)"
                    aria-label="Send prompt"
                  >
                    <SendIcon size={15} className="ml-0.5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // ACTIVE WORKSPACE CHAT VIEW: Breadcrumbs, Header Actions, Messages, Panels
  // -------------------------------------------------------------
  return (
    <div
      className={cn(
        "bg-cm-backdrop flex flex-1 flex-col overflow-hidden transition-all duration-200",
        isMaximized && "fixed inset-0 z-[100] w-screen h-screen bg-[#f7f9fd]"
      )}
    >
      {/* Top Header Bar with Breadcrumb and Action Buttons */}
      <div className="flex h-12 w-full shrink-0 items-center justify-between px-6 bg-white/60 border-b border-cm-hairline/60 backdrop-blur-xs">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigateWorkspace?.();
                }}
              >
                <Icons.FolderOpen className="size-[18px]" />
                {workspaceName || activeWorkspace?.label || "Workspace"}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbItem>
              <BreadcrumbPage>{chatTitle || "Chat"}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Right side header action buttons */}
        <div className="flex items-center gap-1">
          {/* Maximize / Restore Button */}
          <Button
            variant="text"
            size="icon"
            onClick={toggleMaximize}
            title={isMaximized ? "Restore view (Esc)" : "Maximize entire chat view"}
            aria-label={isMaximized ? "Restore view" : "Maximize chat view"}
          >
            {isMaximized ? <FullscreenExitIcon size={18} /> : <FullscreenIcon size={18} />}
          </Button>

          {/* More options menu */}
          <Menu>
            <MenuTrigger asChild>
              <Button
                variant="text"
                size="icon"
                title="More options"
                aria-label="More options"
              >
                <MaterialSymbols.MoreVert className="size-[18px]" />
              </Button>
            </MenuTrigger>
            <MenuContent align="end" className="w-48 z-50">
              <MenuItem onClick={() => snackbar(`Renamed "${chatTitle || "Chat"}"`)}>
                Rename chat
              </MenuItem>
              <MenuItem onClick={() => snackbar(`Link copied for "${chatTitle || "Chat"}"`)}>
                Copy link
              </MenuItem>
              <MenuItem onClick={() => snackbar(`Exported chat history`)}>
                Export chat
              </MenuItem>
              <MenuItem onClick={() => snackbar(`Deleted "${chatTitle || "Chat"}"`)}>
                Delete chat
              </MenuItem>
            </MenuContent>
          </Menu>

          {/* Toggle right details panel */}
          <Button
            variant={panelOpen ? "default" : "text"}
            size="icon"
            title={panelOpen ? "Close panel" : "Open panel"}
            aria-label={panelOpen ? "Close panel" : "Open panel"}
            onClick={() => {
              setPanelOpen((prev) => !prev);
              snackbar(panelOpen ? "Side panel closed" : "Side panel opened");
            }}
          >
            <MaterialSymbols.RightPanelClose className="size-[18px]" />
          </Button>
        </div>
      </div>

      {/* Main chat messages & side panel layout */}
      <div className="flex flex-1 overflow-hidden relative">
        <div className="flex flex-1 flex-col h-full overflow-hidden">
          {/* Messages scroll list */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 max-w-[840px] w-full mx-auto">
            {messages.map((msg) => (
              <div key={msg.id} className="space-y-2">
                {msg.role === "user" ? (
                  <div className="flex flex-col items-end gap-1.5 pl-12">
                    {msg.chips && msg.chips.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 justify-end">
                        {msg.chips.map((chip) => (
                          <AssetChip key={chip.id} chip={chip} />
                        ))}
                      </div>
                    )}
                    <div className="bg-cm-container px-4 py-2.5 rounded-2xl rounded-tr-xs text-cm-body-medium text-cm-on-surface max-w-[85%] shadow-2xs">
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-start gap-2.5 pr-12">
                    {/* Gemini Thinking Accordion */}
                    {msg.thinking && (
                      <div className="w-full border border-cm-hairline/80 rounded-xl bg-white/70 overflow-hidden shadow-2xs">
                        <button
                          type="button"
                          onClick={() => setExpandedThinking((prev) => !prev)}
                          className="w-full flex items-center justify-between px-3.5 py-2 text-[12px] font-medium text-cm-on-surface-variant hover:bg-cm-container/50 transition-colors cursor-pointer"
                        >
                          <span className="flex items-center gap-1.5 text-cm-primary">
                            <MaterialSymbols.AutoAwesome className="size-3.5" />
                            Thinking Process
                          </span>
                          <MaterialSymbols.KeyboardArrowDown
                            className={cn(
                              "size-4 transition-transform duration-200",
                              expandedThinking && "rotate-180"
                            )}
                          />
                        </button>
                        {expandedThinking && (
                          <div className="px-3.5 py-2.5 border-t border-cm-hairline/40 text-cm-on-surface-variant text-[12px] leading-relaxed bg-white">
                            {msg.thinking}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Markdown response content */}
                    <div className="bg-white border border-cm-hairline/80 rounded-2xl p-5 shadow-2xs text-cm-body-medium text-cm-on-surface leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </div>

                    {/* 3 Sample Insights placed below chat response */}
                    {isTop10Chat && (
                      <div className="w-full">
                        <div className="text-cm-label-small text-cm-on-surface-variant mb-2 flex items-center gap-1.5">
                          <MaterialSymbols.AutoAwesome className="size-3.5 text-cm-primary" />
                          <span>3 Sample Insights</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 w-full">
                          <SuggestionChip
                            icon={<MaterialSymbols.TrendingUp aria-hidden />}
                            onClick={() => snackbar("Loaded insight: Top Spender")}
                          >
                            Top Spender: Acme Global ($184.2K · 22.4% spend)
                          </SuggestionChip>
                          <SuggestionChip
                            icon={<MaterialSymbols.AutoAwesome aria-hidden />}
                            onClick={() => snackbar("Loaded insight: Enterprise Share")}
                          >
                            Enterprise Share: 78% Tier-1 Revenue (7 of 10)
                          </SuggestionChip>
                          <SuggestionChip
                            icon={<MaterialSymbols.Schedule aria-hidden />}
                            onClick={() => snackbar("Loaded insight: Order Velocity")}
                          >
                            Order Velocity: +14.2% MoM frequency
                          </SuggestionChip>
                        </div>
                      </div>
                    )}

                    {/* Message action buttons */}
                    <div className="flex items-center gap-1 pl-1">
                      <Button
                        variant="text"
                        size="icon"
                        onClick={() => snackbar("Copied response")}
                        title="Copy"
                        aria-label="Copy"
                      >
                        <MaterialSymbols.ContentCopy className="size-4" />
                      </Button>
                      <Button
                        variant="text"
                        size="icon"
                        onClick={() => snackbar("Marked as helpful")}
                        title="Good response"
                        aria-label="Good response"
                      >
                        <ThumbUpIcon size={16} />
                      </Button>
                      <Button
                        variant="text"
                        size="icon"
                        onClick={() => snackbar("Feedback recorded")}
                        title="Bad response"
                        aria-label="Bad response"
                      >
                        <ThumbDownIcon size={16} />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {isThinking && (
              <div className="flex flex-col items-start gap-2.5 pr-12 animate-pulse">
                <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-white border border-cm-hairline/80 shadow-2xs text-cm-body-medium text-cm-on-surface">
                  <MaterialSymbols.AutoAwesome className="size-4 animate-spin text-cm-primary" />
                  <span className="text-cm-body-medium text-cm-on-surface-variant">
                    Searching BigQuery catalog and generating query...
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Chat Composer Bar */}
          <div className="p-4 pt-1 bg-gradient-to-t from-cm-backdrop via-cm-backdrop to-transparent max-w-[840px] w-full mx-auto relative">
            {/* Mention popover */}
            {showAtMenu && (
              <AtMentionMenu
                leftOffset={atMenuLeft}
                filterQuery={atFilterQuery}
                selectedIndex={atSelectedIndex}
                onSelect={handleAtSelect}
                onClose={() => setShowAtMenu(false)}
              />
            )}

            <div
              className="bg-white rounded-[24px] border border-[#dce3f0] shadow-sm focus-within:border-cm-outline focus-within:shadow-md transition-all p-3 flex flex-col gap-2 cursor-text"
              onClick={() => textareaRef.current?.focus()}
            >
              {chips.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5 px-1">
                  {chips.map((chip) => (
                    <AssetChip
                      key={chip.id}
                      chip={chip}
                      onRemove={() => removeChip(chip.id)}
                    />
                  ))}
                </div>
              )}

              <div className="px-1">
                <textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={handleTextChange}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  placeholder="Ask a follow-up, @ mention, or /search..."
                  className="w-full bg-transparent outline-none resize-none text-[14px] leading-relaxed text-[#1b2e5d] placeholder-[#5f6368] overflow-hidden"
                />
              </div>

              {/* Toolbar Controls (No dividing line) */}
              <div className="flex items-center justify-between pt-1">
                <div
                  className="flex items-center gap-1 text-cm-on-surface-variant"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* 1. Plus Menu */}
                  <PlusMenu
                    onAttachFile={(name) =>
                      addChip({ id: `file-${Date.now()}`, label: name, type: "file" })
                    }
                    onAttachBigQuery={() => setShowBigQueryDialog(true)}
                    onAttachGCS={() => setShowGCSDialog(true)}
                  >
                    <Button
                      variant="text"
                      size="icon"
                      title="Add data"
                      aria-label="Add data"
                    >
                      <PlusIcon size={16} />
                    </Button>
                  </PlusMenu>

                  {/* 2. Extension Button (Middle) */}
                  <Button
                    variant="text"
                    size="icon"
                    title="Extension context"
                    aria-label="Extension context"
                    onClick={() => {
                      addChip({
                        id: `chip-churn-${Date.now()}`,
                        label: "churn_prediction_model",
                        type: "notebook",
                      });
                      snackbar("Added churn model context");
                    }}
                  >
                    <ConsoleIcons.Extension className="size-4" />
                  </Button>

                  {/* 3. Cloud Project Button */}
                  <Button
                    variant="text"
                    size="icon"
                    title="Cloud project context"
                    aria-label="Cloud project context"
                    onClick={() => {
                      addChip({
                        id: `graph-${Date.now()}`,
                        label: "customer_churn_graph",
                        type: "graph",
                      });
                      snackbar("Added cloud project context");
                    }}
                  >
                    <ConsoleIcons.CloudProject className="size-4" />
                  </Button>
                </div>

                <div
                  className="flex items-center gap-1.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ModelDropdown modelId={model} onModelChange={setModel} />
                  <Button
                    variant="default"
                    size="icon"
                    onClick={handleSend}
                    title="Send message"
                    aria-label="Send message"
                  >
                    <SendIcon size={13} className="ml-0.5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Optional Right Details Panel */}
        {panelOpen && (
          <div className="w-80 bg-white border-l border-cm-hairline flex flex-col h-full animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between px-4 py-3 border-b border-cm-hairline">
              <span className="font-semibold text-cm-title-small text-cm-on-surface">
                Workspace Resources
              </span>
              <Button
                variant="text"
                size="icon"
                onClick={() => setPanelOpen(false)}
                title="Close panel"
                aria-label="Close panel"
              >
                <MaterialSymbols.Close className="size-4" />
              </Button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              <div>
                <span className="text-cm-label-small uppercase text-cm-on-surface-variant font-medium">
                  Attached Assets
                </span>
                <div className="mt-2 space-y-2">
                  <div className="p-2.5 rounded-lg border border-cm-hairline/80 bg-cm-surface-variant/50 text-cm-body-small">
                    <span className="font-medium text-cm-on-surface">user_behavior_table</span>
                    <p className="text-[12px] text-cm-on-surface-variant-low">BigQuery Partitioned Table · 1.2M rows</p>
                  </div>
                  <div className="p-2.5 rounded-lg border border-cm-hairline/80 bg-cm-surface-variant/50 text-cm-body-small">
                    <span className="font-medium text-cm-on-surface">churn_prediction_model</span>
                    <p className="text-[12px] text-cm-on-surface-variant-low">Vertex AI AutoML Model · v2.1</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <BigQueryDialog
        open={showBigQueryDialog}
        onOpenChange={setShowBigQueryDialog}
        onSelect={handleBigQuerySelect}
      />
      <GCSDialog
        open={showGCSDialog}
        onOpenChange={setShowGCSDialog}
        onSelect={handleGCSSelect}
      />
    </div>
  );
}
