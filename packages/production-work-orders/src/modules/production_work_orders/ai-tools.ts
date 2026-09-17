import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { defineAiTool } from '@open-mercato/ai-assistant/modules/ai_assistant/lib/ai-tool-definition'
import { createAiApiOperationRunner } from '@open-mercato/ai-assistant/modules/ai_assistant/lib/ai-api-operation-runner'
import { ProductionWorkOrder, ProductionWorkOrderOperation } from './data/entities'
import { createWorkOrderSchema, updateWorkOrderSchema, transitionWorkOrderSchema, productionReportSchema, operationReportSchema } from './data/validators'

const statusSchema = z.enum(['draft', 'planned', 'released', 'in_progress', 'completed', 'cancelled'])

function requireToolScope(context: any) {
  const tenantId = typeof context.tenantId === 'string' ? context.tenantId.trim() : ''
  const organizationId = typeof context.organizationId === 'string' ? context.organizationId.trim() : ''
  if (!tenantId || !organizationId) throw new Error('[internal] production work-order AI tools require scoped context')
  return { tenantId, organizationId }
}

const listTool = defineAiTool({
  name: 'production_work_orders.list', displayName: 'Production — list work orders',
  description: 'List production work orders for the current tenant and organization. Scope is supplied by the runtime.',
  tags: ['read', 'production'], isMutation: false, requiredFeatures: ['production_work_orders.view'],
  inputSchema: z.object({ status: statusSchema.optional(), limit: z.number().int().min(1).max(100).default(20) }),
  async handler(input, context) {
    const scope = requireToolScope(context); const parsed = z.object({ status: statusSchema.optional(), limit: z.number().int().min(1).max(100).default(20) }).parse(input)
    const em = context.container.resolve<EntityManager>('em')
    const where: Record<string, unknown> = { tenant_id: scope.tenantId, organization_id: scope.organizationId, deleted_at: null }
    if (parsed.status) where.status = parsed.status
    const rows = await em.find(ProductionWorkOrder, where, { limit: parsed.limit, orderBy: { created_at: 'desc' } })
    return rows.map((row) => ({ id: row.id, orderNo: row.order_no, productId: row.product_id, plannedQuantity: Number(row.planned_quantity), completedQuantity: Number(row.completed_quantity), dueDate: row.due_date?.toISOString() ?? null, priority: row.priority, status: row.status, notes: row.notes ?? null }))
  },
})

const getTool = defineAiTool({
  name: 'production_work_orders.get', displayName: 'Production — get work order',
  description: 'Get one production work order by id within the current tenant and organization.',
  tags: ['read', 'production'], isMutation: false, requiredFeatures: ['production_work_orders.view'],
  inputSchema: z.object({ id: z.string().uuid() }),
  async handler(input, context) {
    const scope = requireToolScope(context); const { id } = z.object({ id: z.string().uuid() }).parse(input); const em = context.container.resolve<EntityManager>('em')
    const row = await em.findOne(ProductionWorkOrder, { id, tenant_id: scope.tenantId, organization_id: scope.organizationId, deleted_at: null })
    if (!row) return null
    const operations = await em.find(ProductionWorkOrderOperation, { work_order_id: row.id, tenant_id: scope.tenantId, organization_id: scope.organizationId, deleted_at: null }, { orderBy: { sequence: 'asc' } })
    return { id: row.id, orderNo: row.order_no, productId: row.product_id, plannedQuantity: Number(row.planned_quantity), completedQuantity: Number(row.completed_quantity), remainingQuantity: Math.max(0, Number(row.planned_quantity) - Number(row.completed_quantity)), progressPercent: Number(row.planned_quantity) > 0 ? Math.round((Number(row.completed_quantity) / Number(row.planned_quantity)) * 10000) / 100 : 0, dueDate: row.due_date?.toISOString() ?? null, priority: row.priority, status: row.status, notes: row.notes ?? null, operations: operations.map((operation) => ({ id: operation.id, sequence: operation.sequence, name: operation.name, workCenterId: operation.work_center_id ?? null, standardMinutes: operation.standard_minutes == null ? null : Number(operation.standard_minutes), completedQuantity: Number(operation.completed_quantity), actualMinutes: Number(operation.actual_minutes), executionStatus: operation.execution_status, startedAt: operation.started_at?.toISOString() ?? null, completedAt: operation.completed_at?.toISOString() ?? null })) }
  },
})

