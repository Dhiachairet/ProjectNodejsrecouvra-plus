# Recouvra+: functional scope and business rules

This document lists the functional requirements (section 4 of the specification) and the business rules. Each rule has a stable ID (`BR-xx`) to reuse in the traceability matrix (requirement ↔ test ↔ tool ↔ result).

## Coverage of the specification (section 4)

| Requirement | Implementation |
|---|---|
| Authentication + ≥ 3 roles | JWT (`/api/auth/login`), roles `admin`, `manager`, `agent` (see the role matrix below) |
| ≥ 4 related entities with full CRUD | `User`, `Client`, `Invoice` (+ payments), `CollectionAction`. 1-N: Client → Invoices → Actions. **N-N: Client ↔ Agents** (`Client.assignedAgents`) |
| Status workflow | Collection actions: `planned → completed / failed / cancelled`, `failed → planned / cancelled` (`src/workflows/collectionAction.workflow.js`) |
| Dashboard with filters | `GET /api/stats?from&to&agent&client`, "Dashboard" page |
| Search / filtering on a high-volume entity | Invoices (2,000 after seeding): number, status, client, period, pagination. Clients: full-text search, filter by agent |
| Audit log | `AuditLog` model, `GET /api/audit` (admin), "Audit log" page |
| ≥ 5 business rules | BR-01 to BR-20 below |

## Role matrix

| Capability | Agent | Manager | Admin |
|---|---|---|---|
| View clients / invoices / actions | Own portfolio only (BR-14) | All | All |
| Create / edit clients, invoices, payments, actions | Own portfolio | Yes | Yes |
| Assign agents to a client (N-N) | No | Yes | Yes |
| Cancel a collection action | No | Yes | Yes |
| Delete a client | No | Yes | Yes |
| Delete an invoice / an action | No | No | Yes |
| List users | No | Yes | Yes |
| Edit / delete users | No | No | Yes |
| Read the audit log | No | No | Yes |

## Business rules

| ID | Rule | Where | Response when violated |
|---|---|---|---|
| BR-01 | Invoice numbers are unique | `invoice.controller.js` `createInvoice` + unique index | 400 |
| BR-02 | A payment cannot exceed the remaining balance | `invoice.controller.js` `addPayment` | 400 |
| BR-03 | A paid or cancelled invoice can no longer be edited and accepts no more payments | `updateInvoice`, `addPayment` | 400 |
| BR-04 | Cancelling an invoice requires a reason | `validateInvoiceUpdate` | 400 |
| BR-05 | A paid invoice, or one with collection actions, cannot be deleted | `deleteInvoice` | 400 |
| BR-06 | A client with invoices cannot be deleted | `client.controller.js` `deleteClient` | 400 |
| BR-07 | An invoice's status is computed: paid, partially paid, overdue (due date passed), unpaid | `Invoice.js` `pre('save')` hook | — |
| BR-08 | If an invoice has line items, its amount is the sum of the lines | `createInvoice` | — |
| BR-09 | An invoice's due date must be in the future | `validateInvoice`, `validateInvoiceUpdate` | 400 |
| BR-10 | No collection action on a paid invoice | `createCollectionAction` | 400 |
| BR-11 | The last admin cannot be deleted; users cannot delete themselves, deactivate themselves or change their own role | `user.controller.js` | 400 |
| BR-12 | A client's email is unique for a given creator | `createClient` | 400 |
| BR-13 | A client has at most 3 assigned agents, with no duplicates, and only active users with the agent role | `validateAssignAgents`, `assignAgents` | 400 |
| BR-14 | An agent only accesses their own portfolio: clients they created or are assigned to, and those clients' invoices and actions. An agent's dashboard is always restricted to that portfolio | `src/utils/access.js`, `stats.controller.js` | 403 or filtered results |
| BR-15 | Allowed transitions: `planned → completed / failed / cancelled`, `failed → planned / cancelled`; `completed` and `cancelled` are final | `collectionAction.workflow.js` | 409 |
| BR-16 | Completing or failing an action requires a result | `checkTransition` | 400 |
| BR-17 | Only a manager or an admin can cancel an action; an agent can only change the status of their own actions | `checkTransition`, `changeActionStatus` | 403 |
| BR-18 | Rescheduling a failed action requires a new date in the future | `checkTransition` | 400 |
| BR-19 | An action's status only changes through `PATCH /collections/:id/status`; every change is recorded in `statusHistory`; two simultaneous changes cannot both succeed | `validateCollectionActionUpdate`, `changeActionStatus` | 400 / 409 |
| BR-20 | The audit log is read-only and restricted to admins | `audit.routes.js` | 403 |

## Collection action workflow

```
            ┌──────────► completed   (result required, final)
            │
 planned ───┼──────────► failed ─────► planned   (new future date)
            │              │
            │              └─────────► cancelled
            │
            └──────────► cancelled   (manager/admin, final)
```

## Actions recorded in the audit log

| Area | Actions |
|---|---|
| Authentication | `auth.login`, `auth.login_failed` (unknown email, wrong password, deactivated account), `auth.register` |
| Users | `user.update` (fields, role/status before and after), `user.delete` |
| Clients | `client.create`, `client.update`, `client.delete`, `client.assign_agents` (before/after) |
| Invoices | `invoice.create`, `invoice.update`, `invoice.cancel` (reason), `invoice.delete`, `invoice.payment` |
| Collection actions | `action.create`, `action.update`, `action.status_change` (from → to), `action.delete` |

Each entry stores the user, their role, the entity and its ID, the details, the IP address, the user agent and the timestamp.
