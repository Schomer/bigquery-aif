# Reference Dataset

A working dataset for tracing router/orchestration scenarios against, built
from `bigquery-public-data.thelook_ecommerce` plus two small additions to
cover the gaps noted when choosing it.

---

## 1. Setup: copy core tables into your own project

`bigquery-public-data` is read-only, so Data Management/Data Loading tasks
need a writable copy. This also conveniently exercises "copy table" and
"create table from query" (CTAS) as step zero.

```sql
CREATE SCHEMA IF NOT EXISTS `PROJECT.ecommerce`;

CREATE TABLE `PROJECT.ecommerce.orders` AS
SELECT * FROM `bigquery-public-data.thelook_ecommerce.orders`;

CREATE TABLE `PROJECT.ecommerce.order_items` AS
SELECT *, CURRENT_TIMESTAMP() AS updated_at
FROM `bigquery-public-data.thelook_ecommerce.order_items`;

CREATE TABLE `PROJECT.ecommerce.products` AS
SELECT * FROM `bigquery-public-data.thelook_ecommerce.products`;

CREATE TABLE `PROJECT.ecommerce.users` AS
SELECT * FROM `bigquery-public-data.thelook_ecommerce.users`;
```

`order_items` gets an added `updated_at` column — the source dataset has no
generic "last modified" timestamp, and the Data Management dedup pattern
needs one for its tiebreaker (see below).

`distribution_centers` and `events` aren't copied — they stay queryable
directly from `bigquery-public-data.thelook_ecommerce.*` if a scenario
needs them, and having one table exist in both places (yours vs. public)
is itself a usable "compare two tables" fixture later.

---

## 2. Setup: inject duplicates (for Data Management dedup testing)

The source data is clean synthetic data with no duplicates by design —
this creates some, with a later `updated_at` so the tiebreaker logic in
the Data Management skill's `DEDUPE` pattern has something real to act on.

```sql
INSERT INTO `PROJECT.ecommerce.order_items`
SELECT * EXCEPT(updated_at), TIMESTAMP_ADD(updated_at, INTERVAL 1 DAY)
FROM `PROJECT.ecommerce.order_items`
WHERE id IN (
  SELECT id FROM `PROJECT.ecommerce.order_items` ORDER BY id LIMIT 15
);
```

Result: 15 duplicate groups (by `id`), 15 extra rows, each duplicate one
day "newer" than its original — "keep most recent by `updated_at`" has a
real answer.

---

## 3. Setup: synthetic `product_reviews` table (sentiment/translation)

Covers the two tasks the source dataset has nothing for. Built from real
`product_id`/`user_id` values already in your copied tables, so no
hardcoded IDs.

```sql
CREATE TABLE `PROJECT.ecommerce.product_reviews` AS
WITH sample_products AS (
  SELECT id AS product_id, ROW_NUMBER() OVER () AS rn
  FROM `PROJECT.ecommerce.products`
  LIMIT 8
),
sample_users AS (
  SELECT id AS user_id, ROW_NUMBER() OVER () AS rn
  FROM `PROJECT.ecommerce.users`
  LIMIT 8
),
review_text AS (
  SELECT * FROM UNNEST([
    STRUCT(1 AS rn, 5 AS rating, 'Absolutely love this — fits perfectly and the material feels premium.' AS review_text, 'en' AS language),
    STRUCT(2, 2, 'Sleeves run way too long and the zipper jammed within a week. Disappointed.', 'en'),
    STRUCT(3, 4, 'Good value for the price, though it runs a size small.', 'en'),
    STRUCT(4, 1, 'Arrived with a tear in the lining. Returning this.', 'en'),
    STRUCT(5, 5, 'Très confortable et chaud, parfait pour l\'hiver !', 'fr'),
    STRUCT(6, 3, 'Calidad decente pero el color es más claro de lo que se ve en la foto.', 'es'),
    STRUCT(7, 5, 'Exactly as described, fast shipping too.', 'en'),
    STRUCT(8, 2, 'Stitching came undone after light use.', 'en')
  ])
)
SELECT
  rn AS review_id,
  sp.product_id,
  su.user_id,
  rt.rating,
  rt.review_text,
  rt.language,
  TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL CAST(RAND() * 180 AS INT64) DAY) AS created_at
FROM review_text rt
JOIN sample_products sp USING (rn)
JOIN sample_users su USING (rn);
```

