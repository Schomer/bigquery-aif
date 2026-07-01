# Cloud Storage (GCS) API

Service endpoint: `storage.googleapis.com`
API version: `v1`
Required IAM role: `roles/storage.objectAdmin` (read/write objects), `roles/storage.admin` (bucket management)
Required API: `Cloud Storage API` (enabled by default on all projects)

---

## Object Upload

### Simple Upload (objects up to 5 MB)

For small objects. Content is sent directly in the request body.

```
POST https://storage.googleapis.com/upload/storage/v1/b/{bucket}/o?uploadType=media&name={object_name}
Content-Type: text/csv

<file contents>
```

**Query parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `uploadType` | string | Yes | Must be `media` for simple upload. |
| `name` | string | Yes | Object name (path within bucket). Example: `data/input/file.csv` |
| `predefinedAcl` | string | No | Predefined ACL. Values: `private`, `publicRead`, `bucketOwnerFullControl`, etc. |
| `ifGenerationMatch` | long | No | Only upload if the current generation matches. Use `0` to ensure the object does not already exist. |

**Response:**

```json
{
  "kind": "storage#object",
  "id": "my-bucket/data/input/file.csv/1718438400000000",
  "selfLink": "https://storage.googleapis.com/storage/v1/b/my-bucket/o/data%2Finput%2Ffile.csv",
  "name": "data/input/file.csv",
  "bucket": "my-bucket",
  "generation": "1718438400000000",
  "metageneration": "1",
  "contentType": "text/csv",
  "timeCreated": "2025-06-15T10:00:00.000Z",
  "updated": "2025-06-15T10:00:00.000Z",
  "size": "1048576",
  "md5Hash": "xMpCOKC5I4INzFCab3WEmw==",
  "crc32c": "AAAAAA==",
  "storageClass": "STANDARD"
}
```

### Multipart Upload (objects up to 5 MB, with metadata)

Send metadata and data in a single multipart request.

```
POST https://storage.googleapis.com/upload/storage/v1/b/{bucket}/o?uploadType=multipart
Content-Type: multipart/related; boundary=boundary_string

--boundary_string
Content-Type: application/json

{"name": "data/input/file.csv", "contentType": "text/csv", "metadata": {"source": "etl-pipeline"}}
--boundary_string
Content-Type: text/csv

col1,col2
val1,val2
--boundary_string--
```

### Resumable Upload (objects of any size, recommended for > 5 MB)

Two-step process: initiate, then upload in chunks.

**Step 1: Initiate**

```
POST https://storage.googleapis.com/upload/storage/v1/b/{bucket}/o?uploadType=resumable&name={object_name}
Content-Type: application/json
X-Upload-Content-Type: application/octet-stream
X-Upload-Content-Length: 104857600

{"name": "data/large_file.parquet", "contentType": "application/octet-stream"}
```

**Response:** HTTP 200 with `Location` header containing the resumable upload URI.

**Step 2: Upload data**

```
PUT {resumable_upload_uri}
Content-Length: 104857600
Content-Type: application/octet-stream

<file contents>
```

For chunked upload, send data in 256 KB-aligned chunks using `Content-Range` headers:

```
PUT {resumable_upload_uri}
Content-Length: 262144
Content-Range: bytes 0-262143/104857600

<chunk 1 data>
```

Continue sending chunks until complete. Final chunk:

```
PUT {resumable_upload_uri}
Content-Length: 131072
Content-Range: bytes 104726528-104857599/104857600

<final chunk data>
```

**Check upload status (if interrupted):**

```
PUT {resumable_upload_uri}
Content-Length: 0
Content-Range: bytes */104857600
```

Response includes a `Range` header indicating bytes received so far.

---

## Object Download

### Download Object

```
GET https://storage.googleapis.com/storage/v1/b/{bucket}/o/{object}?alt=media
```

The `alt=media` parameter is required to get the object data instead of metadata.

URL-encode the object name: `data/input/file.csv` becomes `data%2Finput%2Ffile.csv`.

**Range download (partial content):**

```
GET https://storage.googleapis.com/storage/v1/b/{bucket}/o/{object}?alt=media
Range: bytes=0-1048575
```

### Get Object Metadata (without downloading)

```
GET https://storage.googleapis.com/storage/v1/b/{bucket}/o/{object}
```

Returns the object resource JSON (same as upload response) without the file contents.

---

## Object Listing

### List Objects in Bucket

```
GET https://storage.googleapis.com/storage/v1/b/{bucket}/o
```

**Query parameters:**

| Param | Type | Description |
|---|---|---|
| `prefix` | string | Filter objects by name prefix. Example: `data/2025/` |
| `delimiter` | string | Delimiter for directory-like listing. Typically `/`. |
| `maxResults` | int | Max objects per page (default 1000). |
| `pageToken` | string | Pagination token. |
| `startOffset` | string | Only return objects with names lexicographically >= this value. |
| `endOffset` | string | Only return objects with names lexicographically < this value. |
| `includeTrailingDelimiter` | boolean | Include objects that end with the delimiter. |
| `projection` | string | `noAcl` (default) or `full` (include ACL info). |
| `matchGlob` | string | Glob pattern filter. Example: `**.csv` for all CSV files. |

**Response:**

