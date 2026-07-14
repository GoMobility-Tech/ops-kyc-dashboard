# Ops Dashboard — API Implementation Guide

Frontend contract for the ops dashboard (My Drivers + All Drivers + super_admin controls).

**Base URL:** `https://api.gomobility.co.in/api/v1`
**Auth:** `Authorization: Bearer <access_token>` on every call unless noted "public".

---

## 0. Design Contract — Read First

- **Dashboard modules are display-only.** Backend returns `modules` on login; frontend renders the sidebar from that. Backend does **NOT** 403 an endpoint because the module isn't granted — role check is the enforcement. You decide UI visibility from `modules`.
- **`admin` / `super_admin`** get the full module catalog (synthetic) — sidebar shows everything.
- **`ops_team`** gets only the modules a super_admin has granted them.
- Only one sensitive action has an **extra token layer**: OTP view. Details below.

---

## 1. Auth

### 1.1 Login (ops / admin / super_admin)

`POST /auth/ops/login`

Request:
```json
{ "email": "ops@example.com", "password": "...", "device_info": { "deviceId": "web-abc", "deviceType": "web" } }
```

Response:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGci...",
    "user": {
      "id": "uuid",
      "email": "ops@example.com",
      "fullName": "Ops Person",
      "phone": "+91...",
      "role": "ops_team",
      "isVerified": true,
      "lastLogin": "2026-07-15T09:12:00.000+05:30"
    },
    "modules": [
      {
        "key": "my_drivers",
        "label": "My Drivers",
        "description": "Own drivers workspace — drivers you registered or uploaded documents for, with KYC progress and next-action hints.",
        "icon": "user-check",
        "sortOrder": 10
      },
      {
        "key": "all_drivers",
        "label": "All Drivers",
        "description": "Full driver directory — search any driver, view details, upload documents on behalf, approve or reject, verify KYC, view active OTP.",
        "icon": "users",
        "sortOrder": 20
      }
    ]
  }
}
```

**Sidebar rendering:** Loop through `modules` (already sorted by `sortOrder`). Use `label` as the entry text, `icon` as the icon key. `key` maps to the internal route the frontend renders.

### 1.2 Fetch current user's modules (refresh)

`GET /admin/dashboard-modules/me`
- Same shape as `modules` above.
- Use if you don't want to refetch login (e.g., after a super_admin grant change).

---

## 2. Modules Catalog

### 2.1 Frontend routing convention

Given a module key, the frontend renders:

| Module key    | Frontend route      | Backend APIs consumed |
|---------------|---------------------|-----------------------|
| `my_drivers`  | `/my-drivers`       | Section 3 endpoints   |
| `all_drivers` | `/all-drivers`      | Section 4 + 5 + 6 endpoints |

If a new module key arrives that the frontend doesn't understand, **skip it silently** (don't crash) — backend can ship new modules ahead of the frontend.

### 2.2 super_admin catalog editor

`GET /admin/dashboard-modules/catalog?includeInactive=1`
- Returns every catalog row (active + soft-disabled).
- `admin`+ can read; only `super_admin` can mutate.

Response:
```json
{
  "success": true,
  "data": {
    "modules": [
      { "key": "my_drivers", "label": "My Drivers", "description": "...", "icon": "user-check", "sortOrder": 10, "isActive": true },
      { "key": "all_drivers", "label": "All Drivers", "description": "...", "icon": "users", "sortOrder": 20, "isActive": true }
    ]
  }
}
```

`PATCH /admin/dashboard-modules/catalog/:moduleKey` — **super_admin only**

Body (all fields optional; only sent fields are updated):
```json
{ "label": "Naye Drivers", "description": "...", "icon": "user-plus", "sortOrder": 5, "isActive": true }
```

Use case: rename the sidebar entry, swap icon, reorder, or soft-hide a module without a backend deploy.

---

## 3. Module: `my_drivers`

Ops agent's own workspace — drivers **they registered** or **uploaded any doc for**.

### 3.1 Stats card

`GET /ops/me/stats`

Response:
```json
{
  "success": true,
  "data": {
    "totalDrivers": 42,
    "byOverallStatus": {
      "not_started": 3, "in_progress": 12, "pending_review": 4,
      "verified": 20, "rejected": 2, "suspended": 1
    }
  }
}
```

### 3.2 Driver list (paginated)

`GET /ops/me/drivers?status=in_progress&search=irshad&page=1&limit=20`

Query params (all optional):
- `status` — one of `not_started | in_progress | pending_review | verified | rejected | suspended | all`
- `search` — matches on phone, full name, email, go_id
- `page`, `limit` — defaults `1`, `20`

Response (per row):
```json
{
  "userId": "uuid",
  "goId": "GO-DRV-123",
  "fullName": "...",
  "phone": "+91...",
  "overallStatus": "in_progress",
  "docBreakdown": { "aadhaar": "verified", "pan": "verified", "dl": "pending", "rc": "not_started", "selfie": "not_started", "bank": "not_started" },
  "nextAction": "upload_dl",
  "missingDocs": ["dl", "rc", "selfie", "bank"],
  "stagedDocs": ["dl"],
  "completionPct": 33,
  "latestBatchId": null,
  "createdAt": "..."
}
```

Render `nextAction` as the primary CTA on each row.

### 3.3 Single driver workspace

`GET /ops/me/drivers/:userId`

Response is a single row with the same shape as 3.2 **plus** `extractedData` and `fileUrls` (S3 presigned) per doc for preview. Use this on the "resume onboarding" screen.

---

## 4. Module: `all_drivers` — Directory + Search

### 4.1 List all drivers

`GET /kyc/admin/drivers?status=in_progress&page=1&limit=20&search=...`

Same query params + row shape as 3.2, but returns **all drivers**, not just the agent's own.

### 4.2 Driver detail

`GET /kyc/admin/drivers/:userId`

Response (relevant fields):
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...", "goId": "...", "fullName": "...", "phone": "...",
      "email": "...", "isVerified": false, "role": "driver",
      "createdAt": "...", "signupCity": "..."
    },
    "kycStatus": {
      "overallStatus": "in_progress",
      "lastActivityAt": "...",
      "aadhaarVerified": true, "panVerified": true, "dlVerified": false,
      "rcVerified": false, "selfieVerified": false, "bankVerified": false
    },
    "documents": [
      { "id": 123, "type": "AADHAAR", "status": "verified", "documentNumber": "xxxx-xxxx-1234", "fileUrl": "https://s3...", "backFileUrl": null, "extractedData": {...}, "submittedAt": "...", "verifiedAt": "..." }
    ],
    "bank": { "verified": false, "accountLast4": null, "ifsc": null, "beneficiaryId": null },
    "fraudFlags": []
  }
}
```

