import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { EntityManager } from '@mikro-orm/postgresql'
import { ProductionWorkOrder, ProductionWorkOrderOperation } from '../data/entities'
import { createWorkOrderSchema, updateWorkOrderSchema, transitionWorkOrderSchema, type CreateWorkOrderInput, type UpdateWorkOrderInput, type TransitionWorkOrderInput } from '../data/validators'

const assertScope = (ctx: any, tenantId: string, organizationId: string) => {
  if (ctx.auth?.tenantId && ctx.auth.tenantId !== tenantId) throw new CrudHttpError(403, { error: 'Tenant scope mismatch' })
  if (ctx.auth?.orgId && ctx.auth.orgId !== organizationId) throw new CrudHttpError(403, { error: 'Organization scope mismatch' })
}

const findOrder = async (em: EntityManager, id: string, tenantId: string, organizationId: string) =>
  em.findOne(ProductionWorkOrder, { id, tenant_id: tenantId, organization_id: organizationId, deleted_at: null })

const replaceOperations = async (em: EntityManager, order: ProductionWorkOrder, operations: CreateWorkOrderInput['operations']) => {
  const current = await em.find(ProductionWorkOrderOperation, { work_order_id: order.id, tenant_id: order.tenant_id, organization_id: order.organization_id, deleted_at: null })
  for (const operation of current) {
    operation.deleted_at = new Date()
    operation.is_active = false
  }
  for (const operation of operations) {
    em.persist(em.create(ProductionWorkOrderOperation, {
      tenant_id: order.tenant_id,
      organization_id: order.organization_id,
      work_order_id: order.id,
      sequence: operation.sequence,
      name: operation.name,
      work_center_id: operation.workCenterId,
      standard_minutes: operation.standardMinutes,
    }))
  }
}

const createWorkOrder: CommandHandler<CreateWorkOrderInput, { id: string; orderNo: string }> = {
  id: 'production_work_orders.work_order.create',
  async execute(rawInput, ctx) {
    const input = createWorkOrderSchema.parse(rawInput)
    assertScope(ctx, input.tenantId, input.organizationId)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const duplicate = await em.findOne(ProductionWorkOrder, { tenant_id: input.tenantId, organization_id: input.organizationId, order_no: input.orderNo, deleted_at: null })
    if (duplicate) throw new CrudHttpError(409, { error: 'Work order number already exists' })
    const order = em.create(ProductionWorkOrder, {
      tenant_id: input.tenantId,
      organization_id: input.organizationId,
      order_no: input.orderNo,
      product_id: input.productId,
      planned_quantity: input.plannedQuantity,
      due_date: input.dueDate,
      priority: input.priority,
      notes: input.notes,
    })
    em.persist(order)
    for (const operation of input.operations) {
      em.persist(em.create(ProductionWorkOrderOperation, {
        tenant_id: input.tenantId,
        organization_id: input.organizationId,
        work_order_id: order.id,
        sequence: operation.sequence,
        name: operation.name,
        work_center_id: operation.workCenterId,
        standard_minutes: operation.standardMinutes,
      }))
    }
    await em.flush()
    return { id: order.id, orderNo: order.order_no }
  },
}

const updateWorkOrder: CommandHandler<UpdateWorkOrderInput, { id: string }> = {
  id: 'production_work_orders.work_order.update',
  async execute(rawInput, ctx) {
    const input = updateWorkOrderSchema.parse(rawInput)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const tenantId = ctx.auth?.tenantId
    const organizationId = ctx.auth?.orgId
    if (!tenantId || !organizationId) throw new CrudHttpError(401, { error: 'Authentication required' })
    const order = await findOrder(em, input.id, tenantId, organizationId)
    if (!order) throw new CrudHttpError(404, { error: 'Work order not found' })
    if (order.status === 'completed' || order.status === 'cancelled') throw new CrudHttpError(409, { error: 'Terminal work orders cannot be edited' })
    if (input.orderNo !== undefined && input.orderNo !== order.order_no) {
      const duplicate = await em.findOne(ProductionWorkOrder, { tenant_id: tenantId, organization_id: organizationId, order_no: input.orderNo, deleted_at: null, id: { $ne: order.id } })
      if (duplicate) throw new CrudHttpError(409, { error: 'Work order number already exists' })
      order.order_no = input.orderNo
    }
    if (input.productId !== undefined) order.product_id = input.productId
    if (input.plannedQuantity !== undefined) order.planned_quantity = input.plannedQuantity
    if (input.dueDate !== undefined) order.due_date = input.dueDate
    if (input.priority !== undefined) order.priority = input.priority
    if (input.notes !== undefined) order.notes = input.notes
    if (input.operations !== undefined) await replaceOperations(em, order, input.operations)
    await em.flush()
    return { id: order.id }
  },
}

const transitionWorkOrder: CommandHandler<TransitionWorkOrderInput, { id: string; status: string }> = {
  id: 'production_work_orders.work_order.transition',
  async execute(rawInput, ctx) {
    const input = transitionWorkOrderSchema.parse(rawInput)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const tenantId = ctx.auth?.tenantId
    const organizationId = ctx.auth?.orgId
    if (!tenantId || !organizationId) throw new CrudHttpError(401, { error: 'Authentication required' })
    const order = await findOrder(em, input.id, tenantId, organizationId)
    if (!order) throw new CrudHttpError(404, { error: 'Work order not found' })
    const allowed: Record<string, string[]> = {
      draft: ['planned', 'cancelled'],
      planned: ['released', 'cancelled'],
      released: ['in_progress', 'cancelled'],
      in_progress: ['completed', 'cancelled'],
      completed: [],
      cancelled: [],
    }
    if (!allowed[order.status]?.includes(input.status)) throw new CrudHttpError(409, { error: `Invalid status transition: ${order.status} -> ${input.status}` })
    order.status = input.status
    await em.flush()
    return { id: order.id, status: order.status }
  },
}

const deleteWorkOrder: CommandHandler<{ id: string }, { id: string }> = {
  id: 'production_work_orders.work_order.delete',
  async execute(rawInput, ctx) {
    const id = String(rawInput.id)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const tenantId = ctx.auth?.tenantId
    const organizationId = ctx.auth?.orgId
    if (!tenantId || !organizationId) throw new CrudHttpError(401, { error: 'Authentication required' })
    const order = await findOrder(em, id, tenantId, organizationId)
    if (!order) throw new CrudHttpError(404, { error: 'Work order not found' })
    order.deleted_at = new Date()
    order.is_active = false
    const operations = await em.find(ProductionWorkOrderOperation, { work_order_id: order.id, tenant_id: tenantId, organization_id: organizationId, deleted_at: null })
    for (const operation of operations) {
      operation.deleted_at = new Date()
      operation.is_active = false
    }
    await em.flush()
    return { id: order.id }
  },
}

registerCommand(createWorkOrder)
registerCommand(updateWorkOrder)
registerCommand(transitionWorkOrder)
registerCommand(deleteWorkOrder)
