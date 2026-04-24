# GripFusion Assembly Dashboard — Backend

A lightweight REST API for the GripFusion assembly operations dashboard. Handles auth, assembly step management, unit tracking, time logging, flags, and inventory. Built to be deployed on Railway in under 10 minutes.

---

## Tech Stack


| Layer     | Choice                        |
| --------- | ----------------------------- |
| Runtime   | Node.js                       |
| Framework | Express                       |
| Database  | PostgreSQL (via Supabase)     |
| ORM       | Prisma                        |
| Auth      | JWT + bcrypt                  |
| Hosting   | Railway (API) + Supabase (DB) |


No Docker. No microservices. One Express app, one Postgres database, deployed to Railway via GitHub push.

---

## Project Structure

```
gripfusion-backend/
├── prisma/
│   └── schema.prisma          # All DB models
├── src/
│   ├── index.js               # Entry point, Express setup
│   ├── middleware/
│   │   ├── auth.js            # JWT verification middleware
│   │   └── requireRole.js     # Role-based access (admin / technician)
│   ├── routes/
│   │   ├── auth.js            # Login, logout, me
│   │   ├── steps.js           # Assembly step CRUD
│   │   ├── units.js           # Unit tracking
│   │   ├── completions.js     # Step completions + timestamps
│   │   ├── flags.js           # Flag creation and resolution
│   │   ├── inventory.js       # Stock levels
│   │   └── analytics.js       # Dashboard KPIs
│   └── lib/
│       └── prisma.js          # Prisma client singleton
├── .env
├── package.json
└── README.md

```

---

## Database Schema

Build this exactly in `prisma/schema.prisma`.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String   @id @default(cuid())
  name          String
  email         String   @unique
  passwordHash  String
  role          Role     @default(TECHNICIAN)
  avatarInitials String? 
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())

  units         Unit[]
  completions   StepCompletion[]
  flagsRaised   Flag[]   @relation("RaisedBy")
  flagsResolved Flag[]   @relation("ResolvedBy")
  stepsEdited   AssemblyStep[]
}

enum Role {
  ADMIN
  TECHNICIAN
}

model AssemblyStep {
  id          String   @id @default(cuid())
  stepNumber  Int      @unique
  title       String
  description String
  subSteps    Json     // Array of { id, label, order }
  isPublished Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  updatedBy   String?
  editor      User?    @relation(fields: [updatedBy], references: [id])

  completions StepCompletion[]
}

model Unit {
  id                  String     @id @default(cuid())
  serialNumber        String     @unique
  assignedTechId      String?
  assignedTech        User?      @relation(fields: [assignedTechId], references: [id])
  currentStepNumber   Int        @default(1)
  status              UnitStatus @default(IN_PROGRESS)
  shift               String     // e.g. "Shift A"
  createdAt           DateTime   @default(now())
  completedAt         DateTime?

  completions         StepCompletion[]
  flags               Flag[]
}

enum UnitStatus {
  IN_PROGRESS
  COMPLETE
  BLOCKED
  REWORK
}

model StepCompletion {
  id              String           @id @default(cuid())
  unitId          String
  stepId          String
  techId          String
  status          CompletionStatus @default(PENDING)
  startedAt       DateTime?
  completedAt     DateTime?
  elapsedSeconds  Int?             // Written on completion: completedAt - startedAt
  notes           String?

  unit  Unit         @relation(fields: [unitId], references: [id])
  step  AssemblyStep @relation(fields: [stepId], references: [id])
  tech  User         @relation(fields: [techId], references: [id])
}

enum CompletionStatus {
  PENDING
  IN_PROGRESS
  COMPLETE
  REWORK
  BLOCKED
}

model Flag {
  id           String      @id @default(cuid())
  unitId       String
  stepId       String?
  raisedById   String
  severity     FlagSeverity
  message      String
  resolved     Boolean     @default(false)
  resolvedById String?
  createdAt    DateTime    @default(now())
  resolvedAt   DateTime?

  unit       Unit  @relation(fields: [unitId], references: [id])
  raisedBy   User  @relation("RaisedBy", fields: [raisedById], references: [id])
  resolvedBy User? @relation("ResolvedBy", fields: [resolvedById], references: [id])
}

