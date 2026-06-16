# Visualization & Chart Type Mapping

Companion to the capability catalog's §15. Maps each visualization type to
the **result shape** that should trigger it and any BigQuery-side data
prep needed to produce that shape. This is the core lookup table for the
Composer step in the harness.

A "result shape" is described in terms of column roles: **dim** (dimension/
categorical or temporal), **measure** (numeric), and any special structure
(arrays, geography, hierarchical paths).

---

| Visualization | Result shape | Data prep notes |
|---|---|---|
| **Table** | Any shape, especially >20 rows or >3 columns | Default fallback when nothing more specific fits, or when the user explicitly asks for "the rows" |
| **KPI card** | 1 row, 1 measure (optionally + a prior-period value for delta) | Often two queries: current value + comparison period, combined into one card |
| **Bar chart** | 1 dim (categorical) + 1 measure, ≤ ~20 categories | Horizontal orientation — good for long category labels |
| **Column chart** | 1 dim (categorical, often short labels or time buckets) + 1 measure, ≤ ~20 categories | Vertical orientation — same data as bar, pick based on label length |
| **Line / time series** | 1 dim (date/time) + 1+ measures | Sort by time ascending; multiple measures → multi-series |
| **Area chart** | Same as line, but emphasizing magnitude or cumulative totals | Use `SUM() OVER (ORDER BY date)` for cumulative views; stacked area needs a second categorical dim |
| **Sparkline** | 1 measure, array of values over time, no axes shown | `ARRAY_AGG(value ORDER BY date)` in one query — compact enough to embed in a table cell or KPI card |
| **Pie / donut chart** | 1 dim (categorical) + 1 measure, ≤ ~6–8 categories, parts of a whole | If >8 categories, either roll up the tail into "Other" or switch to a bar chart — pie degrades fast with many slices |
| **Heatmap** | 2 dims (categorical or binned) + 1 measure — i.e. a matrix | e.g. day-of-week × hour-of-day, or a correlation matrix (Cramér's V, Pearson) between column pairs |
| **Scatter plot** | 2 measures (+ optional dim for color/grouping, optional 3rd measure for size) | For correlation/relationship questions between two numeric columns |
| **Gauge** | 1 row, 1 measure + defined min/max/target | Like a KPI card but framed against a range — needs explicit thresholds, often user- or business-defined rather than derived |
| **Funnel** | Ordered dim (stages) + 1 measure, monotonically non-increasing | Each stage = `COUNT(DISTINCT id)` of entities that reached that step — requires a query per stage or a single query with conditional aggregation |
| **Sankey** | Edge list: source dim, target dim, 1 measure (flow volume) | `GROUP BY source, target` — the *shape* itself signals Sankey (two categorical dims representing a flow, not a matrix) |
| **Treemap** | Hierarchical dims (1+ levels) + 1 measure (size) | `GROUP BY` at each level, or a single query with a path-like column (e.g. `category/subcategory`) |
| **Network graph** | Edge list: node A, node B, optional measure (edge weight) | Similar shape to Sankey but undirected/relationship-oriented rather than flow-oriented — distinguish by intent ("how are these related" vs. "where does volume go") |
| **Workflow / lineage diagram** | Directed graph: nodes (jobs/tables) + edges (dependencies) | Comes from the Data Lineage API (§13) rather than a BQ query — different data source than the rest of this table |
| **Dot map** | lat/lng (or `GEOGRAPHY` point) + optional measure for size/color | Requires actual coordinates — geocode first if the source data only has addresses (§14) |
| **Choropleth map** | Region code (state/country/zip) + 1 measure | General term covering USA/world map below — color intensity by measure value per region |
| **USA map** | US state code (2-letter or FIPS) + 1 measure | Choropleth scoped to US states |
| **World map** | ISO country code + 1 measure | Choropleth scoped to countries |
| **Comparison view** | Two of any of the above shapes, same structure, different filter (time period, segment, etc.) | Not a new chart type — render the *same* component twice side-by-side or overlaid; the Composer's job is recognizing "compare X vs Y" intent and running two queries with the diff applied to one dimension (usually time or segment) |

---

## Selection notes

- **Bar vs. column vs. pie**: all three can represent the same
  `1 dim + 1 measure` shape. Default to column for time-like or short
  categorical labels, bar for long labels or many categories, pie only for
  few categories where "share of whole" is the actual question (not just
  "compare these values" — that's bar/column).

- **Line vs. area**: same shape, different emphasis. Area implies "how big
  is this" or "how does this accumulate"; line implies "how does this
  change/trend."

- **Geographic types share one data requirement** (region code or lat/lng
  + measure) — the choice between USA map / world map / choropleth / dot
  map is about the *granularity* of the region code, not the data shape
  itself. Dot map is the odd one out since it needs point coordinates
  rather than region codes.

- **Sankey vs. network graph vs. workflow diagram** all share an
  edge-list-like shape but differ in *what the edges mean*: flow volume
  between stages (Sankey), general relationships (network graph), or
  process dependencies from lineage data (workflow diagram). Get this from
  user intent, not from the data shape alone.

- **When in doubt, table.** Every shape above degrades gracefully to a
  table — use it as the fallback whenever the Composer isn't confident
  about a more specific type, or when the user explicitly asks for "the
  data" / "the rows."
