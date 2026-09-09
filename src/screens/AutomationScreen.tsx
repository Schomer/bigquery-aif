import { ActionBar, ActionBarTitle, Card } from "@/kit";

export function AutomationScreen() {
  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <ActionBar>
        <ActionBarTitle>Automation</ActionBarTitle>
      </ActionBar>
      <div className="p-6">
        <Card className="p-6">
          <h2 className="text-cm-title-medium text-cm-on-surface mb-2">Automation</h2>
          <p className="text-cm-body-medium text-cm-on-surface-variant">
            Design and orchestrate automated data workflows, schedules, and agent pipelines across your cloud environment.
          </p>
        </Card>
      </div>
    </div>
  );
}
