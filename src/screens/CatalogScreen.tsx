import { ActionBar, ActionBarTitle, Card } from "@/kit";

export function CatalogScreen() {
  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <ActionBar>
        <ActionBarTitle>Catalog</ActionBarTitle>
      </ActionBar>
      <div className="p-6">
        <Card className="p-6">
          <h2 className="text-cm-title-medium text-cm-on-surface mb-2">Catalog</h2>
          <p className="text-cm-body-medium text-cm-on-surface-variant">
            Discover, search, and manage data assets, tables, schemas, and lineage across your organization.
          </p>
        </Card>
      </div>
    </div>
  );
}
