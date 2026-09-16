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
- progress quantity
- audit/undo for mutations
- Chinese-first i18n
- RBAC features
- AI tool surface for read/query and mutation requests, with mutations executed through the command/approval path

V0.1 intentionally excludes MRP, BOM explosion, capacity optimization, shop-floor barcode flows, costing, quality management, and automatic inventory consumption.

## Architecture

The module lives under `packages/production-work-orders/` and uses UMES extension points only. Cross-module references are UUID/string IDs; no cross-module ORM relations are introduced.

Entities:

- `ProductionWorkOrder`
- `ProductionWorkOrderOperation`

Both are tenant/organization scoped and use UUID primary keys plus standard timestamps and soft-delete/activity fields.

## Status model

`draft -> planned -> released -> in_progress -> completed`

Cancellation is allowed from non-terminal states: `cancelled`.

State transitions are validated by commands so future approval and audit integration has one mutation boundary.

## RBAC

- `production_work_orders.view`
- `production_work_orders.create`
- `production_work_orders.edit`
- `production_work_orders.delete`
- `production_work_orders.release`

Superadmin receives all features; admin receives view/create/edit/release.

## API surface

- list/detail work orders
- create/update/delete work orders
- transition status
- manage ordered operations

Every protected route declares auth and feature requirements and OpenAPI metadata. Queries are scoped by tenant and organization.

## UI

Backend pages provide a work-order list and create/edit/detail flows using Open Mercato UI primitives. All user-visible strings are translation keys with Chinese defaults.

## AI

Initial tools:

- `production_work_orders.list`
- `production_work_orders.get`
- `production_work_orders.create`
- `production_work_orders.update`
- `production_work_orders.transition`

Read tools are directly queryable. Mutation tools invoke the same command IDs used by HTTP routes; approval behavior is delegated to the platform command/approval layer rather than bypassed in the AI tool.

## Delivery phases

1. Scaffold package and module metadata.
2. Implement entities, validators, ACL/setup and i18n.
3. Implement commands with undo/audit-compatible snapshots.
4. Implement APIs and backend UI.
5. Add AI tools and integration tests.
6. Run typecheck/build/tests and fix repository-level issues.

## Non-goals

No modification of `open-mercato` core packages. No hand-written database migrations. No direct cross-module entity imports.