const analysisTool = defineAiTool({
  name: 'production_work_orders.analyze', displayName: 'Production — analyze execution',
  description: 'Analyze production progress, due-soon orders and potential delay risks using current tenant and organization data. Read-only.',
  tags: ['read', 'analysis', 'production'], isMutation: false, requiredFeatures: ['production_work_orders.analyze'],
  inputSchema: z.object({ dueSoonDays: z.number().int().min(1).max(30).default(3), limit: z.number().int().min(1).max(100).default(50) }),
  async handler(input, context) {
    const scope = requireToolScope(context); const parsed = z.object({ dueSoonDays: z.number().int().min(1).max(30).default(3), limit: z.number().int().min(1).max(100).default(50) }).parse(input); const em = context.container.resolve<EntityManager>('em')
    const rows = await em.find(ProductionWorkOrder, { tenant_id: scope.tenantId, organization_id: scope.organizationId, deleted_at: null }, { limit: parsed.limit, orderBy: { due_date: 'asc' } }); const now = new Date(); const dueSoonUntil = new Date(now.getTime() + parsed.dueSoonDays * 24 * 60 * 60 * 1000); const active = rows.filter((row) => row.status === 'released' || row.status === 'in_progress')
    const items = rows.map((row) => { const planned = Number(row.planned_quantity); const completed = Number(row.completed_quantity); const progress = planned > 0 ? completed / planned : 0; const dueSoon = !!row.due_date && row.due_date <= dueSoonUntil && row.due_date >= now && row.status !== 'completed' && row.status !== 'cancelled'; const overdue = !!row.due_date && row.due_date < now && row.status !== 'completed' && row.status !== 'cancelled'; const lowProgress = (row.status === 'released' || row.status === 'in_progress') && progress < 0.5; return { id: row.id, orderNo: row.order_no, status: row.status, plannedQuantity: planned, completedQuantity: completed, remainingQuantity: Math.max(0, planned - completed), progressPercent: Math.round(progress * 10000) / 100, dueDate: row.due_date?.toISOString() ?? null, dueSoon, overdue, lowProgress, risk: overdue ? 'overdue' : lowProgress && dueSoon ? 'high' : lowProgress || dueSoon ? 'medium' : 'normal' } })
    return { summary: { total: rows.length, active: active.length, overdue: items.filter((item) => item.overdue).length, dueSoon: items.filter((item) => item.dueSoon).length, lowProgress: items.filter((item) => item.lowProgress).length, completed: rows.filter((row) => row.status === 'completed').length }, risks: items.filter((item) => item.risk !== 'normal').sort((a, b) => (a.risk === 'overdue' ? -1 : b.risk === 'overdue' ? 1 : b.progressPercent - a.progressPercent)), items }
  },
})

const createTool = defineAiTool({
  name: 'production_work_orders.create', displayName: 'Production — create work order', description: 'Create a production work order. The platform approval card must be confirmed before persistence.',
  tags: ['mutation', 'production'], isMutation: true, requiredFeatures: ['production_work_orders.create'], inputSchema: createWorkOrderSchema.omit({ tenantId: true, organizationId: true }),
  async handler(input, context) { requireToolScope(context); const parsed = createWorkOrderSchema.omit({ tenantId: true, organizationId: true }).parse(input); const runner = createAiApiOperationRunner(context as any); const response = await runner.run({ method: 'POST', path: '/production-work-orders/work-orders', body: parsed as Record<string, unknown> }); if (!response.success) throw new Error(response.error ?? 'Failed to create production work order'); return response.data },
})

