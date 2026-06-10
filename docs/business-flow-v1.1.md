# ERP System — Business Flow

**Internal Documentation — Confidential**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | June 2026 | System | Initial release |
| 1.1 | June 2026 | System | Gap fixes: putaway assignment, checker permissions, failed delivery resolution, attendance late detection, push notifications |

**Modules:** AUTH · HRIS · INVENTORY · WMS · TMS · FINANCE

---

## Overview

The ERP system is composed of six modules. WMS is the operational hub — it sits at the intersection of inventory, logistics, and finance, orchestrating the core fulfillment pipeline.

| Module | Responsibility |
|--------|---------------|
| **AUTH** | JWT-based login, token refresh, and user profile. Foundation for all other modules. |
| **HRIS** | Employee records, shift scheduling, attendance tracking (present/late/absent), and login audit logs. |
| **INVENTORY** | Product catalog, warehouse bin locations, and real-time stock levels. Central ledger for all physical goods. |
| **WMS** | Warehouse operations — inbound receiving & putaway, outbound picking, QC checking, dispatch, and invoice generation. |
| **TMS** | Transportation — route planning, GPS tracking, delivery confirmation (POD), failed delivery resolution, and driver fuel logging. |
| **FINANCE** | Accounts Payable (AP) and Accounts Receivable (AR) — invoices, payments, aging summaries, and branch management. |

### Cross-Module Dependencies

| Dependency | Description |
|-----------|-------------|
| WMS → INVENTORY | Receiving goods adds stock; confirming picks deducts stock from bins. |
| WMS → TMS | Dispatching a sales order triggers creation of a TMS delivery route. |
| WMS → FINANCE | Fulfilled SOs generate AR invoices; POs feed AP invoices. |
| HRIS → WMS / TMS | Employee records used when assigning pick tasks, putaway, check tasks, and driver routes. |
| TMS → FINANCE | Cancelled failed deliveries void the associated AR invoice. |

---

## Flow 1 — Procurement-to-Pay

Covers the inbound goods journey from supplier purchase order through to payment. Managed by Operations Managers, Warehouse teams, and Finance.

### Inbound Receiving Workflow — WMS + INVENTORY + FINANCE

**Step 1 — Create Purchase Order** *(WMS)*
Operations Manager creates a PO with supplier and product lines. Status: `pending`.

**Step 2 — Receive Goods at Warehouse** *(WMS)*
Warehouse Supervisor or Operator records received quantities against the PO. A Goods Receiving Note (GRN) is created. Stock is added to INVENTORY at a staging bin.

**Step 3 — Generate Putaway Tasks** *(WMS)*
Supervisor selects one or more GRN lines and assigns them to a specific Warehouse Operator. The system creates putaway tasks with status `pending`, linked to the GRN, the operator, and the source warehouse. An operator can only see tasks explicitly assigned to them.

> **v1.1 clarification:** Putaway tasks are supervisor-initiated and operator-specific. The operator does not self-assign — they receive tasks in their mobile queue. The system validates that the assignee has the `wh_operator` role. Duplicate tasks for the same GRN line are prevented.

**Step 4 — Execute Putaway** *(WMS · INVENTORY)*
Operator opens the Putaway screen on mobile. Only their assigned tasks are shown by default. For each task, the operator selects or scans a target bin. On confirmation:
- Stock is moved from the staging bin to the target bin in a single transaction.
- Task status becomes `completed`.
- INVENTORY bin levels are updated.

**Step 5 — Create & Pay Supplier Invoice** *(FINANCE)*
Finance Officer creates an AP invoice linked to the PO. Payment is recorded when processed, updating the AP aging report.

### Roles Involved

| Step | Role | Action |
|------|------|--------|
| Create PO | operations_manager | Initiates purchase from supplier |
| Receive Goods | wh_supervisor · wh_operator | Logs received quantities against PO |
| Generate Putaway | wh_supervisor | Creates tasks from GRN and assigns to operator |
| Execute Putaway | wh_operator | Moves goods to bin locations via mobile |
| AP Invoice / Payment | finance_officer | Records payable and payment |

---

## Flow 2 — Order-to-Cash (Sales Fulfillment)

The outbound order pipeline from sales order creation through picking, quality check, dispatch, and payment collection.

