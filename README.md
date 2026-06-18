# ERP System

A full-stack Enterprise Resource Planning system built for small-to-medium distribution businesses. Covers warehouse management, transport/delivery tracking, HR, and finance — accessible via a web dashboard and a mobile app for field workers.

**Live URLs**
- Web Dashboard: https://erp-web-system.vercel.app
- API (Backend): https://erp-system-eight-ruby.vercel.app
- Mobile APK: https://expo.dev/accounts/koolice234/projects/mobile

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend API | Node.js · Express · TypeScript |
| Database | PostgreSQL (Neon.tech — serverless) |
| Web Frontend | React · Vite · TypeScript · TanStack Query |
| Mobile App | React Native · Expo SDK 56 · EAS Build |
| Hosting | Vercel (API + Web), Expo EAS (Android APK) |

---

## Project Structure

```
ERP-System/
├── src/                    # Express backend
│   ├── modules/
│   │   ├── auth/           # JWT login, refresh tokens
│   │   ├── hris/           # Employees, shifts, attendance
│   │   ├── inventory/      # Products, warehouses, stock levels
│   │   ├── wms/            # Purchase orders, sales orders, pick/check/putaway tasks
│   │   ├── tms/            # Routes, vehicles, GPS tracking, deliveries, fuel logs
│   │   └── finance/        # AP, AR, branches, invoices
│   ├── db/
│   │   ├── client.ts       # PostgreSQL pool (Neon SSL)
│   │   ├── migrate.ts      # Migration runner
│   │   └── seed.ts         # Initial seed data
│   ├── migrations/         # SQL migration files (001–014)
│   └── middleware/         # authGuard, requireRole, errorHandler
├── api/
│   └── index.ts            # Vercel serverless entry point
├── web/                    # React web dashboard
│   └── src/
│       ├── pages/
│       │   ├── hris/       # Employees, Shifts
│       │   ├── inventory/  # Products, Stock, Warehouses
│       │   ├── wms/        # Sales Orders, Purchase Orders, Check Tasks, Invoices
│       │   ├── tms/        # Routes, Vehicles, Live GPS, Fuel Logs
│       │   └── finance/    # AP, AR, Branches
│       ├── api/            # Typed API client (axios)
│       └── components/     # Shared UI components
├── mobile/                 # Expo React Native app
│   └── src/
│       ├── screens/
│       │   ├── tms/        # MyRoute, Deliver, FuelLog
│       │   └── wms/        # PickTasks, PutawayScreen, CheckTasks, Receive
│       ├── api/            # Mobile API client
│       └── navigation/     # Role-based navigator (TMS / WMS / Admin)
├── vercel.json             # API Vercel config
└── web/vercel.json         # Web SPA Vercel config
```

---

## Modules

### HRIS
- Employee management (create, edit, role assignment, password reset)
- Shift scheduling and attendance tracking
- Login history per employee

### Inventory
- Product catalog with SKU, category, UOM, reorder points
- Multi-warehouse, multi-bin stock levels
- Low stock alerts and available qty calculation

### WMS — Warehouse Management
**Inbound:**
1. Create Purchase Order → Receive Stock (mobile) → GRN created
2. Generate Putaway Tasks → Assign to operator → Confirm bin on mobile → Stock lands in inventory

**Outbound:**
1. Create Sales Order → Generate Pick Tasks → Operator picks on mobile
2. Generate Check Tasks → Checker verifies → Dispatch → Invoice + TMS route created

### TMS — Transport Management
- Route planning with vehicle and driver assignment
- Driver mobile app: Start Route → GPS tracking → Confirm deliveries with POD photo
- Live GPS map on web dashboard (polls every 30s)
- Fuel log per route
- Failed delivery rescheduling

### Finance
- Accounts Payable (supplier invoice tracking, payments)
- Accounts Receivable (sales invoice tracking, payments)
- Branch management

---

## User Accounts & Roles

