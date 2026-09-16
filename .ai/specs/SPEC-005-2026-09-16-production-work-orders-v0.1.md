# SPEC-005 — Production Work Orders V0.1

## TLDR

- Package: `@open-mercato/production-work-orders`
- Module ID: `production_work_orders`
- Value: provide a minimal production work-order capability as an external Open Mercato module without modifying core packages.

## Scope

V0.1 covers production work-order master data and execution state:

- work order number
- product reference by cross-module ID
- planned quantity
- due date
- priority
- status
- operation sequence
- work-center reference by ID
- standard minutes
- progress quantity field
- Chinese-first i18n
- RBAC features
- AI tool surface for read/query and approval-gated mutation requests

Undo/audit snapshots, automatic CRUD side effects/indexing, BOM/MRP, capacity optimization, shop-floor barcode flows, costing, quality management, and automatic inventory consumption are deferred to the next implementation phase.

## Architecture

The module lives under `packages/production-work-orders/` and uses UMES extension points only. Cross-module references are UUID/string IDs; no cross-module ORM relations are introduced.

Entities:

- `ProductionWorkOrder`
- `ProductionWorkOrderOperation`

Both are tenant/organization scoped and use UUID primary keys plus standard timestamps and soft-delete/activity fields.

## Status model

`draft -> planned -> released -> in_progress -> completed`

Cancellation is allowed from non-terminal states: `cancelled`.

State transitions are validated by commands so HTTP and AI mutation paths share one business mutation boundary.

## RBAC

- `production_work_orders.view`
- `production_work_orders.create`
- `production_work_orders.edit`
- `production_work_orders.delete`
- `production_work_orders.release`

Superadmin receives all features; admin receives view/create/edit/release; employee receives view.

## API surface

- list/detail work orders
- create/update/delete work orders
- transition status
- replace the ordered operation set during create/update

Every protected route declares auth and feature requirements and OpenAPI metadata. Queries are scoped by tenant and organization.

## UI

V0.1 currently provides the backend work-order list surface. Detail/edit/create UI is the next UI increment and will consume the already implemented APIs rather than introducing a second business layer.

## AI

- `production_work_orders.list`
- `production_work_orders.get`
- `production_work_orders.create`
- `production_work_orders.update`
- `production_work_orders.transition`

Read tools are directly queryable. Mutation tools are marked `isMutation: true`, reuse the documented API routes through the platform operation runner, and use `loadBeforeRecord` where a before/after diff is available. The agent uses `mutationPolicy: 'confirm-required'`, so persistence is approval-gated by the platform runtime.

## Delivery phases

1. Scaffold package and module metadata.
2. Implement entities, validators, ACL/setup and i18n.
3. Implement commands, scoped operation replacement, and status state machine.
4. Implement list/detail APIs and backend list UI.
5. Add read tools, approval-gated mutation tools, and production assistant agent.
6. Add detail/edit UI, audit/undo, integration tests, and repository-level verification.

## Non-goals

No modification of `open-mercato` core packages. No hand-written database migrations. No direct cross-module entity imports.
