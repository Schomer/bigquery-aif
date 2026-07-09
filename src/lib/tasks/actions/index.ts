// src/lib/tasks/actions/index.ts
// Pre-coded action shortcuts that bypass the full 2-phase resolver for
// well-known BigQuery operations. Each shortcut matches on keywords and
// builds a ResolvedPlan directly without any LLM call.

import type { ResolvedPlan } from '../types';

// -- Action shortcut interface --

interface ActionShortcut {
  id: string;
  label: string;
  description: string;
  keywords: string[];
  buildPlan: (params: { project: string; location: string; message: string }) => ResolvedPlan;
}

// -- Registry --

const shortcuts: ActionShortcut[] = [
  {
    id: 'create-dataset',
    label: 'Create Dataset',
    description: 'Create a new BigQuery dataset',
    keywords: ['create dataset', 'new dataset', 'create a dataset', 'make dataset', 'add dataset'],
    buildPlan: ({ project, location }) => ({
      title: 'Create BigQuery Dataset',
      description: 'Creates a new dataset in the specified project.',
      approach: 'Single API call to datasets.insert.',
      steps: [
        {
          id: 'create-dataset-1',
          label: 'Create dataset',
          description: 'Insert a new dataset via the BigQuery API.',
          apiCall: {
            url: `https://bigquery.googleapis.com/bigquery/v2/projects/{project}/datasets`,
            method: 'POST',
            bodyTemplate: {
              datasetReference: {
                projectId: project,
                datasetId: '{datasetId}',
              },
              location: location,
              description: '{description}',
            },
          },
          inputs: [
            {
              name: 'datasetId',
              type: 'text',
              label: 'Dataset name',
              required: true,
              placeholder: 'my_new_dataset',
              helpText: 'Must be unique within the project. Use letters, numbers, and underscores only.',
              mapsTo: 'datasetId',
            },
            {
              name: 'description',
              type: 'text',
              label: 'Description (optional)',
              required: false,
              placeholder: 'A brief description of this dataset',
              mapsTo: 'body.description',
            },
          ],
        },
      ],
    }),
  },

  {
    id: 'create-table-from-query',
    label: 'Create Table from Query',
    description: 'Save query results as a new table',
    keywords: ['create table from query', 'save query as table', 'save results as table', 'query into table', 'create table as select', 'ctas'],
    buildPlan: ({ project, location }) => ({
      title: 'Create Table from Query Results',
      description: 'Runs a query and writes the results to a new destination table.',
      approach: 'Submit a BigQuery job with a destination table and WRITE_TRUNCATE disposition.',
      steps: [
        {
          id: 'create-table-query-1',
          label: 'Run query into destination table',
          description: 'Execute a query job that writes results to a new table.',
          apiCall: {
            url: `https://bigquery.googleapis.com/bigquery/v2/projects/{project}/jobs`,
            method: 'POST',
            bodyTemplate: {
              configuration: {
                query: {
                  query: '{sql}',
                  destinationTable: {
                    projectId: project,
                    datasetId: '{destinationDataset}',
                    tableId: '{destinationTable}',
                  },
                  writeDisposition: 'WRITE_TRUNCATE',
                  useLegacySql: false,
                },
              },
              jobReference: {
                projectId: project,
                location: location,
              },
            },
          },
          inputs: [
            {
              name: 'sql',
              type: 'textarea',
              label: 'SQL query',
              required: true,
              placeholder: 'SELECT * FROM ...',
              helpText: 'The query whose results will populate the new table.',
              mapsTo: 'body.configuration.query.query',
            },
            {
              name: 'destinationDataset',
              type: 'text',
              label: 'Destination dataset',
              required: true,
              placeholder: 'my_dataset',
              mapsTo: 'body.configuration.query.destinationTable.datasetId',
            },
            {
              name: 'destinationTable',
              type: 'text',
              label: 'Destination table name',
              required: true,
              placeholder: 'new_table',
              mapsTo: 'body.configuration.query.destinationTable.tableId',
            },
          ],
        },
      ],
    }),
  },

  {
    id: 'export-to-gcs',
    label: 'Export to GCS',
    description: 'Export a BigQuery table to Google Cloud Storage',
    keywords: ['export to gcs', 'export to bucket', 'export to cloud storage', 'export table to gcs', 'extract to gcs'],
    buildPlan: ({ project, location }) => ({
      title: 'Export Table to Cloud Storage',
      description: 'Extracts a BigQuery table to a GCS bucket as CSV.',
      approach: 'Submit a BigQuery extract job targeting a GCS URI.',
      steps: [
        {
          id: 'export-gcs-1',
          label: 'Export table to GCS',
          description: 'Run an extract job to write table data to Cloud Storage.',
          apiCall: {
            url: `https://bigquery.googleapis.com/bigquery/v2/projects/{project}/jobs`,
            method: 'POST',
            bodyTemplate: {
              configuration: {
                extract: {
                  sourceTable: {
                    projectId: project,
                    datasetId: '{sourceDataset}',
                    tableId: '{sourceTable}',
                  },
                  destinationUris: ['{gcsUri}'],
                  destinationFormat: '{format}',
                  compression: 'NONE',
                },
              },
              jobReference: {
                projectId: project,
                location: location,
              },
            },
          },
          inputs: [
            {
              name: 'sourceDataset',
              type: 'text',
              label: 'Source dataset',
              required: true,
              placeholder: 'my_dataset',
              mapsTo: 'body.configuration.extract.sourceTable.datasetId',
            },
            {
              name: 'sourceTable',
              type: 'text',
              label: 'Source table',
              required: true,
              placeholder: 'my_table',
              mapsTo: 'body.configuration.extract.sourceTable.tableId',
            },
            {
              name: 'gcsUri',
              type: 'text',
              label: 'GCS destination URI',
              required: true,
              placeholder: 'gs://my-bucket/export/*.csv',
              helpText: 'Use wildcard (*) for sharded export. Example: gs://bucket/path/file-*.csv',
              mapsTo: 'body.configuration.extract.destinationUris',
            },
            {
              name: 'format',
              type: 'select',
              label: 'Export format',
              required: true,
              defaultValue: 'CSV',
              options: [
                { value: 'CSV', label: 'CSV' },
                { value: 'NEWLINE_DELIMITED_JSON', label: 'JSON (newline-delimited)' },
                { value: 'AVRO', label: 'Avro' },
                { value: 'PARQUET', label: 'Parquet' },
              ],
              mapsTo: 'body.configuration.extract.destinationFormat',
            },
          ],
        },
      ],
    }),
  },

  {
    id: 'schedule-query',
    label: 'Schedule Query',
    description: 'Create a scheduled query via Data Transfer Service',
    keywords: ['schedule query', 'scheduled query', 'run daily', 'run this daily', 'run weekly', 'schedule this query', 'recurring query', 'cron query'],
    buildPlan: ({ project, location }) => ({
      title: 'Create Scheduled Query',
      description: 'Sets up a recurring scheduled query via the BigQuery Data Transfer Service.',
      approach: 'Create a transfer config with data_source_id=scheduled_query.',
      steps: [
        {
          id: 'schedule-query-1',
          label: 'Create scheduled query',
          description: 'Register a scheduled query transfer configuration.',
          apiCall: {
            url: `https://bigquerydatatransfer.googleapis.com/v1/projects/{project}/locations/${location}/transferConfigs`,
            method: 'POST',
            bodyTemplate: {
              displayName: '{displayName}',
              dataSourceId: 'scheduled_query',
              schedule: '{schedule}',
              params: {
                query: '{sql}',
                write_disposition: 'WRITE_TRUNCATE',
              },
              destinationDatasetId: '{destinationDataset}',
            },
          },
          inputs: [
            {
              name: 'displayName',
              type: 'text',
              label: 'Schedule name',
              required: true,
              placeholder: 'Daily sales summary',
              mapsTo: 'body.displayName',
            },
            {
              name: 'sql',
              type: 'textarea',
              label: 'SQL query',
              required: true,
              placeholder: 'SELECT * FROM ...',
              mapsTo: 'body.params.query',
            },
            {
              name: 'schedule',
              type: 'text',
              label: 'Schedule (cron format)',
              required: true,
              placeholder: 'every 24 hours',
              helpText: 'Examples: "every 24 hours", "every monday 09:00"',
              mapsTo: 'body.schedule',
            },
            {
              name: 'destinationDataset',
              type: 'text',
              label: 'Destination dataset',
              required: true,
              placeholder: 'my_dataset',
              mapsTo: 'body.destinationDatasetId',
            },
          ],
        },
      ],
    }),
  },

  {
    id: 'copy-table',
    label: 'Copy Table',
    description: 'Copy a BigQuery table to a new location',
    keywords: ['copy table', 'duplicate table', 'clone table', 'copy a table'],
    buildPlan: ({ project, location }) => ({
      title: 'Copy BigQuery Table',
      description: 'Copies a source table to a new destination table.',
      approach: 'Submit a BigQuery copy job.',
      steps: [
        {
          id: 'copy-table-1',
          label: 'Copy table',
          description: 'Run a copy job to duplicate the table.',
          apiCall: {
            url: `https://bigquery.googleapis.com/bigquery/v2/projects/{project}/jobs`,
            method: 'POST',
            bodyTemplate: {
              configuration: {
                copy: {
                  sourceTable: {
                    projectId: project,
                    datasetId: '{sourceDataset}',
                    tableId: '{sourceTable}',
                  },
                  destinationTable: {
                    projectId: project,
                    datasetId: '{destinationDataset}',
                    tableId: '{destinationTable}',
                  },
                  writeDisposition: 'WRITE_TRUNCATE',
                },
              },
              jobReference: {
                projectId: project,
                location: location,
              },
            },
          },
          inputs: [
            {
              name: 'sourceDataset',
              type: 'text',
              label: 'Source dataset',
              required: true,
              placeholder: 'my_dataset',
              mapsTo: 'body.configuration.copy.sourceTable.datasetId',
            },
            {
              name: 'sourceTable',
              type: 'text',
              label: 'Source table',
              required: true,
              placeholder: 'original_table',
              mapsTo: 'body.configuration.copy.sourceTable.tableId',
            },
            {
              name: 'destinationDataset',
              type: 'text',
              label: 'Destination dataset',
              required: true,
              placeholder: 'my_dataset',
              mapsTo: 'body.configuration.copy.destinationTable.datasetId',
            },
            {
              name: 'destinationTable',
              type: 'text',
              label: 'Destination table name',
              required: true,
              placeholder: 'table_copy',
              mapsTo: 'body.configuration.copy.destinationTable.tableId',
            },
          ],
        },
      ],
    }),
  },

  {
    id: 'delete-table',
    label: 'Delete Table',
    description: 'Delete a BigQuery table (with confirmation)',
    keywords: ['delete table', 'drop table', 'remove table', 'delete a table'],
    buildPlan: ({ project }) => ({
      title: 'Delete BigQuery Table',
      description: 'Permanently deletes a table from BigQuery. This action cannot be undone.',
      approach: 'Single DELETE call to the tables endpoint. Requires user confirmation before execution.',
      steps: [
        {
          id: 'delete-table-1',
          label: 'Delete table',
          description: 'Permanently remove the specified table.',
          apiCall: {
            url: `https://bigquery.googleapis.com/bigquery/v2/projects/{project}/datasets/{datasetId}/tables/{tableId}`,
            method: 'DELETE',
          },
          inputs: [
            {
              name: 'datasetId',
              type: 'text',
              label: 'Dataset',
              required: true,
              placeholder: 'my_dataset',
              mapsTo: 'datasetId',
            },
            {
              name: 'tableId',
              type: 'text',
              label: 'Table to delete',
              required: true,
              placeholder: 'table_to_remove',
              helpText: 'This will permanently delete the table and all its data.',
              mapsTo: 'tableId',
            },
          ],
        },
      ],
    }),
  },

  {
    id: 'grant-access',
    label: 'Grant Dataset Access',
    description: 'Grant IAM access to a BigQuery dataset',
    keywords: ['grant access', 'share dataset', 'add permissions', 'give access', 'dataset permissions', 'share access'],
    buildPlan: ({ project }) => ({
      title: 'Grant Dataset Access',
      description: 'Adds an access entry to a BigQuery dataset to share it with a user, group, or service account.',
      approach: 'PATCH the dataset resource to append a new access entry.',
      steps: [
        {
          id: 'grant-access-1',
          label: 'Update dataset access',
          description: 'Patch the dataset to add a new access control entry.',
          apiCall: {
            url: `https://bigquery.googleapis.com/bigquery/v2/projects/{project}/datasets/{datasetId}`,
            method: 'PATCH',
            bodyTemplate: {
              access: [
                {
                  role: '{role}',
                  userByEmail: '{email}',
                },
              ],
            },
          },
          inputs: [
            {
              name: 'datasetId',
              type: 'text',
              label: 'Dataset',
              required: true,
              placeholder: 'my_dataset',
              mapsTo: 'datasetId',
            },
            {
              name: 'email',
              type: 'text',
              label: 'Email address',
              required: true,
              placeholder: 'user@example.com',
              helpText: 'The email of the user, group, or service account to grant access to.',
              mapsTo: 'body.access[0].userByEmail',
            },
            {
              name: 'role',
              type: 'select',
              label: 'Access level',
              required: true,
              defaultValue: 'READER',
              options: [
                { value: 'READER', label: 'Viewer (read-only)' },
                { value: 'WRITER', label: 'Editor (read/write)' },
                { value: 'OWNER', label: 'Owner (full control)' },
              ],
              mapsTo: 'body.access[0].role',
            },
          ],
        },
      ],
    }),
  },
];

// -- Matching --

/**
 * Try to match a user message against registered action shortcuts.
 * Uses case-insensitive substring matching on the keyword phrases.
 * Returns the first matching shortcut, or null if none match.
 */
export function matchShortcut(message: string): ActionShortcut | null {
  const lower = message.toLowerCase();
  for (const shortcut of shortcuts) {
    for (const keyword of shortcut.keywords) {
      if (lower.includes(keyword)) {
        return shortcut;
      }
    }
  }
  return null;
}

/**
 * Get all registered action shortcuts (for UI display or help).
 */
export function getShortcuts(): ActionShortcut[] {
  return [...shortcuts];
}
