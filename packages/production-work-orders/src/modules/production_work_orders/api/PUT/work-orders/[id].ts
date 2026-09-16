import { NextResponse } from 'next/server'
import { commandContext, requireProductionContext, routeError } from '../../helpers'

export const metadata = {
  method: 'PUT' as const,
  path: '/api/production-work-orders/work-orders/[id]',
  requireAuth: true,
  requireFeatures: ['production_work_orders.edit'],
}

export const openApi = {
  summary: 'Update a production work order',
  tags: ['production_work_orders'],
}

export default async function PUT(req: Request, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const { auth, container, commandBus } = await requireProductionContext(req, 'production_work_orders.edit')
    const resolved = await params
    const body = await req.json()
    const { result } = await commandBus.execute('production_work_orders.work_order.update', {
      input: { ...body, id: resolved.id },
      ctx: commandContext(req, container, auth),
    })
    return NextResponse.json(result)
  } catch (error) {
    return routeError(error)
  }
}
