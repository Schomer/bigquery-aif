// src/components/TaskWorkflowView.tsx
// Renders dynamically-generated task plans from the autonomous task resolver.
// Handles step-by-step input collection, API execution, result display, and error recovery.

'use client';

import React, { useState, useRef, useCallback } from 'react';
import type { CompositionEnvelope } from '@/lib/types';

// ── Task framework types (mirrored from src/lib/tasks/types.ts) ─────────────
// These are inlined to avoid import issues during build if the tasks module
// hasn't been created yet. They match the canonical types in tasks/types.ts.

interface ResolvedPlan {
  title: string;
  description: string;
  approach: string;
  alternativeApproaches?: string[];
  steps: ResolvedStep[];
  fromLearnedPlan?: boolean;
  learnedPlanId?: string;
}

interface ResolvedStep {
  id: string;
  label: string;
  description: string;
  apiCall: {
    url: string;
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    bodyTemplate?: Record<string, unknown>;
    headers?: Record<string, string>;
  };
  inputs: DynamicInput[];
  outputMapping?: Record<string, string>;
  iterateOver?: string;
}

interface DynamicInput {
  name: string;
  type: 'select' | 'text' | 'textarea' | 'file_upload' | 'toggle' | 'number';
  label: string;
  required: boolean;
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  defaultValue?: string;
  helpText?: string;
  accept?: string;
  multiple?: boolean;
  mapsTo: string;
}

interface TaskStepResult {
  stepId: string;
  success: boolean;
  summary: string;
  data: unknown;
  error?: string;
  artifacts: TaskArtifact[];
  outputContext?: Record<string, unknown>;
}

interface TaskArtifact {
  type: 'code' | 'diff' | 'table' | 'download' | 'message' | 'error';
  label: string;
  content: string;
  language?: string;
  originalContent?: string;
  downloadFilename?: string;
}

// ── Component ───────────────────────────────────────────────────────────────

interface TaskWorkflowViewProps {
  envelope: CompositionEnvelope;
  onSendMessage: (msg: string) => void;
}

type StepStatus = 'pending' | 'ready' | 'executing' | 'completed' | 'failed';