Mix is deliberate: 6 English (mix of positive/negative/neutral) + 1 French +
1 Spanish — enough for sentiment analysis to have variance, and translation
to have non-English input.

---

## 4. Schema reference

Column names below reflect the well-documented public schema, but **the
first real use of this dataset should be the Schema skill confirming it**
(`INFORMATION_SCHEMA.COLUMNS` against your copies) — both as a sanity check
on this doc and as the first live trace against real data.

### `orders` (PK: `order_id`)

| Column | Type | Notes |
|---|---|---|
| `order_id` | INT64 | PK |
| `user_id` | INT64 | FK → `users.id` |
| `status` | STRING | Cancelled / Returned / Complete / Processing / Shipped — funnel stages |
| `gender` | STRING | |
| `created_at` | TIMESTAMP | |
| `shipped_at` | TIMESTAMP | nullable |
| `delivered_at` | TIMESTAMP | nullable |
| `returned_at` | TIMESTAMP | nullable |
| `num_of_item` | INT64 | |

### `order_items` (PK: `id`)

| Column | Type | Notes |
|---|---|---|
| `id` | INT64 | PK |
| `order_id` | INT64 | FK → `orders.order_id` (note the naming asymmetry — `id` here, `order_id` there) |
| `user_id` | INT64 | FK → `users.id` |
| `product_id` | INT64 | FK → `products.id` |
| `inventory_item_id` | INT64 | |
| `status` | STRING | |
| `created_at` | TIMESTAMP | |
| `shipped_at` / `delivered_at` / `returned_at` | TIMESTAMP | nullable |
| `sale_price` | FLOAT64 | |
| `updated_at` | TIMESTAMP | **added in step 1** — dedup tiebreaker |

### `products` (PK: `id`)

| Column | Type | Notes |
|---|---|---|
| `id` | INT64 | PK |
| `cost` | FLOAT64 | |
| `category` | STRING | top-N, treemap, pivot candidates |
| `name` | STRING | |
| `brand` | STRING | |
| `retail_price` | FLOAT64 | |
| `department` | STRING | Men / Women |
| `sku` | STRING | |
| `distribution_center_id` | INT64 | FK → public `distribution_centers.id` (not copied) |

### `users` (PK: `id`)

| Column | Type | Notes |
|---|---|---|
| `id` | INT64 | PK |
| `first_name` / `last_name` / `email` | STRING | |
| `age` | INT64 | |
| `gender` | STRING | |
| `state` / `city` / `postal_code` / `country` | STRING | choropleth, USA/world map |
| `latitude` / `longitude` | FLOAT64 | dot map |
| `traffic_source` | STRING | cohort/segmentation |
| `created_at` | TIMESTAMP | signup date — cohort anchor |

### `product_reviews` (PK: `review_id`, new/synthetic)

| Column | Type | Notes |
|---|---|---|
| `review_id` | INT64 | PK |
| `product_id` | INT64 | FK → `products.id` |
| `user_id` | INT64 | FK → `users.id` |
| `rating` | INT64 | 1–5 |
| `review_text` | STRING | sentiment/translation input |
| `language` | STRING | `en` / `fr` / `es` |
| `created_at` | TIMESTAMP | |

---

## 5. What's deliberately left undone

- **No partitioning/clustering** on the copies — `orders.created_at` and
  `order_items.created_at` are natural candidates, but leaving them
  unpartitioned makes "partition this table" (Data Management §6) a real
  task with a real before/after rather than something pre-solved
- **No saved checks / schema snapshots yet** — these accumulate from use;
  the first Data Quality profile or dedup check run against this dataset
  becomes the first saved check / first schema snapshot
- **No lineage yet** — populates once views, CTAS outputs, or scheduled
  queries exist on top of this base; the copy operations in step 1 are
  technically the first lineage events once the Lineage API picks them up
