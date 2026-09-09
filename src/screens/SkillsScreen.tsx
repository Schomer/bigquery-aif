import { ActionBar, ActionBarTitle, Card } from "@/kit";

export function SkillsScreen() {
  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <ActionBar>
        <ActionBarTitle>Skills</ActionBarTitle>
      </ActionBar>
      <div className="p-6">
        <Card className="p-6">
          <h2 className="text-cm-title-medium text-cm-on-surface mb-2">Skills</h2>
          <p className="text-cm-body-medium text-cm-on-surface-variant">
            Manage custom capabilities, AI prompts, data transformations, and reusable skill packs for your assistants.
          </p>
        </Card>
      </div>
    </div>
  );
}
