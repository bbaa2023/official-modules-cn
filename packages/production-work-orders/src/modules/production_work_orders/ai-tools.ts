import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { defineAiTool } from '@open-mercato/ai-assistant/modules/ai_assistant/lib/ai-tool-definition'
import { createAiApiOperationRunner } from '@open-mercato/ai-assistant/modules/ai_assistant/lib/ai-api-operation-runner'
import type { AiToolDefinition, McpToolContext } from '@open-mercato/ai-assistant/modules/ai_assistant/lib/types'
import { ProductionWorkOrder } from './data/entities'
import { createWorkOrderSchema, updateWorkOrderSchema, transitionWorkOrderSchema } from './data/validators'

function requireToolScope(context: Pick<McpToolContext, 'tenantId' | 'organizationId'>) {
  const tenantId = typeof context.tenantId === 'string' ? context.tenantId.trim() : ''
  const organizationId = typeof context.organizationId === 'string' ? context.organizationId.trim() : ''
  if (!tenantId || !organizationId) throw new Error('[internal] production work-order AI tools require scoped context')
  return { tenantId, organizationId }
}

const listTool: AiToolDefinition = defineAiTool({
  name: 'production_work_orders.list',
  displayName: 'Production — list work orders',
  description: 'List production work orders for the current tenant and organization. Scope is supplied by the runtime.',
  tags: ['read', 'production'],
  isMutation: false,
  requiredFeatures: ['production_work_orders.view'],
  inputSchema: z.object({ status: z.enum(['draft', 'planned', 'released', 'in_progress', 'completed', 'cancelled']).optional(), limit: z.number().int().min(1).max(100).default(20) }),
  async handler(input, context) {
    const scope = requireToolScope(context)
    const parsed = z.object({ status: z.enum(['draft', 'planned', 'released', 'in_progress', 'completed', 'cancelled']).optional(), limit: z.number().int().min(1).max(100).default(20) }).parse(input)
    const em = context.container.resolve<EntityManager>('em')
    const where: Record<string, unknown> = { tenant_id: scope.tenantId, organization_id: scope.organizationId, deleted_at: null }
    if (parsed.status) where.status = parsed.status
    const rows = await em.find(ProductionWorkOrder, where, { limit: parsed.limit, orderBy: { created_at: 'desc' } })
    return rows.map((row) => ({
      id: row.id,
      orderNo: row.order_no,
      productId: row.product_id,
      plannedQuantity: row.planned_quantity,
      completedQuantity: row.completed_quantity,
      dueDate: row.due_date?.toISOString() ?? null,
      priority: row.priority,
      status: row.status,
      notes: row.notes ?? null,
    }))
  },
})

const getTool: AiToolDefinition = defineAiTool({
  name: 'production_work_orders.get',
  displayName: 'Production — get work order',
  description: 'Get one production work order by id within the current tenant and organization.',
  tags: ['read', 'production'],
  isMutation: false,
  requiredFeatures: ['production_work_orders.view'],
  inputSchema: z.object({ id: z.string().uuid() }),
  async handler(input, context) {
    const scope = requireToolScope(context)
    const { id } = z.object({ id: z.string().uuid() }).parse(input)
    const em = context.container.resolve<EntityManager>('em')
    const row = await em.findOne(ProductionWorkOrder, { id, tenant_id: scope.tenantId, organization_id: scope.organizationId, deleted_at: null })
    if (!row) return null
    return {
      id: row.id,
      orderNo: row.order_no,
      productId: row.product_id,
      plannedQuantity: row.planned_quantity,
      completedQuantity: row.completed_quantity,
      dueDate: row.due_date?.toISOString() ?? null,
      priority: row.priority,
      status: row.status,
      notes: row.notes ?? null,
    }
  },
})