```json
{
  "kind": "storage#objects",
  "items": [
    {
      "name": "data/2025/sales_jan.csv",
      "bucket": "my-bucket",
      "size": "52428800",
      "timeCreated": "2025-01-15T10:00:00.000Z",
      "contentType": "text/csv"
    }
  ],
  "prefixes": ["data/2025/archive/"],
  "nextPageToken": "CgRkYXRh"
}
```

`prefixes` contains "directory" entries when using a `delimiter`. `nextPageToken` is present if more results exist.

---

## Object Composition

Combine up to 32 existing objects into a single new object (server-side, no data transfer).

```
POST https://storage.googleapis.com/storage/v1/b/{bucket}/o/{destination_object}/compose
```

```json
{
  "sourceObjects": [
    { "name": "data/part_001.csv" },
    { "name": "data/part_002.csv" },
    { "name": "data/part_003.csv" }
  ],
  "destination": {
    "contentType": "text/csv"
  }
}
```

Objects are concatenated in the order listed. Maximum 32 source objects per compose call. For more than 32, compose in multiple stages (compose 32, then compose those results).

---

## Object Delete

```
DELETE https://storage.googleapis.com/storage/v1/b/{bucket}/o/{object}
```

**Query parameters:**
- `ifGenerationMatch` (long): Only delete if generation matches (optimistic concurrency).

---

## Object Copy

Server-side copy of an object to a new location (same or different bucket).

```
POST https://storage.googleapis.com/storage/v1/b/{source_bucket}/o/{source_object}/copyTo/b/{dest_bucket}/o/{dest_object}
```

Optional request body to set destination metadata:

```json
{
  "contentType": "text/csv",
  "metadata": {
    "copied_from": "source_bucket/original.csv"
  }
}
```

For objects larger than 5 GB, use the Rewrite API instead:

```
POST https://storage.googleapis.com/storage/v1/b/{source_bucket}/o/{source_object}/rewriteTo/b/{dest_bucket}/o/{dest_object}
```

Rewrite may require multiple calls. Check `done` field in response; if `false`, repeat with the `rewriteToken`.

---

## Bucket Management

### Create Bucket

```
POST https://storage.googleapis.com/storage/v1/b?project={project}
```

```json
{
  "name": "my-unique-bucket-name",
  "location": "US",
  "storageClass": "STANDARD",
  "iamConfiguration": {
    "uniformBucketLevelAccess": {
      "enabled": true
    }
  },
  "lifecycle": {
    "rule": [
      {
        "action": { "type": "Delete" },
        "condition": { "age": 365 }
      },
      {
        "action": { "type": "SetStorageClass", "storageClass": "COLDLINE" },
        "condition": { "age": 90 }
      }
    ]
  }
}
```

**Storage class values:** `STANDARD`, `NEARLINE`, `COLDLINE`, `ARCHIVE`
**Location values:** `US`, `EU`, `ASIA`, or specific regions like `us-central1`, `europe-west1`

### Get Bucket

```
GET https://storage.googleapis.com/storage/v1/b/{bucket}
```

### List Buckets

```
GET https://storage.googleapis.com/storage/v1/b?project={project}
```

### Update Bucket

```
PATCH https://storage.googleapis.com/storage/v1/b/{bucket}
```

### Delete Bucket

```
DELETE https://storage.googleapis.com/storage/v1/b/{bucket}
```

Bucket must be empty before deletion.

---

## Signed URLs

Signed URLs provide time-limited access to objects without requiring authentication. Generated client-side using a service account key -- not a REST API call, but a signing operation.

### V4 Signing Process

1. Construct the canonical request string
2. Create the string-to-sign using the canonical request hash
3. Sign with the service account private key (RSA-SHA256)
4. Construct the URL with query parameters

**Signed URL format:**

```
https://storage.googleapis.com/{bucket}/{object}?
  X-Goog-Algorithm=GOOG4-RSA-SHA256&
  X-Goog-Credential={service_account_email}%2F{date}%2F{location}%2Fstorage%2Fgoog4_request&
  X-Goog-Date={timestamp}&
  X-Goog-Expires={seconds}&
  X-Goog-SignedHeaders=host&
  X-Goog-Signature={signature}
```

**Alternative: Use the IAM signBlob API** to sign without needing the private key locally:

```
POST https://iam.googleapis.com/v1/projects/-/serviceAccounts/{service_account_email}:signBlob
```

```json
{
  "payload": "<base64-encoded string-to-sign>"
}
```

Maximum expiration: 7 days (604800 seconds) for V4 signed URLs.

---

## Common Errors

| Error | Cause | Fix |
|---|---|---|
| `404 Not Found` | Bucket or object does not exist | Verify bucket name and object path. Object names are case-sensitive. |
| `403 Forbidden` | Missing IAM permissions | Grant `roles/storage.objectViewer` for reads, `roles/storage.objectCreator` for writes. |
| `409 Conflict` | Bucket name already taken (globally unique) | Choose a different bucket name. |
| `400 Bad Request: Invalid upload type` | Wrong `uploadType` parameter | Use `media`, `multipart`, or `resumable`. |
| `413 Request Entity Too Large` | Simple upload exceeds 5 MB limit | Use resumable upload for files over 5 MB. |
| `416 Range Not Satisfiable` | Range header exceeds object size | Check object size before requesting a range. |
| Resumable upload `404` | Upload URI expired (24 hour TTL) | Re-initiate the resumable upload. |
