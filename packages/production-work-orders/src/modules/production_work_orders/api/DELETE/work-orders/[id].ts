import { NextResponse } from 'next/server'
import { commandContext, requireProductionContext, routeError } from '../../helpers'

export const metadata = {
  method: 'DELETE' as const,
  path: '/api/production-work-orders/work-orders/[id]',
  requireAuth: true,
  requireFeatures: ['production_work_orders.delete'],
}

export const openApi = {
  summary: 'Delete a production work order',
  tags: ['production_work_orders'],
}

export default async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const { auth, container, commandBus } = await requireProductionContext(req, 'production_work_orders.delete')
    const resolved = await params
    const { result } = await commandBus.execute('production_work_orders.work_order.delete', {
      input: { id: resolved.id },
      ctx: commandContext(req, container, auth),
    })
    return NextResponse.json(result)
  } catch (error) {
    return routeError(error)
  }
}
