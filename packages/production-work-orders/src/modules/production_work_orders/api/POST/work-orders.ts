import { NextResponse } from 'next/server'
import { commandContext, requireProductionContext, routeError } from '../helpers'

export const metadata = {
  method: 'POST' as const,
  path: '/api/production-work-orders/work-orders',
  requireAuth: true,
  requireFeatures: ['production_work_orders.create'],
}

export const openApi = {
  summary: 'Create a production work order',
  tags: ['production_work_orders'],
}

export default async function POST(req: Request) {
  try {
    const { auth, container, commandBus } = await requireProductionContext(req, 'production_work_orders.create')
    const body = await req.json()
    const { result } = await commandBus.execute('production_work_orders.work_order.create', {
      input: { ...body, tenantId: auth.tenantId, organizationId: auth.orgId },
      ctx: commandContext(req, container, auth),
    })
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return routeError(error)
  }
}
