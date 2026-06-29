# CLAUDE.md — ICHRM-Submission

## Collaboration Rules

- **No implementation without explicit instruction.** Only write or edit code when explicitly told to (e.g. "go ahead", "implement it", "do it"). This applies even when the root cause of a bug is obvious and the fix is trivial. Diagnosing a problem is not permission to fix it. Proposing a fix is not permission to apply it. Present findings or a plan, then stop and wait for explicit approval.
- **No git operations without explicit instruction.** Committing, pushing, or any other git action requires an explicit request.
- **No `Co-Authored-By` lines in commits.**

---

## Project Overview

A **conference paper submission system** for the International Conference in HRM (ICHRM), with two clients (GitHub Pages website + iOS app) sharing a single Google Apps Script backend.

Participants fill in a registration form, optionally upload a paper (DOCX), and submit. The backend validates, stores files in Google Drive, and logs metadata to Google Sheets.

---

## Architecture

```
GitHub Pages Website  /  iOS App
           │
           │ HTTPS POST (JSON + Base64 files)
           │
   ┌───────▼────────┐
   │ Google Apps    │
   │ Script Web App │
   └───────┬────────┘
           │
 ┌─────────┼──────────┐
 ▼         ▼          ▼
Drive    Sheets    JSON Response
```

- Frontend is fully static — no server-side rendering.
- Backend is stateless — no session or database beyond Drive and Sheets.
- No platform-specific backend logic; both clients use the same endpoint.

---

## Stack

- **Frontend**: Plain HTML, CSS, vanilla JS — no build step, no framework.
- **Backend**: Google Apps Script (`.gs` files).
- **Storage**: Google Drive (files) + Google Sheets (metadata).
- **Hosting**: GitHub Pages (frontend).

---

## File Structure

```
index.html            ← root (required by GitHub Pages)
css/
    style.css
js/
    api.js            # HTTP calls to Apps Script
    form.js           # Form state and submission flow
    validation.js     # Client-side validation (UX only)

backend/
    Code.gs           # HTTP entry point (doPost)
    Config.gs         # Centralised IDs and constants
    Drive.gs          # File decoding and Drive storage
    Sheets.gs         # Row creation in Google Sheets
    Validation.gs     # Server-side validation logic
    Responses.gs      # JSON response helpers
```

---

## Form Fields

Derived from `REGISTRATION-FORM-IHRM-2027.docx` at the repo root.

### Participant Identification

| Field               | Type   | Required |
|---------------------|--------|----------|
| name                | text   | yes      |
| institution         | text   | yes      |
| address             | text   | yes      |
| countryCity         | text   | yes      |
| email               | email  | yes      |
| phone               | text   | yes      |
| academicDegree      | text   | yes      |

### Conference Participation

| Field               | Type     | Required |
|---------------------|----------|----------|
| isAuthor            | boolean  | yes      |
| paperTitle          | text     | if author |
| authors             | array    | if author (min 1) |
| presentationFormat  | enum     | if author (`onsite` / `online`) |
| paper               | file     | if author (DOCX only) |

Each `authors` entry:

| Field       | Type  | Required |
|-------------|-------|----------|
| name        | text  | yes      |
| institution | text  | yes      |
| email       | email | yes      |

Sent to the backend as an array of objects:
```json
"authors": [
  { "name": "Jane Doe", "institution": "Nova SBE", "email": "jane@example.com" }
]
```

### Registration & Payment

| Field               | Type   | Required |
|---------------------|--------|----------|
| registrationType    | enum   | yes (`author_academic_manager` / `student`) |
| registrationPeriod  | enum   | yes (`early` / `late`) — determines fee |
| paymentMethod       | enum   | yes (`bank_transfer` / `paypal`) |

### Invoicing

| Field               | Type   | Required |
|---------------------|--------|----------|
| invoiceName         | text   | yes      |
| vatNumber           | text   | no       |
| invoiceAddress      | text   | yes      |
| invoiceCountryCity  | text   | yes      |

### Fee Schedule

| Registration Type              | Until 31/01/2027 | From 01/02/2027 |
|-------------------------------|------------------|-----------------|
| Author, academic or manager   | €385             | €485            |
| Undergraduate/master/PhD student | €285          | €385            |

---

## File Upload Protocol

1. Frontend reads the file and converts it to Base64.
2. Sends JSON to the Apps Script endpoint.

