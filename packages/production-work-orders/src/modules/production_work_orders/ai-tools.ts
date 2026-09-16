import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { defineAiTool } from '@open-mercato/ai-assistant/modules/ai_assistant/lib/ai-tool-definition'
import type { AiToolDefinition, McpToolContext } from '@open-mercato/ai-assistant/modules/ai_assistant/lib/types'
import { ProductionWorkOrder } from './data/entities'

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
  inputSchema: z.object({ status: z.string().optional(), limit: z.number().int().min(1).max(100).default(20) }),
  async handler(input, context) {
    const scope = requireToolScope(context)
    const parsed = z.object({ status: z.string().optional(), limit: z.number().int().min(1).max(100).default(20) }).parse(input)
    const em = context.container.resolve<EntityManager>('em')
    const where: Record<string, unknown> = { tenant_id: scope.tenantId, organization_id: scope.organizationId, deleted_at: null }
    if (parsed.status) where.status = parsed.status
    return em.find(ProductionWorkOrder, where, { limit: parsed.limit, orderBy: { created_at: 'desc' } })
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
    return em.findOne(ProductionWorkOrder, { id, tenant_id: scope.tenantId, organization_id: scope.organizationId, deleted_at: null })
  },
})

export const aiTools: AiToolDefinition[] = [listTool, getTool]
export default aiTools