enum FlagSeverity {
  ERROR
  WARNING
  INFO
}

model InventoryItem {
  id        String          @id @default(cuid())
  name      String
  code      String?         // e.g. "3M PR100"
  category  ItemCategory
  quantity  Int
  minStock  Int             @default(5)
  updatedAt DateTime        @updatedAt
}

enum ItemCategory {
  CONSUMABLE
  TOOL
}

```

---

## Auth

### How it works

- Passwords are hashed with `bcrypt` (salt rounds: 10)
- Login returns a signed JWT (24hr expiry)
- Every protected route runs the `auth` middleware which verifies the token and attaches `req.user`
- The `requireRole('ADMIN')` middleware locks admin-only routes

### JWT payload

```json
{
  "userId": "clxyz...",
  "role": "ADMIN",
  "iat": 1713600000,
  "exp": 1713686400
}

```

### Routes

```
POST   /auth/login       Body: { email, password } → { token, user }
POST   /auth/logout      Clears token (client-side — just drop the JWT)
GET    /auth/me          Returns current user from token

```

> **Note on the role toggle in the UI:** The Admin / Technician toggle in the dashboard is for demo purposes only. In production, the user's role comes from their JWT. On login, the frontend reads `role` from the token response and routes accordingly — admins see the admin nav, technicians see the technician nav. There is no UI toggle in the deployed app.

---

## API Routes

All routes require `Authorization: Bearer <token>` header unless marked public.

### Assembly Steps

```
GET    /steps                   Both roles    Get all published steps (techs) or all steps (admin)
GET    /steps/:id               Both roles    Get single step with subSteps
POST   /steps                   Admin only    Create a new step
PATCH  /steps/:id               Admin only    Edit step content (title, description, subSteps)
PATCH  /steps/:id/publish       Admin only    Toggle isPublished true/false
DELETE /steps/:id               Admin only    Delete a step

```

**POST /steps body:**

```json
{
  "stepNumber": 2,
  "title": "Petal Assembly",
  "description": "Push petal fins into the connector...",
  "subSteps": [
    { "id": "2-1", "label": "Push fins into connector, verify square", "order": 1 },
    { "id": "2-2", "label": "Move clamps to center of board", "order": 2 }
  ]
}

```

### Units

```
GET    /units                   Admin only    All units, current shift
GET    /units/mine              Technician    Their currently assigned unit
POST   /units                   Admin only    Create new unit, assign to tech
PATCH  /units/:id/advance       Technician    Advance to next step (writes completion record)
PATCH  /units/:id/status        Admin only    Override unit status (BLOCKED, REWORK, etc.)

```

**POST /units body:**

```json
{
  "serialNumber": "GF-044",
  "assignedTechId": "clxyz...",
  "shift": "Shift A"
}

```

### Step Completions

```
GET    /completions/:unitId     Both roles    Full step history for a unit
POST   /completions/start       Technician    Start a step → writes startedAt
POST   /completions/complete    Technician    Complete a step → writes completedAt + elapsedSeconds
PATCH  /completions/:id         Technician    Add notes, update status

```

**POST /completions/start body:**

```json
{ "unitId": "clxyz...", "stepId": "clxyz..." }

```

**POST /completions/complete body:**

```json
{
  "completionId": "clxyz...",
  "status": "COMPLETE",
  "notes": "Petal aligned correctly on second attempt"
}

```

The `elapsedSeconds` is computed server-side: `Math.floor((completedAt - startedAt) / 1000)`. Never trust client-side timestamps for this.

### Flags

```
GET    /flags                   Admin only    All flags, sorted by severity then createdAt
GET    /flags?unitId=xxx        Both roles    Flags for a specific unit
POST   /flags                   Technician    Raise a new flag
PATCH  /flags/:id/resolve       Admin only    Mark resolved, writes resolvedAt

