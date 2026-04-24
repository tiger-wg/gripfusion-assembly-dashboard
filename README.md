# GripFusion Dashboard

GripFusion Dashboard is a role-based manufacturing operations app for assembly execution, process editing, defect management, and KPI visibility.

This repo is a monorepo with:
- `frontend` (React + TypeScript + Vite)
- `backend` (Express + Prisma + PostgreSQL-ready API)

## What This Application Covers

- Admin dashboard KPIs and production monitoring
- Technician workflow (`My Work`) with step/substep progression
- Manual process editing + publish/unpublish controls
- Defect reporting from technician workflow into issues views
- Basic role separation between admin and technician users

## Tech Stack

- Frontend: React 19, TypeScript, Vite
- Backend: Node.js, Express, Prisma
- Data parsing: `xlsx` for Excel imports
- Auth model in backend: JWT + role middleware (see backend README)

## Repository Structure

```text
GripFusion Dashboard/
  frontend/              # UI application
  backend/               # API service
  README.md              # This file
```

## Local Development

### Prerequisites

- Node.js 18+
- npm

### Install dependencies

```bash
npm install
```

### Run frontend + backend together

```bash
npm run dev
```

### Run only frontend

```bash
npm run dev:web
```

### Run only backend

```bash
npm run dev:api
```

### Build frontend

```bash
npm run build
```

## Accounts and Access

Current demo accounts are frontend-local and available at login:

- `admin` / `123` (admin)
- `masonf` / `123` (admin)
- `timc` / `123` (admin)
- `tech` / `123` (technician)

Role behavior:
- Technician users are constrained to technician workflows.
- Technician users cannot access admin views/pages.
- Admin users can access dashboard, manual edits, issues, logs, and admin control pages.

## Application Pages and Use Cases

### 1) Login

Purpose:
- Authenticate a user into the role-specific interface.

Primary use case:
- Sign in as admin or technician and load the corresponding experience.

---

### 2) Admin Dashboard (`workflow -> dashboard`)

Purpose:
- High-level operational snapshot.

What it includes:
- KPI cards (units, cycle time, pass rate, active techs)
- Open Flags panel
- Active Units progress panel
- Throughput chart
- Technician output chart + leaderboard

Common use cases:
- Morning shift check-in
- Identify flags requiring immediate intervention
- Track throughput trends and top operators

---

### 3) My Work (`technician -> assembly`)

Purpose:
- Execute assembly process at step and substep level.

What it includes:
- Catalogue view of published process steps
- Expanded view with:
  - reference image area
  - substep list
  - progression controls (`Back`, `Mark Incomplete`, `Mark Complete & Continue`)
  - defect reporting panel

Behavior notes:
- Tech can preview future steps/substeps without auto-completing previous ones.
- Completion state updates only through progression controls.
- Defect submission creates live entries in issues/flags panels.

Common use cases:
- Follow standardized assembly process
- Move forward/back within substeps
- Report quality issues in context

---

### 4) Testing & QA (`technician -> testing`)

Purpose:
- Run test sequence and register pass/fail outcomes.

What it includes:
- Sequential test instructions
- `Mark PASS` and `Mark FAIL` actions (usable; currently placeholder-backed)
- Defect analytics table

Common use cases:
- End-of-assembly validation
- Capture test status for traceability

---

### 5) BOM & Cost Explorer (`workflow -> bom`)

Purpose:
- Review component cost composition and scenario impacts.

What it includes:
- Volume slider for what-if costing
- BOM table
- Excel import for BOM rows

Common use cases:
- Supplier/cost analysis
- Volume planning discussions

---

### 6) Manual Edits (`workflow -> assembly`)

Purpose:
- Admin authoring and governance of process content.

What it includes:
- Step list and metadata editor
- Substep ordering/edit controls
- Manual image area
- Publish controls (`Save Draft`, `Publish Live`, `Unpublish`)
- Process Excel import trigger

Publish workflow behavior:
- `Save Draft`: updates draft/admin content without changing tech visibility
- `Publish Live`: makes step visible in technician workflow
- `Unpublish`: removes step from technician workflow

Common use cases:
- Update SOP language
- Reorder substeps
- Roll out revised process content to technicians

---

### 7) Flags & Issues (`workflow -> testing`)

