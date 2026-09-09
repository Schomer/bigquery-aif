import { ActionBar, ActionBarTitle, Card } from "@/kit";

export function InfrastructureScreen() {
  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <ActionBar>
        <ActionBarTitle>Infrastructure</ActionBarTitle>
      </ActionBar>
      <div className="p-6">
        <Card className="p-6">
          <h2 className="text-cm-title-medium text-cm-on-surface mb-2">Infrastructure</h2>
          <p className="text-cm-body-medium text-cm-on-surface-variant">
            Configure compute engines, serverless clusters, storage buckets, and networking connectivity.
          </p>
        </Card>
      </div>
    </div>
  );
}