const updateTool = defineAiTool({
  name: 'production_work_orders.update', displayName: 'Production — update work order', description: 'Update a production work order. The platform approval card must be confirmed before persistence.',
  tags: ['mutation', 'production'], isMutation: true, requiredFeatures: ['production_work_orders.edit'], inputSchema: updateWorkOrderSchema,
  loadBeforeRecord: async (input, context) => { const scope = requireToolScope(context); const parsed = updateWorkOrderSchema.parse(input); const em = context.container.resolve<EntityManager>('em'); const row = await em.findOne(ProductionWorkOrder, { id: parsed.id, tenant_id: scope.tenantId, organization_id: scope.organizationId, deleted_at: null }); if (!row) return null; return { recordId: row.id, entityType: 'production_work_orders.work_order', recordVersion: row.updated_at?.toISOString() ?? null, before: { orderNo: row.order_no, productId: row.product_id, plannedQuantity: row.planned_quantity, dueDate: row.due_date?.toISOString() ?? null, priority: row.priority, notes: row.notes ?? null } } },
  async handler(input, context) { requireToolScope(context); const parsed = updateWorkOrderSchema.parse(input); const runner = createAiApiOperationRunner(context as any); const { id, ...body } = parsed; const response = await runner.run({ method: 'PUT', path: `/production-work-orders/work-orders/${id}`, body: body as Record<string, unknown> }); if (!response.success) throw new Error(response.error ?? 'Failed to update production work order'); return { recordId: id, result: response.data } },
})

const transitionTool = defineAiTool({
  name: 'production_work_orders.transition', displayName: 'Production — transition work order', description: 'Move a production work order through its state machine. The platform approval card must be confirmed before persistence.',
  tags: ['mutation', 'production'], isMutation: true, requiredFeatures: ['production_work_orders.release'], inputSchema: transitionWorkOrderSchema,
  loadBeforeRecord: async (input, context) => { const scope = requireToolScope(context); const parsed = transitionWorkOrderSchema.parse(input); const em = context.container.resolve<EntityManager>('em'); const row = await em.findOne(ProductionWorkOrder, { id: parsed.id, tenant_id: scope.tenantId, organization_id: scope.organizationId, deleted_at: null }); if (!row) return null; return { recordId: row.id, entityType: 'production_work_orders.work_order', recordVersion: row.updated_at?.toISOString() ?? null, before: { status: row.status }, requested: { status: parsed.status } } },
  async handler(input, context) { requireToolScope(context); const parsed = transitionWorkOrderSchema.parse(input); const runner = createAiApiOperationRunner(context as any); const response = await runner.run({ method: 'PUT', path: `/production-work-orders/work-orders/${parsed.id}/status`, body: { status: parsed.status } }); if (!response.success) throw new Error(response.error ?? 'Failed to transition production work order'); return { recordId: parsed.id, result: response.data } },
})

const reportTool = defineAiTool({
  name: 'production_work_orders.report', displayName: 'Production — report quantity', description: 'Propose a production quantity report. Persistence requires platform mutation approval.',
  tags: ['mutation', 'production'], isMutation: true, requiredFeatures: ['production_work_orders.report'], inputSchema: productionReportSchema,
  async handler(input, context) { requireToolScope(context); const parsed = productionReportSchema.parse(input); const runner = createAiApiOperationRunner(context as any); const { workOrderId, ...body } = parsed; const response = await runner.run({ method: 'POST', path: `/production-work-orders/work-orders/${workOrderId}/report`, body: body as Record<string, unknown> }); if (!response.success) throw new Error(response.error ?? 'Failed to report production quantity'); return { recordId: workOrderId, result: response.data } },
})

const operationReportTool = defineAiTool({
  name: 'production_work_orders.report_operation', displayName: 'Production — report operation quantity', description: 'Propose an operation quantity report. Persistence requires platform mutation approval.',
  tags: ['mutation', 'production'], isMutation: true, requiredFeatures: ['production_work_orders.execute'], inputSchema: operationReportSchema,
  async handler(input, context) { requireToolScope(context); const parsed = operationReportSchema.parse(input); const runner = createAiApiOperationRunner(context as any); const { workOrderId, operationId, ...body } = parsed; const response = await runner.run({ method: 'POST', path: `/production-work-orders/work-orders/${workOrderId}/operations/${operationId}/report`, body: body as Record<string, unknown> }); if (!response.success) throw new Error(response.error ?? 'Failed to report operation quantity'); return { recordId: operationId, result: response.data } },
})

export const aiTools = [listTool, getTool, analysisTool, createTool, updateTool, transitionTool, reportTool, operationReportTool]
export default aiTools