---

## 5. Module: `all_drivers` — Actions on Any Driver

### 5.1 Register driver (no OTP)

`POST /ops/drivers/register`

Body:
```json
{ "phone": "+91...", "fullName": "...", "email": "..." }
```

Response: `{ userId, ... }`. Driver is created with `is_verified=false`; their first `/auth/verify-signin` auto-flips it.

### 5.2 Edit driver profile

`PATCH /ops/drivers/:userId/profile`

Body (at least one field required):
```json
{ "fullName": "...", "phone": "+91...", "email": "..." }
```

### 5.3 Edit vehicle categories

`PATCH /ops/drivers/:userId/vehicle/categories`

Body:
```json
{ "vehicle_categories": ["luxury", "premium", "xl"] }
```

Requires RC already staged/verified. Invalid entries are filtered server-side.

### 5.4 Stage a document

`POST /ops/kyc/drivers/:userId/documents`
Content-Type: `multipart/form-data`

Fields:
- `document_type` — `AADHAAR | PAN | DRIVING_LICENCE | VEHICLE_RC | SELFIE`
- `document_number` — optional; ops-typed number cross-checked against OCR
- `file` — front image/PDF (max ~1 MB after client compression)
- `file_back` — optional; for AADHAAR (address) or DL (blood group, class)

Response includes the newly-staged `docId`.

**Gotchas:**
- **SELFIE depends on AADHAAR** — stage AADHAAR first. If SELFIE is staged without AADHAAR staged-or-verified, the verify trigger returns 400.
- Selfie has a 30s graceful wait in the worker if AADHAAR is still processing.

### 5.5 List staged docs

`GET /ops/kyc/drivers/:userId/documents/staged`

### 5.6 Remove a staged doc

`DELETE /ops/kyc/drivers/:userId/documents/:docId`

### 5.7 Trigger batch verify

`POST /ops/kyc/drivers/:userId/verify`
Body: `{}`

Response: `{ batchId, jobs: [...] }`. Poll status via 5.8.

### 5.8 Poll batch status

`GET /ops/kyc/drivers/:userId/verify/:batchId`

Recommended cadence: 2s poll, cap at 3 min.

