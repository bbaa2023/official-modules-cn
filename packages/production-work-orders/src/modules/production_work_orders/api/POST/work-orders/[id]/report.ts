import { NextResponse } from 'next/server'
import { commandContext, requireProductionContext, routeError } from '../../../helpers'

export const metadata = {
  method: 'POST' as const,
  path: '/api/production-work-orders/work-orders/[id]/report',
  requireAuth: true,
  requireFeatures: ['production_work_orders.report'],
}

export const openApi = {
  summary: 'Report completed production quantity',
  tags: ['production_work_orders'],
}

export default async function POST(req: Request, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const { auth, container, commandBus } = await requireProductionContext(req, 'production_work_orders.report')
    const resolved = await params
    const body = await req.json()
    const { result } = await commandBus.execute('production_work_orders.production.report', {
      input: { ...body, workOrderId: resolved.id },
      ctx: commandContext(req, container, auth),
    })
    return NextResponse.json(result)
  } catch (error) {
    return routeError(error)
  }
}