Purpose:
- Aggregate and manage flagged production issues.

What it includes:
- Summary cards (open errors, warnings, resolved)
- Full issue table with resolve/view actions
- Filter/sort entry points (usable placeholder hooks)

Common use cases:
- Resolve newly reported defects
- Track issue volume and severity over time

---

### 8) Versions & Change Log (`technician -> versions`)

Purpose:
- View revision history and change notes.

What it includes:
- Version timeline entries
- Export action (usable placeholder)

---

### 9) Data & Logs (`workflow -> logs`)

Purpose:
- Explain repository-level data model and logging context.

What it includes:
- Data model narrative and schema placeholder panel

---

### 10) GripFusion Admin (`workflow -> admin`)

Purpose:
- Operational control and staffing/alert visibility.

What it includes:
- KPI strip
- Products table
- Active technician cards
- System alerts list
- System settings action (usable placeholder)

## Excel-Driven Process Support

The app includes process-import support and normalized process content derived from the provided workbook.

Current state:
- Process structure can be imported/applied from Excel flow in Manual Edits.
- Step/substep names are cleaned and generalized for technician readability.
- Image mapping can be extended separately (placeholder image support is active).

### Recommended Excel Format for Assembly Step Import

Use one worksheet named `assembly_steps` with one row per substep.

Core required columns:
- `step_number` (number, e.g. `1`, `2`, `3`)
- `step_id` (string, e.g. `S01`, `S02`)
- `step_title` (string, e.g. `Pre-Assembly Setup`)
- `step_instruction` (string, high-level instruction shown in expanded footer)
- `substep_id` (string, e.g. `S01.1`, `S01.2`)
- `substep_title` (string, short process name shown in substeps pane)
- `substep_order` (number, order within a step)

Recommended optional columns (supported by normalization/import layer):
- `phase` (e.g. `Setup`, `Assembly`, `QA`)
- `published` (`TRUE`/`FALSE`)
- `tools` (comma-separated)
- `materials` (comma-separated)
- `critical` (single sentence)
- `version_note` (single sentence)
- `fmea` (single sentence)
- `estimated_minutes` (number)
- `defect_category` (e.g. `Alignment`, `Adhesive`, `Electrical`)
- `severity_default` (`INFO`, `WARNING`, `ERROR`)
- `station_code` (e.g. `ST-10`)
- `work_center` (e.g. `Assembly-Line-A`)
- `qa_checkpoint` (`TRUE`/`FALSE`)
- `reference_image_key` (filename or key, for future image mapping)

Validation rules to follow:
- Keep `step_number` unique per main step.
- For rows sharing the same `step_number`, `step_id`, `step_title`, and `step_instruction` must match.
- Keep `substep_id` unique within each step.
- `substep_order` should be contiguous (`1..N`) for each step.
- Keep `substep_title` concise (process label), and place detailed wording in `step_instruction` or notes columns.

Example row shape:
- `step_number`: `2`
- `step_id`: `S02`
- `step_title`: `Petal Assembly`
- `step_instruction`: `Align, clamp, and validate petal installation before core integration.`
- `substep_id`: `S02.3`
- `substep_title`: `Petal Fit Verification`
- `substep_order`: `3`
- `published`: `TRUE`
- `phase`: `Assembly`
- `tools`: `Alignment Fixture, Connector Clamp Set`
- `materials`: `Petal Set, Connector Board`
- `reference_image_key`: `S02_03_petal_fit.png`

## Button Usability Status

All admin and technician page buttons are now usable:
- Either connected to real state changes/navigation
- Or connected to explicit placeholder actions/messages where backend integrations are not yet finalized

This prevents dead UI controls during demos and testing.

## Backend Documentation

For full API, data model, seed, and deployment details, see:
- [backend/README.md](backend/README.md)

## Known Demo-Scope Notes

- Some actions are intentionally placeholder-backed while preserving UX flow.
- Current auth in frontend uses local credential matching for demo convenience.
- Backend routes exist for production-style integrations and can be wired progressively.

## Suggested Next Enhancements

- Persist publish/unpublish and defect flows through backend endpoints
- Replace placeholder actions with API-backed workflows
- Add end-to-end image import/mapping for step/substep references
- Add audit/event history for process edits and publish operations