Response:
```json
{
  "success": true,
  "data": {
    "batchId": "...",
    "status": "in_progress",
    "jobs": [
      { "jobId": "...", "documentType": "AADHAAR", "status": "succeeded", "resultDocStatus": "auto_verified", "attemptCount": 1 },
      { "jobId": "...", "documentType": "PAN", "status": "processing", "resultDocStatus": null, "attemptCount": 1 }
    ]
  }
}
```

**IMPORTANT:** Read `resultDocStatus` for the actual per-doc decision, not `status`. `status='succeeded'` only means the job ran; the doc itself can be `rejected`.

### 5.9 Retry dead job

`POST /ops/kyc/verify-jobs/:jobId/retry`
Body: `{}`

Manual retry after all 5 auto-retries have exhausted.

### 5.10 Bank account (inline — NOT batched)

`POST /ops/kyc/drivers/:userId/bank`

Body:
```json
{ "account_number": "...", "ifsc": "SBIN0001234", "name": "Full Name" }
```

Inline penny-drop (~5-15s). Returns verified/rejected immediately. Not part of batch flow.

### 5.11 Approve document (manual override)

`POST /kyc/admin/documents/:docId/approve`

Body:
```json
{ "notes": "Manual review passed — clear photo, name match ok" }
```

### 5.12 Reject document

`POST /kyc/admin/documents/:docId/reject`

Body:
```json
{ "reason": "Aadhaar back page cut off", "allowRetry": true }
```

`allowRetry=true` lets the driver re-upload from the driver app.

### 5.13 Edit document data (manual)

`PATCH /kyc/admin/documents/:docId/edit`
Content-Type: `multipart/form-data` (file optional)

Fields:
- `document_number` — corrected extracted number
- `status` — force-set to `pending | verified | rejected | manual_review`
- `file` — optional replacement image

### 5.14 Review queue

`GET /kyc/admin/queue?type=AADHAAR&status=manual_review&page=1&limit=20`

Returns docs that fell into manual review or were rejected. `status` defaults to `manual_review`.

### 5.15 Fraud alerts

`GET /kyc/admin/fraud-alerts?severity=HIGH`

Same doc number used by multiple drivers, etc.

### 5.16 Doc detail (for approve/reject screen)

`GET /kyc/admin/documents/:docId`

---

## 6. Module: `all_drivers` — Sensitive Action: View OTP

Use case: driver reports "SMS didn't arrive" — ops reads the active OTP over phone.

`GET /kyc/admin/drivers/:userId/otp`

**Required headers:**
```
Authorization: Bearer <access_token>
X-Action-Token: <OPS_OTP_VIEW_TOKEN>
```

`X-Action-Token` is a static shared secret (env: `OPS_OTP_VIEW_TOKEN`). Backend refuses (403) if header is missing/wrong. Returns 503 if the env var isn't configured.

**Rate limit:** 5 requests / hour / user (Redis-backed).

**Response (success — active OTP exists):**
```json
{
  "success": true,
  "message": "Active OTP fetched.",
  "data": {
    "otp": {
      "code": "482913",
      "purpose": "signin",
      "expiresAt": "2026-07-15T09:16:00.000+05:30",
      "remainingSeconds": 214
    },
    "driver": { "id": "...", "fullName": "...", "phone": "+91..." },
    "rateLimit": { "current": 1, "max": 5, "windowSeconds": 3600 }
  }
}
```

**Response (no active OTP — driver hasn't requested one, or it's already used/expired):**
```json
{
  "success": true,
  "message": "No active OTP for this driver.",
  "data": {
    "otp": null,
    "reason": "no_active_otp",
    "driver": { "id": "...", "fullName": "...", "phone": "+91..." }
  }
}
```

**Rules:**
- Only OTPs where `is_used=false AND expires_at > NOW()` are returned. Verified OTPs are never viewable.
- Every request is auto-logged to `api_logs` — super_admin can query who viewed which driver's OTP via `/admin/logs`.
- **Do not cache the OTP on the frontend.** Fetch on demand, display in an ephemeral modal, discard on close.

**Frontend UX suggestion:**
1. Button on driver row: "View OTP" (only render if module `all_drivers` is granted).
2. Click → modal with countdown timer using `remainingSeconds`.
3. Countdown expiry → auto-close modal, no cached value.
4. If backend returns `otp: null`, show "No active OTP — ask driver to tap 'Resend OTP' in the app."

---

## 7. super_admin Only — Manage Ops Users' Modules

### 7.1 List ops users + their modules

`GET /admin/dashboard-modules/users?search=irshad`