### Outbound Fulfillment Workflow — WMS + TMS + FINANCE

**Step 1 — Create Sales Order** *(WMS)*
Operations Manager creates an SO specifying customer, delivery date, and ordered products. Status: `pending`.

**Step 2 — Generate Pick Tasks** *(WMS · INVENTORY)*
Supervisor generates pick tasks from the SO. Each task maps a product to its bin location. Tasks are assigned to Warehouse Operators.

**Step 3 — Execute Picking** *(WMS · INVENTORY)*
Operator picks items from bins and confirms each line. Reserved stock is deducted from INVENTORY. SO status moves to `packed`.

**Step 4 — Quality Check** *(WMS)*
Checker reviews all lines of the packed order against expected quantities.
- **FAIL** — returns to picking
- **PASS** — ready to dispatch

> **v1.1 clarification — Checker permissions:** The `checker` role has read access to both `GET /wms/check-tasks` and `GET /wms/sales-orders/:id`. This is required for checkers to view the full SO details during QC. Prior to v1.1 the checker role lacked the `wms:so:read` permission and could not view order details.

**Step 5 — Dispatch & Invoice** *(WMS → TMS · FINANCE)*
Supervisor dispatches the SO — this triggers a TMS delivery route. WMS generates a Sales Invoice, which appears in Finance as an AR receivable.

**Step 6 — Collect Payment** *(FINANCE)*
Finance Officer records customer payment against the AR invoice. Aging report updated.

### Roles Involved

| Step | Role | Action |
|------|------|--------|
| Create SO | operations_manager | Initiates customer order |
| Generate Picks | wh_supervisor | Auto-generates tasks per SO line |
| Execute Picks | wh_operator | Physical picking from bins |
| Quality Check | checker | Verify packed quantities and SO details |
| Dispatch | wh_supervisor · dispatcher | Release order to logistics |
| AR Payment | finance_officer | Records customer payment |

---

## Flow 3 — Last-Mile Delivery

The physical delivery execution from route creation through GPS tracking, proof of delivery, failed delivery resolution, and fuel logging.

### Delivery Execution Workflow — TMS

**Step 1 — Create Delivery Route** *(TMS)*
Dispatcher creates a route with a vehicle, driver, and ordered delivery stops. Each stop is linked to a dispatched Sales Order.

**Step 2 — Driver Starts Route** *(TMS)*
Driver opens the mobile app, views today's route, and taps "Start Route." Route status changes to `in_progress`.

**Step 3 — Real-Time GPS Tracking** *(TMS)*
Mobile app sends GPS pings while driving. Operations team can monitor all active vehicles on the live map dashboard.

