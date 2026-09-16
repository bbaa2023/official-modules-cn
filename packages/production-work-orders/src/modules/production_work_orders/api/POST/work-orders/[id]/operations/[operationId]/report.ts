import { NextResponse } from 'next/server'
import { commandContext, requireProductionContext, routeError } from '../../../../../../helpers'

export const metadata = {
  method: 'POST' as const,
  path: '/api/production-work-orders/work-orders/[id]/operations/[operationId]/report',
  requireAuth: true,
  requireFeatures: ['production_work_orders.execute'],
}

export const openApi = {
  summary: 'Report production quantity for an operation',
  tags: ['production_work_orders'],
}

export default async function POST(req: Request, { params }: { params: Promise<{ id: string; operationId: string }> | { id: string; operationId: string } }) {
  try {
    const { auth, container, commandBus } = await requireProductionContext(req, 'production_work_orders.execute')
    const resolved = await params
    const body = await req.json()
    const { result } = await commandBus.execute('production_work_orders.operation.report', {
      input: { ...body, workOrderId: resolved.id, operationId: resolved.operationId },
      ctx: commandContext(req, container, auth),
    })
    return NextResponse.json(result)
  } catch (error) {
    return routeError(error)
  }
}
