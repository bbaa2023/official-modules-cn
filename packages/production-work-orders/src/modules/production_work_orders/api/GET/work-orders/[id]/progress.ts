import { NextResponse } from 'next/server'
import { ProductionWorkOrder, ProductionWorkOrderOperation } from '../../../data/entities'
import { requireProductionContext, routeError } from '../../helpers'

export const metadata = {
  method: 'GET' as const,
  path: '/api/production-work-orders/work-orders/[id]/progress',
  requireAuth: true,
  requireFeatures: ['production_work_orders.view'],
}

export const openApi = {
  summary: 'Get production work order progress',
  tags: ['production_work_orders'],
}

export default async function GET(req: Request, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const { auth, em } = await requireProductionContext(req, 'production_work_orders.view')
    const { id } = await params
    const order = await em.findOne(ProductionWorkOrder, {
      id,
      tenant_id: auth.tenantId,
      organization_id: auth.orgId,
      deleted_at: null,
    })
    if (!order) return NextResponse.json({ error: 'Work order not found' }, { status: 404 })

    const planned = Number(order.planned_quantity)
    const completed = Number(order.completed_quantity)
    const remaining = Math.max(0, planned - completed)
    const progressPercent = planned > 0 ? Math.round((completed / planned) * 10000) / 100 : 0
    const operations = await em.find(ProductionWorkOrderOperation, {
      work_order_id: order.id,
      tenant_id: auth.tenantId,
      organization_id: auth.orgId,
      deleted_at: null,
    }, { orderBy: { sequence: 'asc' } })

    return NextResponse.json({
      workOrderId: order.id,
      orderNo: order.order_no,
      status: order.status,
      plannedQuantity: planned,
      completedQuantity: completed,
      remainingQuantity: remaining,
      progressPercent,
      operations: operations.map((operation) => {
        const operationCompleted = Number(operation.completed_quantity)
        const operationPercent = planned > 0 ? Math.round((operationCompleted / planned) * 10000) / 100 : 0
        return {
          id: operation.id,
          sequence: operation.sequence,
          name: operation.name,
          executionStatus: operation.execution_status,
          completedQuantity: operationCompleted,
          actualMinutes: Number(operation.actual_minutes),
          progressPercent: operationPercent,
        }
      }),
    })
  } catch (error) {
    return routeError(error)
  }
}
