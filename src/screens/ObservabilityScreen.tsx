import { ActionBar, ActionBarTitle, Card } from "@/kit";

export function ObservabilityScreen() {
  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <ActionBar>
        <ActionBarTitle>Observability</ActionBarTitle>
      </ActionBar>
      <div className="p-6">
        <Card className="p-6">
          <h2 className="text-cm-title-medium text-cm-on-surface mb-2">Observability</h2>
          <p className="text-cm-body-medium text-cm-on-surface-variant">
            Monitor pipeline execution telemetry, data freshness metrics, cost tracking, and system health status.
          </p>
        </Card>
      </div>
    </div>
  );
}