Response:
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "uuid", "email": "irshad@...", "full_name": "Irshad Alam",
        "role": "ops_team", "is_active": true, "last_login": "...",
        "modules": ["my_drivers", "all_drivers"]
      }
    ]
  }
}
```

### 7.2 One user's modules (detail)

`GET /admin/dashboard-modules/users/:userId`

Response:
```json
{
  "success": true,
  "data": {
    "userId": "...",
    "email": "...",
    "fullName": "...",
    "role": "ops_team",
    "modules": ["my_drivers", "all_drivers"],
    "modulesDetail": [
      { "key": "my_drivers", "label": "My Drivers", "description": "...", "icon": "user-check", "sortOrder": 10 },
      { "key": "all_drivers", "label": "All Drivers", "description": "...", "icon": "users", "sortOrder": 20 }
    ]
  }
}
```

### 7.3 Replace grants

`PUT /admin/dashboard-modules/users/:userId`

Body:
```json
{ "modules": ["my_drivers", "all_drivers"] }
```

Idempotent replace-all — sends the full desired set. Empty array `[]` = revoke all modules.

Validation:
- Every key must be code-registered AND active in the catalog. Invalid keys → 400.
- Target user must be `ops_team` (or another non-admin role). admin/super_admin get all modules by role → 400.

---

## 8. Response Shape Conventions

All responses use this envelope:
```json
{ "success": true, "statuscode": 200, "message": "...", "data": {} }
```

- Success: `success: true`, `statuscode` = HTTP status (200, 201, etc.), `data` = actual payload.
- Error: `success: false`, `statuscode` = HTTP status (400/401/403/404/429/500), `message` = human-readable, `data` = optional extra info.

Common error codes to handle:
- **401** — token missing / expired → force logout, redirect to login.
- **403** — role not allowed / X-Action-Token bad → toast "Access denied".
- **404** — resource not found.
- **429** — rate limited (OTP view) → surface `message`.
- **503** — server config missing (OTP view) → surface as-is.

Watch the `x-new-access-token` response header — backend auto-rotates the JWT when it's within 6 hours of expiry. If the header is set, replace the stored token with its value.

---

## 9. Environment Notes

Frontend needs to be aware of ONE non-obvious secret:

- **`X-Action-Token` for OTP view**
  Delivered out-of-band by ops/DevOps (Slack DM, env config UI, whatever) — NOT in git.
  Store in a frontend env var (`VITE_OPS_ACTION_TOKEN` or equivalent). Include the header only on the OTP-view request.

Nothing else needs a special client-side secret.

---

## 10. Upload Constraints

- API Gateway caps request body at **1 MB**. Compress images client-side before upload (use browser Canvas API — reduce to ~800px longest side, JPEG quality 70).
- Multipart PDFs allowed for scanned docs; same 1 MB cap.
- `file_back` is a separate multipart field; only supported for AADHAAR + DRIVING_LICENCE.

---

## 11. Response Casing Gotcha

- `/kyc/admin/*` endpoints historically return **snake_case** field names (`user_id`, `full_name`, `document_type`).
- `/ops/*` and newer endpoints return **camelCase** (`userId`, `fullName`, `documentType`).

Normalize on read — pick one casing for your frontend state and map at the API-boundary layer.

---

## 12. Quick State Machines

**Document status:**
```
pending → auto_verified | manual_review | rejected → approved | rejected
                                                       (via admin override)
```

**Batch status:**
```
queued → in_progress → completed
                     → partial_failure (some jobs dead)
                     → failed          (all jobs dead → email alert fires)
```

**Overall KYC status (driver_kyc_status.overall_status):**
```
not_started → in_progress → pending_review → verified
                                          → rejected
                                          → suspended (admin action)
```

---

## 13. Implementation Checklist for Frontend

- [ ] Login flow — store `accessToken`, read `modules[]` on success
- [ ] Sidebar — render entries by `sortOrder`, use `label` + `icon`, skip unknown keys
- [ ] Route guard — if user hits a route for an ungranted module, redirect to their first available module
- [ ] Auto token rotation — watch `x-new-access-token` header
- [ ] Global error boundary — 401 → logout, 403 → toast, 429 → rate-limit banner
- [ ] super_admin editor — modules catalog CRUD + per-user grant editor
- [ ] Image compression on upload path
- [ ] OTP view modal — X-Action-Token header, countdown, no caching
- [ ] Poll batch status every 2s, cap 3 min
- [ ] Handle `resultDocStatus` (not `status`) for per-doc decisions
