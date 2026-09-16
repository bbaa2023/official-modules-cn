import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { EntityManager } from '@mikro-orm/postgresql'
import { ProductionWorkOrder, ProductionWorkOrderOperation, ProductionWorkOrderReport } from '../data/entities'
import { productionReportSchema, operationReportSchema, operationExecutionStatusSchema, type ProductionReportInput, type OperationReportInput, type OperationExecutionStatus } from '../data/validators'

const scope = (ctx: any) => {
  const tenantId = ctx.auth?.tenantId
  const organizationId = ctx.auth?.orgId
  if (!tenantId || !organizationId) throw new CrudHttpError(401, { error: 'Authentication required' })
  return { tenantId, organizationId }
}

const findOrder = async (em: EntityManager, id: string, tenantId: string, organizationId: string) =>
  em.findOne(ProductionWorkOrder, { id, tenant_id: tenantId, organization_id: organizationId, deleted_at: null })

const allowedOperationTransitions: Record<OperationExecutionStatus, OperationExecutionStatus[]> = {
  pending: ['in_progress'],
  in_progress: ['paused', 'completed'],
  paused: ['in_progress'],
  completed: [],
}

const assertOperationTransition = (current: string, next: OperationExecutionStatus) => {
  const currentStatus = operationExecutionStatusSchema.parse(current)
  if (!allowedOperationTransitions[currentStatus]?.includes(next)) {
    throw new CrudHttpError(409, { error: `Invalid operation status transition: ${currentStatus} -> ${next}` })
  }
}

const reportProduction: CommandHandler<ProductionReportInput, { id: string; completedQuantity: number; remainingQuantity: number }> = {
  id: 'production_work_orders.production.report',
  async execute(rawInput, ctx) {
    const input = productionReportSchema.parse(rawInput)
    const { tenantId, organizationId } = scope(ctx)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const order = await findOrder(em, input.workOrderId, tenantId, organizationId)
    if (!order) throw new CrudHttpError(404, { error: 'Work order not found' })
    if (order.status === 'draft' || order.status === 'planned' || order.status === 'cancelled' || order.status === 'completed') throw new CrudHttpError(409, { error: 'Work order is not reportable in its current status' })
    const nextQuantity = Number(order.completed_quantity) + input.quantity
    if (nextQuantity > Number(order.planned_quantity)) throw new CrudHttpError(409, { error: 'Reported quantity cannot exceed planned quantity' })
    const report = em.create(ProductionWorkOrderReport, {
      tenant_id: tenantId, organization_id: organizationId, work_order_id: order.id,
      quantity: input.quantity, actual_minutes: input.actualMinutes ?? 0, reported_at: input.reportedAt ?? new Date(), note: input.note,
    })
    em.persist(report)
    order.completed_quantity = nextQuantity
    if (nextQuantity === Number(order.planned_quantity)) order.status = 'completed'
    await em.flush()
    return { id: report.id, completedQuantity: Number(order.completed_quantity), remainingQuantity: Math.max(0, Number(order.planned_quantity) - Number(order.completed_quantity)) }
  },
}

const reportOperation: CommandHandler<OperationReportInput, { id: string; completedQuantity: number; executionStatus: OperationExecutionStatus }> = {
  id: 'production_work_orders.operation.report',
  async execute(rawInput, ctx) {
    const input = operationReportSchema.parse(rawInput)
    const { tenantId, organizationId } = scope(ctx)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const order = await findOrder(em, input.workOrderId, tenantId, organizationId)
    if (!order) throw new CrudHttpError(404, { error: 'Work order not found' })
    if (order.status === 'draft' || order.status === 'planned' || order.status === 'cancelled' || order.status === 'completed') throw new CrudHttpError(409, { error: 'Work order is not executable in its current status' })
    const operation = await em.findOne(ProductionWorkOrderOperation, { id: input.operationId, work_order_id: order.id, tenant_id: tenantId, organization_id: organizationId, deleted_at: null })
    if (!operation) throw new CrudHttpError(404, { error: 'Operation not found' })
    const nextQuantity = Number(operation.completed_quantity) + input.quantity
    if (nextQuantity > Number(order.planned_quantity)) throw new CrudHttpError(409, { error: 'Operation quantity cannot exceed planned quantity' })

    if (input.executionStatus) {
      assertOperationTransition(operation.execution_status, input.executionStatus)
      if (input.executionStatus === 'completed' && nextQuantity < Number(order.planned_quantity)) {
        throw new CrudHttpError(409, { error: 'Operation cannot be completed before planned quantity is fully reported' })
      }
    }

    const report = em.create(ProductionWorkOrderReport, {
      tenant_id: tenantId, organization_id: organizationId, work_order_id: order.id, operation_id: operation.id,
      quantity: input.quantity, actual_minutes: input.actualMinutes ?? 0, reported_at: input.reportedAt ?? new Date(), note: input.note,
    })
    em.persist(report)
    operation.completed_quantity = nextQuantity
    operation.actual_minutes = Number(operation.actual_minutes) + (input.actualMinutes ?? 0)
    if (input.executionStatus) operation.execution_status = input.executionStatus
    if (operation.execution_status === 'in_progress' && !operation.started_at) operation.started_at = input.reportedAt ?? new Date()
    if (operation.execution_status === 'completed') operation.completed_at = input.reportedAt ?? new Date()
    await em.flush()
    return { id: report.id, completedQuantity: Number(operation.completed_quantity), executionStatus: operation.execution_status as OperationExecutionStatus }
  },
}

const setOperationExecutionStatus: CommandHandler<{ workOrderId: string; operationId: string; status: OperationExecutionStatus }, { id: string; status: OperationExecutionStatus }> = {
  id: 'production_work_orders.operation.set_execution_status',
  async execute(rawInput, ctx) {
    const input = { ...rawInput, status: operationExecutionStatusSchema.parse(rawInput.status) }
    const { tenantId, organizationId } = scope(ctx)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const order = await findOrder(em, input.workOrderId, tenantId, organizationId)
    if (!order) throw new CrudHttpError(404, { error: 'Work order not found' })
    if (order.status !== 'in_progress' && order.status !== 'released') throw new CrudHttpError(409, { error: 'Work order is not executable in its current status' })
    const operation = await em.findOne(ProductionWorkOrderOperation, { id: input.operationId, work_order_id: order.id, tenant_id: tenantId, organization_id: organizationId, deleted_at: null })
    if (!operation) throw new CrudHttpError(404, { error: 'Operation not found' })
    assertOperationTransition(operation.execution_status, input.status)
    if (input.status === 'completed' && Number(operation.completed_quantity) < Number(order.planned_quantity)) {
      throw new CrudHttpError(409, { error: 'Operation cannot be completed before planned quantity is fully reported' })
    }
    const now = new Date()
    operation.execution_status = input.status
    if (input.status === 'in_progress' && !operation.started_at) operation.started_at = now
    if (input.status === 'completed') operation.completed_at = now
    await em.flush()
    return { id: operation.id, status: operation.execution_status as OperationExecutionStatus }
  },
}

registerCommand(reportProduction)
registerCommand(reportOperation)
registerCommand(setOperationExecutionStatus)
