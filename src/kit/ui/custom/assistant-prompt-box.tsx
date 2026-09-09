import * as React from "react";
import { Button } from "../button";
import * as MaterialSymbols from "../material-symbols";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "../menu";
import { cn } from "../utils";

export interface AssistantPromptBoxProps
  extends Omit<React.ComponentProps<"div">, "onChange" | "onSubmit"> {
  workspaceName?: string;
  onSelectWorkspace?: (ws: string) => void;
  workspaceOptions?: string[];
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit?: (query: string) => void;
  modelName?: string;
  onSelectModel?: (model: string) => void;
  modelOptions?: string[];
}

export function AssistantPromptBox({
  className,
  workspaceName = "Customer churn analysis",
  onSelectWorkspace,
  workspaceOptions = [
    "Customer churn analysis",
    "Myworkspace01",
    "Sales optimization",
  ],
  placeholder = "Ask, @ mention, /search to work with your data",
  value: controlledValue,
  onChange,
  onSubmit,
  modelName: controlledModel,
  onSelectModel,
  modelOptions = ["Flash", "Pro", "Ultra"],
  ...props
}: AssistantPromptBoxProps) {
  const [internalValue, setInternalValue] = React.useState("");
  const [selectedModel, setSelectedModel] = React.useState("Flash");
  const [currentWorkspace, setCurrentWorkspace] = React.useState(workspaceName);

  const inputValue = controlledValue !== undefined ? controlledValue : internalValue;
  const currentModel = controlledModel !== undefined ? controlledModel : selectedModel;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (inputValue.trim()) {
        onSubmit?.(inputValue);
        if (controlledValue === undefined) {
          setInternalValue("");
        }
      }
    }
  };

  return (
    <div className={cn("flex w-full flex-col items-start gap-2", className)} {...props}>
      {/* Workspace Context Selector Above Input Card */}
      <Menu>
        <MenuTrigger asChild>
          <Button
            variant="ghost"
            leftIcon={
              <MaterialSymbols.FolderOpen
                aria-hidden
                className="text-cm-primary size-4"
              />
            }
          >
            <span>{currentWorkspace}</span>
            <MaterialSymbols.KeyboardArrowDown
              aria-hidden
              className="text-cm-on-surface-variant size-4"
            />
          </Button>
        </MenuTrigger>
        <MenuContent align="start">
          {workspaceOptions.map((ws) => (
            <MenuItem
              key={ws}
              onClick={() => {
                setCurrentWorkspace(ws);
                onSelectWorkspace?.(ws);
              }}
            >
              {ws}
            </MenuItem>
          ))}
        </MenuContent>
      </Menu>

      {/* Main Prompt Card with Ambient Glow */}
      <div className="relative isolate w-full">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-1.5 rounded-[26px] blur-md [background:var(--chat-linear-gradient-8)]"
        />
        <div className="bg-cm-surface border-cm-container-high relative z-10 flex w-full flex-col rounded-[22px] border p-4 shadow-sm transition-all focus-within:border-cm-outline-active">
        <textarea
          rows={2}
          value={inputValue}
          onChange={(e) => {
            onChange?.(e);
            if (controlledValue === undefined) {
              setInternalValue(e.target.value);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="text-cm-body-medium placeholder:text-cm-on-surface-variant text-cm-on-surface-variant min-h-[64px] w-full resize-none bg-transparent pt-3 outline-none"
        />

        {/* Bottom Toolbar */}
        <div className="flex items-center justify-between pt-3">
          {/* Left Action Icons */}
          <div className="flex items-center gap-1">
            <Button
              variant="text"
              size="icon"
              aria-label="Add source"
            >
              <MaterialSymbols.Add className="size-5" />
            </Button>
            <Button
              variant="text"
              size="icon"
              aria-label="Extensions"
            >
              <MaterialSymbols.Extension className="size-4.5" />
            </Button>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2">
            <Menu>
              <MenuTrigger asChild>
                <Button
                  variant="ghost"
                >
                  <span>{currentModel}</span>
                  <MaterialSymbols.KeyboardArrowDown className="size-4" />
                </Button>
              </MenuTrigger>
              <MenuContent align="end">
                {modelOptions.map((model) => (
                  <MenuItem
                    key={model}
                    onClick={() => {
                      setSelectedModel(model);
                      onSelectModel?.(model);
                    }}
                  >
                    {model}
                  </MenuItem>
                ))}
              </MenuContent>
            </Menu>

            <Button
              variant="default"
              size="icon"
              aria-label="Send prompt"
              onClick={() => {
                if (inputValue.trim()) {
                  onSubmit?.(inputValue);
                  if (controlledValue === undefined) {
                    setInternalValue("");
                  }
                }
              }}
              disabled={!inputValue.trim()}
            >
              <MaterialSymbols.ArrowForward className="size-4.5" />
            </Button>

            <Menu>
              <MenuTrigger asChild>
                <Button
                  variant="text"
                  size="icon"
                  aria-label="More prompt options"
                >
                  <MaterialSymbols.MoreVert className="size-4.5" />
                </Button>
              </MenuTrigger>
              <MenuContent align="end">
                <MenuItem>Clear prompt</MenuItem>
                <MenuItem>Prompt settings</MenuItem>
                <MenuItem>Keyboard shortcuts</MenuItem>
              </MenuContent>
            </Menu>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