| Employee Code | Default Password | Role | Access |
|---|---|---|---|
| ADMIN-001 | Admin@1234 | system_admin | Full access — all modules |
| DISP-001 | Disp@1234 | dispatcher | TMS — routes, vehicles, GPS, fuel logs |
| DRV-001 | Driver@1234 | driver | Mobile — my route, deliveries, fuel log |
| CHK-001 | Checker@1234 | checker | Mobile — check tasks |
| FIN-001 | Finance@1234 | finance_officer | Finance — AP, AR, invoices |
| WH-001 | *(set via HRIS)* | wh_supervisor | Web + Mobile — all WMS operations, assign tasks |
| WH-002 | *(set via HRIS)* | wh_operator | Mobile — pick tasks, putaway, receiving |

---

## Business Workflow

```
INBOUND
  Create PO (Admin) → Receive Stock (WH Operator, mobile)
  → Generate Putaway Tasks (WH Supervisor, web)
  → Confirm Bin (WH Operator, mobile) → Stock updated in Inventory

OUTBOUND
  Create SO (Admin) → Generate Pick Tasks (WH Supervisor, web)
  → Confirm Picks (WH Operator, mobile)
  → Generate Check Tasks (WH Supervisor, web)
  → Verify Items (Checker, mobile)
  → Dispatch (Web) → TMS Route + Invoice created
  → Start Route (Driver, mobile) → GPS Tracking active
  → Deliver Stops + Upload POD → Route complete
  → Finance logs AR payment (Finance Officer, web)
```

---

## Local Development

### Prerequisites
- Node.js 18+
- PostgreSQL (local) or Neon.tech connection string
- Expo CLI + EAS CLI (for mobile)

### Backend
```bash
npm install
cp .env.example .env          # add DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET
npx ts-node src/db/migrate.ts # run migrations
npx ts-node src/db/seed.ts    # seed initial data
npm run dev                   # starts on :3000
```

### Web Dashboard
```bash
cd web
npm install
cp .env.example .env          # set VITE_API_URL=http://localhost:3000
npm run dev                   # starts on :5173
```

### Mobile App
```bash
cd mobile
npm install
# set EXPO_PUBLIC_API_URL in .env or eas.json environment
npx expo start                # Expo Go (no GPS/notifications)
npx eas build --platform android --profile preview  # build APK
```

---

## Environment Variables

### Backend (Vercel)
| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL direct connection string |
| `JWT_SECRET` | Access token signing key |
| `JWT_REFRESH_SECRET` | Refresh token signing key |

### Web (Vercel)
| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend API base URL |

### Mobile (EAS)
| Variable | Description |
|---|---|
| `EXPO_PUBLIC_API_URL` | Backend API base URL |

---

## Deployment

### Backend + Web → Vercel
```bash
git push origin main   # auto-deploys both Vercel projects
```
Two separate Vercel projects:
- **API project** — root directory, entry: `api/index.ts`
- **Web project** — root directory: `web/`

### Mobile → EAS Build
```bash
cd mobile
npx eas build --platform android --profile preview
```
Download APK from [expo.dev](https://expo.dev/accounts/koolice234/projects/mobile) and install on Android device (enable "Install from unknown sources").

> **Note:** GPS tracking requires Google Play Services. Huawei HarmonyOS devices (without GMS) will not receive GPS location updates — all other features work normally.

---

## Database

Hosted on [Neon.tech](https://neon.tech) (serverless PostgreSQL).
- Use the **direct connection URL** (not the pooler URL) to avoid `search_path` issues
- 14 migration files in `src/migrations/` — run with `npx ts-node src/db/migrate.ts`
- Tables: `users`, `warehouses`, `bin_locations`, `products`, `inventory`, `purchase_orders`, `po_lines`, `grn_logs`, `putaway_tasks`, `sales_orders`, `so_lines`, `pick_tasks`, `check_tasks`, `sales_invoices`, `si_lines`, `routes`, `delivery_stops`, `gps_logs`, `fuel_logs`, `vehicles`, `supplier_invoices`, `ap_payments`, `ar_payments`, `branches`, `shifts`, `login_logs`
