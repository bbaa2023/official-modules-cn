import { NextResponse } from 'next/server'
import { ProductionWorkOrder } from '../../data/entities'
import { requireProductionContext, routeError } from '../helpers'

export const metadata = {
  method: 'GET' as const,
  path: '/api/production-work-orders/work-orders',
  requireAuth: true,
  requireFeatures: ['production_work_orders.view'],
}

export const openApi = {
  summary: 'List production work orders',
  tags: ['production_work_orders'],
}

export default async function GET(req: Request) {
  try {
    const { auth, em } = await requireProductionContext(req, 'production_work_orders.view')
    const url = new URL(req.url)
    const status = url.searchParams.get('status')
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 100)
    const where: Record<string, unknown> = {
      tenant_id: auth.tenantId,
      organization_id: auth.orgId,
      deleted_at: null,
    }
    if (status) where.status = status
    const [items, total] = await em.findAndCount(ProductionWorkOrder, where, {
      orderBy: { created_at: 'desc' },
      limit,
    })
    return NextResponse.json({ items, total })
  } catch (error) {
    return routeError(error)
  }
}