```json
{
  "name": "John Doe",
  "institution": "Nova SBE",
  "email": "john@example.com",
  "phone": "+351 912 345 678",
  "isAuthor": true,
  "paperTitle": "HRM Practices in Post-Pandemic Organisations",
  "presentationFormat": "onsite",
  "registrationType": "author_academic_manager",
  "registrationPeriod": "early",
  "paymentMethod": "bank_transfer",
  "invoiceName": "John Doe",
  "vatNumber": "123456789",
  "invoiceAddress": "Rua Example 1",
  "invoiceCountryCity": "Portugal, Lisbon 1200-001",
  "paper": {
    "filename": "paper.docx",
    "mimeType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "data": "<base64>"
  }
}
```

3. Apps Script decodes Base64 and stores the file in Drive.
4. `paper` is only included when `isAuthor` is `true`.

---

## Google Drive Structure

```
Submissions/
    John Doe — <applicationId>/
        paper.docx          (only if isAuthor = true)
```

Each submission gets its own folder named `Full Name — <id>`. Non-author registrants have an empty folder (no file upload required).

---

## Google Sheets Columns

| Column                | Notes                                          |
|-----------------------|------------------------------------------------|
| Timestamp             | ISO 8601                                       |
| Submission ID         | Generated by backend                           |
| Name                  |                                                |
| Institution           |                                                |
| Email                 |                                                |
| Phone                 |                                                |
| Academic Degree       |                                                |
| Is Author             | `Yes` / `No`                                   |
| Paper Title           | Empty if not author                            |
| Presentation Format   | `Onsite` / `Online` / empty                    |
| Registration Type     | `Author/Academic/Manager` / `Student`          |
| Registration Period   | `Early` / `Late`                               |
| Fee (€)               | Calculated by backend                          |
| Payment Method        | `Bank Transfer` / `PayPal`                     |
| Invoice Name          |                                                |
| VAT Number            |                                                |
| Invoice Address       |                                                |
| Drive Folder URL      |                                                |
| Paper URL             | Empty if not author                            |
| Status                | Default: `Pending`                             |

---

## API Contract

**Request**: `POST <Apps Script Web App URL>`  
**Content-Type**: `application/json`

**Success response**:
```json
{ "success": true, "applicationId": "12345" }
```

**Error response**:
```json
{ "success": false, "error": "Missing email." }
```

---

## Backend Validation Rules

- All required fields must be present and non-empty.
- Email must match a valid format.
- If `isAuthor` is `true`, `paperTitle`, `authors`, `presentationFormat`, and `paper` are required.
- `authors` must have at least one entry; each entry must have a non-empty `name`, `institution`, and valid `email`.
- Files must be valid Base64.
- Allowed MIME type for paper: `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (DOCX only).
- Maximum file size: 20 MB.
- `registrationType` must be one of the defined enum values.
- `paymentMethod` must be one of the defined enum values.
- Fee is calculated server-side from `registrationType` and `registrationPeriod`; never trust a fee sent by the client.

Frontend validation is for UX only; backend is the source of truth.

---

## Security

- The Apps Script Web App is public — do not rely on the URL being secret.
- Implement input validation, file size limits, and MIME type checks on the backend.
- Support an optional bearer token / API key in the request headers for basic auth.
- Optional CAPTCHA on the website frontend.

---

## Google Apps Script Limits to Keep in Mind

- Max execution time: 6 minutes per request.
- Max file upload via Drive API: 50 MB — well above expected DOCX paper sizes.
- Quotas reset daily; not a concern for typical submission volumes.

---

## Configuration (Config.gs)

All IDs and constants must be centralised in `Config.gs`. No hard-coded IDs elsewhere.

Expected constants:
- `SPREADSHEET_ID`
- `DRIVE_FOLDER_ID` (root Applications folder)
- `API_KEY` (optional bearer token)
- `MAX_FILE_SIZE_BYTES`
- `ALLOWED_MIME_TYPES`

---

## Session Continuity

- `PROJECT_DETAILS.md` and `REGISTRATION-FORM-IHRM-2027.docx` are gitignored local reference files — this `CLAUDE.md` is the committed source of truth for requirements.
- Build frontend first, then backend, then wire them together.
- Keep frontend and backend independently testable.
- When the Apps Script endpoint URL is known, record it in `Config.gs` comments and here.

**Apps Script Web App URL**: _not yet deployed_