const createTool: AiToolDefinition = defineAiTool({
  name: 'production_work_orders.create',
  displayName: 'Production — create work order',
  description: 'Create a production work order. The platform approval card must be confirmed before persistence.',
  tags: ['mutation', 'production'],
  isMutation: true,
  requiredFeatures: ['production_work_orders.create'],
  inputSchema: createWorkOrderSchema.omit({ tenantId: true, organizationId: true }),
  async handler(input, context) {
    requireToolScope(context)
    const parsed = createWorkOrderSchema.omit({ tenantId: true, organizationId: true }).parse(input)
    const runner = createAiApiOperationRunner(context as any)
    const response = await runner.run({ method: 'POST', path: '/production-work-orders/work-orders', body: parsed as Record<string, unknown> })
    if (!response.success) throw new Error(response.error ?? 'Failed to create production work order')
    return response.data
  },
})

const updateTool: AiToolDefinition = defineAiTool({
  name: 'production_work_orders.update',
  displayName: 'Production — update work order',
  description: 'Update a production work order. The platform approval card must be confirmed before persistence.',
  tags: ['mutation', 'production'],
  isMutation: true,
  requiredFeatures: ['production_work_orders.edit'],
  inputSchema: updateWorkOrderSchema,
  loadBeforeRecord: async (input, context) => {
    const scope = requireToolScope(context)
    const parsed = updateWorkOrderSchema.parse(input)
    const em = context.container.resolve<EntityManager>('em')
    const row = await em.findOne(ProductionWorkOrder, { id: parsed.id, tenant_id: scope.tenantId, organization_id: scope.organizationId, deleted_at: null })
    if (!row) return null
    return { recordId: row.id, entityType: 'production_work_orders.work_order', recordVersion: row.updated_at?.toISOString() ?? null, before: { orderNo: row.order_no, productId: row.product_id, plannedQuantity: row.planned_quantity, dueDate: row.due_date?.toISOString() ?? null, priority: row.priority, notes: row.notes ?? null } }
  },
  async handler(input, context) {
    requireToolScope(context)
    const parsed = updateWorkOrderSchema.parse(input)
    const runner = createAiApiOperationRunner(context as any)
    const { id, ...body } = parsed
    const response = await runner.run({ method: 'PUT', path: `/production-work-orders/work-orders/${id}`, body: body as Record<string, unknown> })
    if (!response.success) throw new Error(response.error ?? 'Failed to update production work order')
    return { recordId: id, result: response.data }
  },
})

const transitionTool: AiToolDefinition = defineAiTool({
  name: 'production_work_orders.transition',
  displayName: 'Production — transition work order',
  description: 'Move a production work order through its state machine. The platform approval card must be confirmed before persistence.',
  tags: ['mutation', 'production'],
  isMutation: true,
  requiredFeatures: ['production_work_orders.release'],
  inputSchema: transitionWorkOrderSchema,
  loadBeforeRecord: async (input, context) => {
    const scope = requireToolScope(context)
    const parsed = transitionWorkOrderSchema.parse(input)
    const em = context.container.resolve<EntityManager>('em')
    const row = await em.findOne(ProductionWorkOrder, { id: parsed.id, tenant_id: scope.tenantId, organization_id: scope.organizationId, deleted_at: null })
    if (!row) return null
    return { recordId: row.id, entityType: 'production_work_orders.work_order', recordVersion: row.updated_at?.toISOString() ?? null, before: { status: row.status }, requested: { status: parsed.status } }
  },
  async handler(input, context) {
    requireToolScope(context)
    const parsed = transitionWorkOrderSchema.parse(input)
    const runner = createAiApiOperationRunner(context as any)
    const response = await runner.run({ method: 'PUT', path: `/production-work-orders/work-orders/${parsed.id}/status`, body: { status: parsed.status } })
    if (!response.success) throw new Error(response.error ?? 'Failed to transition production work order')
    return { recordId: parsed.id, result: response.data }
  },
})

export const aiTools: AiToolDefinition[] = [listTool, getTool, createTool, updateTool, transitionTool]
export default aiTools