> **Push notifications:** When a new route is assigned to a driver, the system sends a push notification via Expo Push API (if the driver's device token is registered). Drivers register their token by calling `POST /tms/push-token` from the mobile app on login.

**Step 4 — Confirm Delivery (POD)** *(TMS)*
Driver confirms each stop. Two outcomes are possible:

**4a — Delivered (success path)**
Driver taps "Mark as Delivered" with optional notes and photo (Proof of Delivery). Stop status: `delivered`.

**4b — Failed Delivery (v1.1 addition)**
Driver taps "Mark as Failed." A reason field appears (required). On confirmation:
- Stop status changes to `failed`, `failure_reason` is recorded.
- A record is created in `failed_delivery_logs`.
- The linked Sales Order status changes to `delivery_failed`.
- The dispatcher sees an unresolved badge count on the Failed Deliveries section.
- Route completion checks only count `pending` stops — failed stops do not block route completion.

**Step 5 — Failed Delivery Resolution** *(TMS — v1.1 addition)*
Dispatcher views all unresolved failed stops in the Failed Deliveries panel and chooses one of two actions:

| Action | What Happens |
|--------|-------------|
| **Reschedule** | Dispatcher selects a target route (planned or active) and a stop sequence. A new `pending` stop is created on that route. The SO status returns to `dispatched`. The original failed stop is marked `resolution: rescheduled`. |
| **Cancel** | Dispatcher provides a cancellation reason. The SO is set to `cancelled`. Any outstanding AR invoice for the SO is voided. The failed stop is marked `resolution: cancelled`. |

Once resolved, the stop disappears from the unresolved queue.

**Step 6 — Log Fuel** *(TMS)*
After completing the route, driver selects the completed route, enters liters used and distance driven. System computes fuel efficiency (km/L) automatically.

### Roles Involved

| Step | Role | Action |
|------|------|--------|
| Create Route | dispatcher · operations_manager | Plan stops and assign driver/vehicle |
| Start Route | driver | Begin delivery on mobile app |
| GPS Tracking | driver (sends) · dispatcher (views) | Real-time vehicle monitoring |
| Confirm Delivery | driver | POD with photo per stop |
| Failed Delivery | driver | Record failure reason on mobile |
| Reschedule / Cancel | dispatcher · operations_manager | Resolve failed stops in web dashboard |
| Fuel Log | driver | Post-route fuel and distance entry |

---

## Flow 4 — Workforce Management

Employee lifecycle from onboarding through daily shift scheduling, attendance clock-in/out with late detection, and login audit visibility.

### HRIS Workflow — HRIS

**Step 1 — Create Employee Account** *(HRIS)*
HR Manager creates a user record with employee code, full name, department, and assigned role. The role controls what the employee can access across all modules.

**Step 2 — Assign Shifts** *(HRIS)*
HR creates shift records (start time, end time, shift type) for employees. Shift types: `regular`, `overtime`, `rest_day`, `holiday`.

**Step 3 — Daily Attendance & Late Detection** *(HRIS — v1.1 addition)*
Employees clock in and out via `POST /hris/attendance`. The system computes attendance status automatically:

| Scenario | Status Assigned |
|----------|----------------|
| Clock-in within 15 minutes of scheduled start | `present` |
| Clock-in more than 15 minutes after scheduled start | `late` (with `late_minutes` recorded) |
| Shift start has passed by > 15 min, no clock-in recorded | `absent` (set by mark-absent job) |

**Late detection logic:**
- On clock-in, the system looks up the employee's shift for `CURRENT_DATE`.
- It computes `diff_minutes = NOW() − (shift_date + start_time)`.
- If `diff_minutes > 15`, shift status is updated to `late` and `late_minutes` is stored.
- The `clock_in` and `clock_out` timestamps are stored on the shift record (not just in `attendance_logs`).

**Absent marking:**
- HR or Operations Manager triggers `POST /hris/attendance/mark-absent`.
- The system updates all shifts for today where `clock_in IS NULL` and `start_time + 15 min` has already passed to `status = absent`.
- This is a manual trigger (intended to be run end-of-business-day).

**Step 4 — Login Audit** *(HRIS)*
Every login is recorded (timestamp, device type, IP address). HR and Operations Managers can view login history per employee with device icons for quick identification.

### Role Hierarchy & System-Wide Access

| Role | Modules | Key Responsibilities |
|------|---------|---------------------|
| system_admin | All modules | Full access to every operation and record |
| operations_manager | HRIS, Inventory, WMS, TMS, Finance | Create orders, manage inventory, oversee all operations |
| hr_manager · hr_staff | HRIS | Employee records, shift scheduling, attendance |
| wh_supervisor | Inventory, WMS | Generate pick/putaway/check tasks, dispatch orders |
| wh_operator | WMS, Inventory | Execute picks, receive goods, putaway |
| checker | WMS | Quality control of packed orders — read access to check tasks and SO details |
| dispatcher | WMS, TMS | Create delivery routes, monitor GPS, manage vehicles, resolve failed deliveries |
| driver | TMS | Start routes, confirm deliveries (POD or failed), log fuel |
| finance_officer | Finance | AP/AR invoice management and payment recording |

---

## Appendix — Key Status Lifecycles

### Sales Order Status

```
pending → packed → dispatched → delivered
                              → delivery_failed → dispatched (rescheduled)
                                               → cancelled
```

### Putaway Task Status

```
pending → completed
```

### Delivery Stop Status

```
pending → delivered
        → failed → (resolution: rescheduled | cancelled)
```

### Shift / Attendance Status

```
present (default) → present  (clocked in on time)
                  → late     (clocked in past grace period)
                  → absent   (never clocked in, end-of-day job)
```

---

*ERP System — Business Flow Documentation · Confidential · Internal Use Only · June 2026 · v1.1*