export default function TaskWorkflowView({ envelope, onSendMessage }: TaskWorkflowViewProps) {
  const taskData = envelope.primaryArtifact.data as { plan: ResolvedPlan; status: string };
  const plan = taskData.plan;

  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>(() =>
    plan.steps.map((_, i) => (i === 0 ? 'ready' : 'pending'))
  );
  const [stepInputs, setStepInputs] = useState<Record<string, Record<string, unknown>>>(() => {
    const initial: Record<string, Record<string, unknown>> = {};
    for (const step of plan.steps) {
      const stepValues: Record<string, unknown> = {};
      for (const input of step.inputs) {
        if (input.defaultValue !== undefined) {
          stepValues[input.name] = input.defaultValue;
        }
      }
      initial[step.id] = stepValues;
    }
    return initial;
  });
  const [stepResults, setStepResults] = useState<Record<string, TaskStepResult>>({});
  const [priorOutputs, setPriorOutputs] = useState<Record<string, unknown>>({});
  const [expandedStep, setExpandedStep] = useState<number>(0);
  const [showApiPreview, setShowApiPreview] = useState<Record<number, boolean>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // ── Input change handler ────────────────────────────────────────────────

  const updateInput = useCallback((stepId: string, inputName: string, value: unknown) => {
    setStepInputs(prev => ({
      ...prev,
      [stepId]: { ...prev[stepId], [inputName]: value },
    }));
  }, []);

  // ── File upload handler ─────────────────────────────────────────────────

  const handleFileUpload = useCallback(async (stepId: string, inputName: string, files: FileList) => {
    const contents: Array<{ name: string; content: string }> = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const text = await file.text();
      contents.push({ name: file.name, content: text });
    }
    updateInput(stepId, inputName, contents);
  }, [updateInput]);

  // ── Execute step ────────────────────────────────────────────────────────

  const executeStep = useCallback(async (stepIndex: number) => {
    const step = plan.steps[stepIndex];
    if (!step) return;

    setStepStatuses(prev => {
      const next = [...prev];
      next[stepIndex] = 'executing';
      return next;
    });
    setExpandedStep(stepIndex);

    try {
      const { executeApiCall } = await import('@/lib/tasks/executor');
      const { getAccessToken } = await import('@/lib/gis-auth');
      const token = getAccessToken();
      if (!token) throw new Error('Not authenticated. Please sign in again.');
      const project = (envelope.provenance as { project?: string }).project || '';
      const inputs = stepInputs[step.id] || {};

      // Handle batch iteration
      const iterateItems = step.iterateOver ? inputs[step.iterateOver] : null;
      const allArtifacts: TaskArtifact[] = [];
      let lastResult: { success: boolean; data: unknown; error?: string } | null = null;

      if (Array.isArray(iterateItems) && iterateItems.length > 0) {
        // Batch: iterate over each item (e.g., each uploaded file)
        for (const item of iterateItems) {
          const itemInputs = { ...inputs, [step.iterateOver!]: item };
          const result = await executeApiCall(step.apiCall, itemInputs, {
            project,
            location: 'us',
            accessToken: token,
            priorOutputs,
          });
          lastResult = result;

          if (result.success) {
            const itemName = typeof item === 'object' && item !== null && 'name' in item
              ? (item as { name: string }).name
              : `Item`;
            const translatedQuery = (result.data as Record<string, unknown>)?.translatedQuery;
            if (translatedQuery) {
              const originalContent = typeof item === 'object' && item !== null && 'content' in item
                ? (item as { content: string }).content
                : String(inputs.sqlContent || '');
              allArtifacts.push({
                type: 'diff',
                label: itemName,
                content: String(translatedQuery),
                originalContent,
                language: 'sql',
              });
            } else {
              allArtifacts.push({
                type: 'code',
                label: itemName,
                content: JSON.stringify(result.data, null, 2),
                language: 'json',
              });
            }
          } else {
            allArtifacts.push({
              type: 'error',
              label: typeof item === 'object' && item !== null && 'name' in item
                ? (item as { name: string }).name : 'Error',
              content: result.error || 'Unknown error',
            });
          }
        }
      } else {
        // Single execution
        const result = await executeApiCall(step.apiCall, inputs, {
          project,
          location: 'us',
          accessToken: token,
          priorOutputs,
        });
        lastResult = result;

        if (result.success) {
          const translatedQuery = (result.data as Record<string, unknown>)?.translatedQuery;
          if (translatedQuery) {
            allArtifacts.push({
              type: 'diff',
              label: 'Translation Result',
              content: String(translatedQuery),
              originalContent: String(inputs.sqlContent || ''),
              language: 'sql',
            });
          } else {
            allArtifacts.push({
              type: 'code',
              label: 'Result',
              content: JSON.stringify(result.data, null, 2),
              language: 'json',
            });
          }
        } else {
          allArtifacts.push({
            type: 'error',
            label: 'Error',
            content: result.error || 'Unknown error',
          });
        }
      }

      const stepResult: TaskStepResult = {
        stepId: step.id,
        success: lastResult?.success ?? false,
        summary: lastResult?.success
          ? `Completed: ${allArtifacts.filter(a => a.type !== 'error').length} result(s)`
          : `Failed: ${lastResult?.error || 'Unknown error'}`,
        data: lastResult?.data,
        artifacts: allArtifacts,
      };

      // Extract output context for next steps
      if (lastResult?.success && step.outputMapping) {
        const outputCtx: Record<string, unknown> = {};
        const data = lastResult.data as Record<string, unknown>;
        for (const [responseField, contextKey] of Object.entries(step.outputMapping)) {
          outputCtx[contextKey] = data?.[responseField];
        }
        stepResult.outputContext = outputCtx;
        setPriorOutputs(prev => ({ ...prev, ...outputCtx }));
      }

      setStepResults(prev => ({ ...prev, [step.id]: stepResult }));
      setStepStatuses(prev => {
        const next = [...prev];
        next[stepIndex] = stepResult.success ? 'completed' : 'failed';
        // Unlock next step
        if (stepResult.success && stepIndex + 1 < next.length) {
          next[stepIndex + 1] = 'ready';
        }
        return next;
      });

      // If all steps complete, trigger learning
      if (stepResult.success && stepIndex === plan.steps.length - 1) {
        try {
          const { onTaskSuccess } = await import('@/lib/tasks/resolver');
          const project = (envelope.provenance as { project?: string }).project || '';
          // Reconstruct the original message from the envelope headline
          await onTaskSuccess(plan, plan.title, project);
        } catch {
          // Learning is non-fatal
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setStepResults(prev => ({
        ...prev,
        [step.id]: {
          stepId: step.id,
          success: false,
          summary: `Error: ${errorMsg}`,
          data: null,
          artifacts: [{ type: 'error', label: 'Execution Error', content: errorMsg }],
        },
      }));
      setStepStatuses(prev => {
        const next = [...prev];
        next[stepIndex] = 'failed';
        return next;
      });
    }
  }, [plan, stepInputs, priorOutputs, envelope]);

  // ── Download handler ────────────────────────────────────────────────────

  const handleDownloadAll = useCallback(() => {
    const allArtifacts = Object.values(stepResults).flatMap(r => r.artifacts);
    const codeArtifacts = allArtifacts.filter(a => a.type === 'code' || a.type === 'diff');
    if (codeArtifacts.length === 0) return;

    const combined = codeArtifacts.map(a => {
      return `-- ${a.label}\n${a.content}`;
    }).join('\n\n');

    const blob = new Blob([combined], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'translated_queries.sql';
    a.click();
    URL.revokeObjectURL(url);
  }, [stepResults]);

  // ── Input renderer ──────────────────────────────────────────────────────

  const renderInput = (step: ResolvedStep, input: DynamicInput) => {
    const value = stepInputs[step.id]?.[input.name];
    const isDisabled = stepStatuses[plan.steps.indexOf(step)] !== 'ready';

    switch (input.type) {
      case 'select':
        return (
          <div key={input.name} className="task-input-group">
            <label className="task-input-label">
              {input.label}
              {input.required && <span className="task-required">*</span>}
            </label>
            {input.helpText && <div className="task-input-help">{input.helpText}</div>}
            <select
              className="task-select"
              value={String(value || '')}
              onChange={e => updateInput(step.id, input.name, e.target.value)}
              disabled={isDisabled}
            >
              <option value="">Select...</option>
              {input.options?.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        );

      case 'textarea':
        return (
          <div key={input.name} className="task-input-group">
            <label className="task-input-label">
              {input.label}
              {input.required && <span className="task-required">*</span>}
            </label>
            {input.helpText && <div className="task-input-help">{input.helpText}</div>}
            <textarea
              className="task-textarea"
              value={String(value || '')}
              onChange={e => updateInput(step.id, input.name, e.target.value)}
              placeholder={input.placeholder}
              disabled={isDisabled}
              rows={8}
            />
          </div>
        );

      case 'text':
        return (
          <div key={input.name} className="task-input-group">
            <label className="task-input-label">
              {input.label}
              {input.required && <span className="task-required">*</span>}
            </label>
            {input.helpText && <div className="task-input-help">{input.helpText}</div>}
            <input
              type="text"
              className="task-text-input"
              value={String(value || '')}
              onChange={e => updateInput(step.id, input.name, e.target.value)}
              placeholder={input.placeholder}
              disabled={isDisabled}
            />
          </div>
        );

      case 'number':
        return (
          <div key={input.name} className="task-input-group">
            <label className="task-input-label">
              {input.label}
              {input.required && <span className="task-required">*</span>}
            </label>
            {input.helpText && <div className="task-input-help">{input.helpText}</div>}
            <input
              type="number"
              className="task-text-input"
              value={value !== undefined ? String(value) : ''}
              onChange={e => updateInput(step.id, input.name, Number(e.target.value))}
              placeholder={input.placeholder}
              disabled={isDisabled}
            />
          </div>
        );

      case 'toggle':
        return (
          <div key={input.name} className="task-input-group task-toggle-group">
            <label className="task-input-label">{input.label}</label>
            {input.helpText && <div className="task-input-help">{input.helpText}</div>}
            <button
              type="button"
              className={`task-toggle ${value ? 'active' : ''}`}
              onClick={() => updateInput(step.id, input.name, !value)}
              disabled={isDisabled}
            >
              <span className="task-toggle-knob" />
            </button>
          </div>
        );

      case 'file_upload': {
        const files = value as Array<{ name: string }> | undefined;
        return (
          <div key={input.name} className="task-input-group">
            <label className="task-input-label">
              {input.label}
              {input.required && <span className="task-required">*</span>}
            </label>
            {input.helpText && <div className="task-input-help">{input.helpText}</div>}
            <div
              className="task-file-drop"
              onClick={() => fileInputRefs.current[`${step.id}-${input.name}`]?.click()}
              onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('dragover'); }}
              onDragLeave={e => { e.currentTarget.classList.remove('dragover'); }}
              onDrop={e => {
                e.preventDefault();
                e.currentTarget.classList.remove('dragover');
                if (e.dataTransfer.files.length > 0) {
                  handleFileUpload(step.id, input.name, e.dataTransfer.files);
                }
              }}
            >
              <span className="material-symbols-outlined">upload_file</span>
              <span>Drop files here or click to browse</span>
              {files && files.length > 0 && (
                <div className="task-file-list">
                  {files.map((f, i) => (
                    <span key={i} className="task-file-chip">{f.name}</span>
                  ))}
                </div>
              )}
            </div>
            <input
              ref={el => { fileInputRefs.current[`${step.id}-${input.name}`] = el; }}
              type="file"
              accept={input.accept || '.sql,.txt,.ddl'}
              multiple={input.multiple !== false}
              style={{ display: 'none' }}
              onChange={e => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFileUpload(step.id, input.name, e.target.files);
                }
              }}
            />
          </div>
        );
      }

      default:
        return null;
    }
  };

  // ── Artifact renderer ───────────────────────────────────────────────────

  const renderArtifact = (artifact: TaskArtifact, index: number) => {
    switch (artifact.type) {
      case 'diff':
        return (
          <div key={index} className="task-artifact task-diff">
            <div className="task-artifact-label">{artifact.label}</div>
            <div className="task-diff-panels">
              <div className="task-diff-panel">
                <div className="task-diff-header">Original</div>
                <pre className="task-code-block">{artifact.originalContent}</pre>
              </div>
              <div className="task-diff-panel">
                <div className="task-diff-header">Translated (GoogleSQL)</div>
                <pre className="task-code-block">{artifact.content}</pre>
              </div>
            </div>
          </div>
        );

      case 'code':
        return (
          <div key={index} className="task-artifact">
            <div className="task-artifact-label">{artifact.label}</div>
            <pre className="task-code-block">{artifact.content}</pre>
          </div>
        );

      case 'error':
        return (
          <div key={index} className="task-artifact task-artifact-error">
            <div className="task-artifact-label">{artifact.label}</div>
            <div className="task-error-content">{artifact.content}</div>
          </div>
        );

      case 'message':
        return (
          <div key={index} className="task-artifact">
            <div className="task-artifact-label">{artifact.label}</div>
            <div className="task-message-content">{artifact.content}</div>
          </div>
        );

      default:
        return (
          <div key={index} className="task-artifact">
            <pre className="task-code-block">{artifact.content}</pre>
          </div>
        );
    }
  };

  // ── Status icon ─────────────────────────────────────────────────────────

  const statusIcon = (status: StepStatus) => {
    switch (status) {
      case 'pending': return 'radio_button_unchecked';
      case 'ready': return 'play_circle';
      case 'executing': return 'progress_activity';
      case 'completed': return 'check_circle';
      case 'failed': return 'error';
    }
  };

  const statusColor = (status: StepStatus) => {
    switch (status) {
      case 'pending': return 'var(--text-muted)';
      case 'ready': return 'var(--accent)';
      case 'executing': return 'var(--accent)';
      case 'completed': return 'var(--success, #4caf50)';
      case 'failed': return 'var(--error, #f44336)';
    }
  };

  // ── Check if all required inputs are filled ─────────────────────────────

  const isStepReady = (step: ResolvedStep) => {
    const values = stepInputs[step.id] || {};
    return step.inputs.every(input => {
      if (!input.required) return true;
      const val = values[input.name];
      if (val === undefined || val === null || val === '') return false;
      if (Array.isArray(val) && val.length === 0) return false;
      return true;
    });
  };

  // ── Render ──────────────────────────────────────────────────────────────

  if (!plan.steps || plan.steps.length === 0) {
    return (
      <div className="task-workflow-empty">
        <span className="material-symbols-outlined" style={{ fontSize: 32, color: 'var(--text-muted)' }}>
          info
        </span>
        <div style={{ marginTop: 8, color: 'var(--text-secondary)', fontSize: 13 }}>
          {plan.description || 'No executable steps could be determined for this task.'}
        </div>
      </div>
    );
  }

  const allCompleted = stepStatuses.every(s => s === 'completed');
  const hasResults = Object.values(stepResults).some(r => r.artifacts.length > 0);

  return (
    <div className="task-workflow">
      {/* Plan header */}
      <div className="task-workflow-header">
        <div className="task-workflow-title">{plan.title}</div>
        <div className="task-workflow-desc">{plan.description}</div>
        {plan.approach && (
          <div className="task-workflow-approach">
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>lightbulb</span>
            {plan.approach}
          </div>
        )}
        {plan.fromLearnedPlan && (
          <div className="task-workflow-learned">
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>psychology</span>
            Using a previously successful approach
          </div>
        )}
        {plan.alternativeApproaches && plan.alternativeApproaches.length > 0 && (
          <details className="task-alternatives">
            <summary>Alternative approaches considered</summary>
            <ul>
              {plan.alternativeApproaches.map((alt, i) => (
                <li key={i}>{alt}</li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {/* Steps */}
      <div className="task-steps">
        {plan.steps.map((step, i) => {
          const status = stepStatuses[i];
          const result = stepResults[step.id];
          const isExpanded = expandedStep === i;

          return (
            <div key={step.id} className={`task-step ${status}`}>
              <button
                className="task-step-header"
                onClick={() => setExpandedStep(isExpanded ? -1 : i)}
                type="button"
              >
                <span
                  className={`material-symbols-outlined task-step-icon ${status === 'executing' ? 'spinning' : ''}`}
                  style={{ color: statusColor(status) }}
                >
                  {statusIcon(status)}
                </span>
                <span className="task-step-label">
                  Step {i + 1} of {plan.steps.length}: {step.label}
                </span>
                <span className="material-symbols-outlined task-step-chevron">
                  {isExpanded ? 'expand_less' : 'expand_more'}
                </span>
              </button>

              {isExpanded && (
                <div className="task-step-body">
                  <div className="task-step-desc">{step.description}</div>

                  {/* Inputs */}
                  {status === 'ready' && (
                    <div className="task-step-inputs">
                      {step.inputs.map(input => renderInput(step, input))}

                      {/* API call preview */}
                      <details
                        className="task-api-preview"
                        open={showApiPreview[i]}
                        onToggle={e => setShowApiPreview(prev => ({ ...prev, [i]: (e.target as HTMLDetailsElement).open }))}
                      >
                        <summary>API call preview</summary>
                        <pre className="task-code-block task-api-preview-code">
                          {step.apiCall.method} {step.apiCall.url}
                          {step.apiCall.bodyTemplate && (
                            '\n' + JSON.stringify(step.apiCall.bodyTemplate, null, 2)
                          )}
                        </pre>
                      </details>

                      <button
                        className="task-execute-btn"
                        onClick={() => executeStep(i)}
                        disabled={!isStepReady(step)}
                      >
                        <span className="material-symbols-outlined">play_arrow</span>
                        Execute Step
                      </button>
                    </div>
                  )}

                  {/* Executing spinner */}
                  {status === 'executing' && (
                    <div className="task-executing">
                      <span className="material-symbols-outlined spinning">progress_activity</span>
                      Executing...
                    </div>
                  )}

                  {/* Results */}
                  {result && (
                    <div className="task-step-results">
                      <div className={`task-step-summary ${result.success ? 'success' : 'error'}`}>
                        {result.summary}
                      </div>
                      {result.artifacts.map((artifact, ai) => renderArtifact(artifact, ai))}
                    </div>
                  )}

                  {/* Failed: retry or diagnose */}
                  {status === 'failed' && (
                    <div className="task-step-failed-actions">
                      <button
                        className="task-retry-btn"
                        onClick={() => {
                          setStepStatuses(prev => {
                            const next = [...prev];
                            next[i] = 'ready';
                            return next;
                          });
                          setStepResults(prev => {
                            const next = { ...prev };
                            delete next[step.id];
                            return next;
                          });
                        }}
                      >
                        <span className="material-symbols-outlined">refresh</span>
                        Retry
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Completion actions */}
      {allCompleted && hasResults && (
        <div className="task-completion">
          <button className="task-download-btn" onClick={handleDownloadAll}>
            <span className="material-symbols-outlined">download</span>
            Download All Results
          </button>
          <button
            className="task-handoff-chip"
            onClick={() => onSendMessage('Show me the lineage for the translated tables')}
          >
            <span className="material-symbols-outlined">account_tree</span>
            View Lineage
          </button>
          <button
            className="task-handoff-chip"
            onClick={() => onSendMessage('Run the translated SQL')}
          >
            <span className="material-symbols-outlined">play_arrow</span>
            Run Translated SQL
          </button>
        </div>
      )}

      <style>{`
        .task-workflow {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 4px 0;
        }
        .task-workflow-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          text-align: center;
        }
        .task-workflow-header {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .task-workflow-title {
          font-size: 15px;
          font-weight: 600;
          color: var(--text-primary);
        }
        .task-workflow-desc {
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.5;
        }
        .task-workflow-approach,
        .task-workflow-learned {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--text-muted);
          padding: 6px 10px;
          background: var(--surface-hover, rgba(255,255,255,0.03));
          border-radius: 6px;
          margin-top: 4px;
        }
        .task-workflow-learned {
          color: var(--accent);
          background: color-mix(in srgb, var(--accent) 8%, transparent);
        }
        .task-alternatives {
          font-size: 12px;
          color: var(--text-muted);
          margin-top: 4px;
        }
        .task-alternatives summary {
          cursor: pointer;
          user-select: none;
        }
        .task-alternatives ul {
          margin: 6px 0 0;
          padding-left: 18px;
        }
        .task-alternatives li {
          margin: 4px 0;
        }
        .task-steps {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .task-step {
          border: 1px solid var(--border, rgba(255,255,255,0.08));
          border-radius: 10px;
          overflow: hidden;
          transition: border-color 0.2s;
        }
        .task-step.ready {
          border-color: color-mix(in srgb, var(--accent) 30%, transparent);
        }
        .task-step.completed {
          border-color: color-mix(in srgb, var(--success, #4caf50) 30%, transparent);
        }
        .task-step.failed {
          border-color: color-mix(in srgb, var(--error, #f44336) 30%, transparent);
        }
        .task-step-header {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 12px 14px;
          border: none;
          background: transparent;
          color: var(--text-primary);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          text-align: left;
          font-family: inherit;
        }
        .task-step-header:hover {
          background: var(--surface-hover, rgba(255,255,255,0.03));
        }
        .task-step-icon {
          font-size: 20px;
          flex-shrink: 0;
        }
        .task-step-label {
          flex: 1;
        }
        .task-step-chevron {
          font-size: 18px;
          color: var(--text-muted);
        }
        .task-step-body {
          padding: 0 14px 14px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .task-step-desc {
          font-size: 12px;
          color: var(--text-secondary);
          line-height: 1.5;
        }
        .task-step-inputs {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .task-input-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .task-input-label {
          font-size: 12px;
          font-weight: 500;
          color: var(--text-secondary);
        }
        .task-required {
          color: var(--error, #f44336);
          margin-left: 2px;
        }
        .task-input-help {
          font-size: 11px;
          color: var(--text-muted);
        }
        .task-select,
        .task-text-input {
          padding: 8px 10px;
          border: 1px solid var(--border, rgba(255,255,255,0.08));
          border-radius: 6px;
          background: var(--surface, rgba(0,0,0,0.2));
          color: var(--text-primary);
          font-size: 13px;
          font-family: inherit;
          outline: none;
          transition: border-color 0.2s;
        }
        .task-select:focus,
        .task-text-input:focus,
        .task-textarea:focus {
          border-color: var(--accent);
        }
        .task-textarea {
          padding: 10px;
          border: 1px solid var(--border, rgba(255,255,255,0.08));
          border-radius: 6px;
          background: var(--surface, rgba(0,0,0,0.2));
          color: var(--text-primary);
          font-size: 12px;
          font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
          line-height: 1.6;
          resize: vertical;
          outline: none;
          transition: border-color 0.2s;
        }
        .task-toggle-group {
          flex-direction: row;
          align-items: center;
          gap: 10px;
        }
        .task-toggle {
          width: 36px;
          height: 20px;
          border-radius: 10px;
          border: none;
          background: var(--border, rgba(255,255,255,0.15));
          cursor: pointer;
          position: relative;
          transition: background 0.2s;
          flex-shrink: 0;
        }
        .task-toggle.active {
          background: var(--accent);
        }
        .task-toggle-knob {
          position: absolute;
          top: 2px;
          left: 2px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: white;
          transition: transform 0.2s;
        }
        .task-toggle.active .task-toggle-knob {
          transform: translateX(16px);
        }
        .task-file-drop {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          padding: 20px;
          border: 2px dashed var(--border, rgba(255,255,255,0.12));
          border-radius: 8px;
          cursor: pointer;
          color: var(--text-muted);
          font-size: 12px;
          transition: border-color 0.2s, background 0.2s;
        }
        .task-file-drop:hover,
        .task-file-drop.dragover {
          border-color: var(--accent);
          background: color-mix(in srgb, var(--accent) 5%, transparent);
        }
        .task-file-drop .material-symbols-outlined {
          font-size: 28px;
          color: var(--accent);
        }
        .task-file-list {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-top: 6px;
        }
        .task-file-chip {
          padding: 2px 8px;
          background: color-mix(in srgb, var(--accent) 12%, transparent);
          border-radius: 4px;
          font-size: 11px;
          color: var(--accent);
        }
        .task-api-preview {
          font-size: 11px;
          color: var(--text-muted);
        }
        .task-api-preview summary {
          cursor: pointer;
          user-select: none;
        }
        .task-api-preview-code {
          margin-top: 6px;
          font-size: 11px;
        }
        .task-execute-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border: none;
          border-radius: 8px;
          background: var(--accent);
          color: white;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          font-family: inherit;
          transition: opacity 0.2s;
          align-self: flex-start;
        }
        .task-execute-btn:hover:not(:disabled) {
          opacity: 0.9;
        }
        .task-execute-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .task-execute-btn .material-symbols-outlined {
          font-size: 18px;
        }
        .task-executing {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: var(--accent);
          padding: 8px 0;
        }
        @keyframes task-spin {
          to { transform: rotate(360deg); }
        }
        .spinning {
          animation: task-spin 1s linear infinite;
        }
        .task-step-results {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .task-step-summary {
          font-size: 12px;
          font-weight: 500;
          padding: 6px 10px;
          border-radius: 6px;
        }
        .task-step-summary.success {
          color: var(--success, #4caf50);
          background: color-mix(in srgb, var(--success, #4caf50) 8%, transparent);
        }
        .task-step-summary.error {
          color: var(--error, #f44336);
          background: color-mix(in srgb, var(--error, #f44336) 8%, transparent);
        }
        .task-artifact {
          border: 1px solid var(--border, rgba(255,255,255,0.06));
          border-radius: 8px;
          overflow: hidden;
        }
        .task-artifact-error {
          border-color: color-mix(in srgb, var(--error, #f44336) 20%, transparent);
        }
        .task-artifact-label {
          font-size: 11px;
          font-weight: 500;
          color: var(--text-secondary);
          padding: 6px 10px;
          background: var(--surface-hover, rgba(255,255,255,0.03));
          border-bottom: 1px solid var(--border, rgba(255,255,255,0.06));
        }
        .task-code-block {
          padding: 10px;
          margin: 0;
          font-size: 12px;
          font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
          line-height: 1.6;
          color: var(--text-primary);
          overflow-x: auto;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .task-error-content {
          padding: 10px;
          font-size: 12px;
          color: var(--error, #f44336);
          line-height: 1.5;
        }
        .task-message-content {
          padding: 10px;
          font-size: 12px;
          color: var(--text-secondary);
          line-height: 1.5;
        }
        .task-diff {
          border: none;
        }
        .task-diff-panels {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1px;
          background: var(--border, rgba(255,255,255,0.06));
        }
        .task-diff-panel {
          background: var(--surface, rgba(0,0,0,0.2));
        }
        .task-diff-header {
          font-size: 11px;
          font-weight: 500;
          color: var(--text-muted);
          padding: 6px 10px;
          border-bottom: 1px solid var(--border, rgba(255,255,255,0.06));
        }
        .task-step-failed-actions {
          display: flex;
          gap: 8px;
        }
        .task-retry-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 12px;
          border: 1px solid var(--border, rgba(255,255,255,0.1));
          border-radius: 6px;
          background: transparent;
          color: var(--text-secondary);
          font-size: 12px;
          cursor: pointer;
          font-family: inherit;
          transition: background 0.2s;
        }
        .task-retry-btn:hover {
          background: var(--surface-hover, rgba(255,255,255,0.05));
        }
        .task-retry-btn .material-symbols-outlined {
          font-size: 16px;
        }
        .task-completion {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          padding-top: 8px;
          border-top: 1px solid var(--border, rgba(255,255,255,0.06));
        }
        .task-download-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border: none;
          border-radius: 8px;
          background: var(--accent);
          color: white;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          font-family: inherit;
          transition: opacity 0.2s;
        }
        .task-download-btn:hover {
          opacity: 0.9;
        }
        .task-download-btn .material-symbols-outlined {
          font-size: 16px;
        }
        .task-handoff-chip {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 12px;
          border: 1px solid var(--border, rgba(255,255,255,0.1));
          border-radius: 20px;
          background: transparent;
          color: var(--text-secondary);
          font-size: 12px;
          cursor: pointer;
          font-family: inherit;
          transition: background 0.2s, border-color 0.2s;
        }
        .task-handoff-chip:hover {
          background: var(--surface-hover, rgba(255,255,255,0.05));
          border-color: var(--accent);
          color: var(--accent);
        }
        .task-handoff-chip .material-symbols-outlined {
          font-size: 16px;
        }
      `}</style>
    </div>
  );
}
