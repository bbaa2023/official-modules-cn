import { NextResponse } from 'next/server'
import { ProductionWorkOrder, ProductionWorkOrderOperation } from '../../../data/entities'
import { requireProductionContext, routeError } from '../../helpers'

export const metadata = {
  method: 'GET' as const,
  path: '/api/production-work-orders/work-orders/[id]',
  requireAuth: true,
  requireFeatures: ['production_work_orders.view'],
}

export const openApi = {
  summary: 'Get a production work order with operations',
  tags: ['production_work_orders'],
}

export default async function GET(req: Request, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const { auth, em } = await requireProductionContext(req, 'production_work_orders.view')
    const resolved = await params
    const order = await em.findOne(ProductionWorkOrder, {
      id: resolved.id,
      tenant_id: auth.tenantId,
      organization_id: auth.orgId,
      deleted_at: null,
    })
    if (!order) return NextResponse.json({ error: 'Work order not found' }, { status: 404 })
    const operations = await em.find(ProductionWorkOrderOperation, {
      work_order_id: order.id,
      tenant_id: auth.tenantId,
      organization_id: auth.orgId,
      deleted_at: null,
    }, { orderBy: { sequence: 'asc' } })
    return NextResponse.json({ order, operations })
  } catch (error) {
    return routeError(error)
  }
}