```

**POST /flags body:**

```json
{
  "unitId": "clxyz...",
  "stepId": "clxyz...",
  "severity": "ERROR",
  "message": "Sensor pixel zones 3 and 7 not responding after 3 attempts"
}

```

### Inventory

```
GET    /inventory               Both roles    All items with stock status
PATCH  /inventory/:id           Admin only    Update quantity
POST   /inventory               Admin only    Add new item

```

Stock status is computed on read: if `quantity <= 0` → `CRITICAL`, if `quantity <= minStock` → `LOW`, else `OK`.

### Analytics (Admin only)

```
GET    /analytics/shift         Today's KPIs: units completed, avg cycle time, pass rate, active techs
GET    /analytics/throughput    Hourly unit counts for the last 8 hours (bar chart data)
GET    /analytics/tech          Per-technician unit counts for current shift

```

**GET /analytics/shift response:**

```json
{
  "unitsCompleted": 24,
  "avgCycleTimeSeconds": 1080,
  "passRate": 0.96,
  "activeTechs": 4,
  "reworkCount": 2
}

```

Cycle time = average of `SUM(elapsedSeconds)` per unit across all completed units today.

---

## Time Tracking

The dashboard timer shown to technicians (e.g. "12m elapsed") is **frontend-only** — the frontend polls `GET /completions/:unitId`, reads `startedAt` from the active completion, and computes `Date.now() - startedAt` locally every second. No WebSocket needed for this.

Stored elapsed time only gets written once: when `POST /completions/complete` is called. This is the source of truth for analytics.

---

## Environment Variables

```env
DATABASE_URL=postgresql://...        # From Supabase → Settings → Database → Connection String
JWT_SECRET=your-secret-here          # Generate with: openssl rand -base64 32
PORT=3000
NODE_ENV=production

```

---

## Deployment

### 1. Set up Supabase (database)

1. Create a new project at [supabase.com](https://supabase.com/)
2. Go to Settings → Database → Connection String → copy the URI
3. Paste into `.env` as `DATABASE_URL`
4. Run `npx prisma migrate deploy` to apply the schema

### 2. Deploy to Railway (API server)

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app/) → New Project → Deploy from GitHub
3. Add environment variables: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV=production`
4. Railway auto-detects Node.js and runs `npm start`
5. Copy the generated Railway URL — this is your API base URL for the frontend

### 3. Connect the frontend

Set the API base URL in your frontend `.env`:

```
VITE_API_URL=https://your-app.railway.app

```

---

## Local Development

```bash
# Install dependencies
npm install

# Set up local .env (copy from .env.example)
cp .env.example .env

# Push schema to Supabase dev project
npx prisma migrate dev --name init

# Generate Prisma client
npx prisma generate

# Seed initial data (admin user + sample steps)
node prisma/seed.js

# Start dev server with auto-reload
npm run dev

```

### Seed data

`prisma/seed.js` should create:

- 1 admin user: `mason@gripfusion.com` / `admin123` (change immediately)
- 1 technician user: `alex@gripfusion.com` / `tech123`
- Assembly steps 1–3 (step 3 unpublished)
- Sample inventory items with realistic quantities

---

## Key Business Rules (implement these exactly)

1. **Technicians can only see published steps.** `isPublished: false` steps are admin-only.
2. **Technicians can only write to their own unit.** Check `unit.assignedTechId === req.user.userId` before any write.
3. **A step can only be started if the previous step is COMPLETE.** Enforce this server-side in `POST /completions/start`.
4. `elapsedSeconds` **is always computed server-side.** Never accept it from the client.
5. **Admins can see all units and all technician views.** Role check: `ADMIN` bypasses all ownership filters.
6. **Flags cannot be deleted, only resolved.** Resolved flags stay in the log for audit purposes.
7. **Inventory stock status (OK / LOW / CRITICAL) is computed on read**, not stored. Compare `quantity` to `minStock` in the route handler.

---

## packages to install

```bash
npm install express prisma @prisma/client bcrypt jsonwebtoken cors dotenv
npm install --save-dev nodemon

```

`package.json` scripts:

```json
{
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js"
  }
}

```

