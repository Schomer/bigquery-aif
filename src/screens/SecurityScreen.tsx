import { ActionBar, ActionBarTitle, Card } from "@/kit";

export function SecurityScreen() {
  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <ActionBar>
        <ActionBarTitle>Security & governance</ActionBarTitle>
      </ActionBar>
      <div className="p-6">
        <Card className="p-6">
          <h2 className="text-cm-title-medium text-cm-on-surface mb-2">Security & governance</h2>
          <p className="text-cm-body-medium text-cm-on-surface-variant">
            Manage access controls, data classification tags, audit compliance policies, and governance guardrails.
          </p>
        </Card>
      </div>
    </div>
  );
}
