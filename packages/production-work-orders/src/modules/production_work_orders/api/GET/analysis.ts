import { NextResponse } from 'next/server'
import { ProductionWorkOrder } from '../../data/entities'
import { requireProductionContext, routeError } from '../helpers'

export const metadata = {
  method: 'GET' as const,
  path: '/api/production-work-orders/analysis',
  requireAuth: true,
  requireFeatures: ['production_work_orders.analyze'],
}

export const openApi = {
  summary: 'Analyze production execution risks',
  tags: ['production_work_orders'],
}

export default async function GET(req: Request) {
  try {
    const { auth, em } = await requireProductionContext(req, 'production_work_orders.analyze')
    const url = new URL(req.url)
    const parsedDays = Number(url.searchParams.get('dueSoonDays') ?? '3')
    const dueSoonDays = Number.isFinite(parsedDays) ? Math.min(30, Math.max(1, Math.trunc(parsedDays))) : 3
    const now = new Date()
    const dueSoonUntil = new Date(now.getTime() + dueSoonDays * 24 * 60 * 60 * 1000)
    const rows = await em.find(ProductionWorkOrder, {
      tenant_id: auth.tenantId,
      organization_id: auth.orgId,
      deleted_at: null,
    }, { orderBy: { due_date: 'asc' }, limit: 100 })

    const items = rows.map((row) => {
      const planned = Number(row.planned_quantity)
      const completed = Number(row.completed_quantity)
      const progressPercent = planned > 0 ? Math.round((completed / planned) * 10000) / 100 : 0
      const active = row.status === 'released' || row.status === 'in_progress'
      const overdue = !!row.due_date && row.due_date < now && row.status !== 'completed' && row.status !== 'cancelled'
      const dueSoon = !!row.due_date && row.due_date >= now && row.due_date <= dueSoonUntil && row.status !== 'completed' && row.status !== 'cancelled'
      const lowProgress = active && progressPercent < 50
      const risk = overdue ? 'overdue' : lowProgress && dueSoon ? 'high' : lowProgress || dueSoon ? 'medium' : 'normal'
      return {
        id: row.id,
        orderNo: row.order_no,
        status: row.status,
        plannedQuantity: planned,
        completedQuantity: completed,
        remainingQuantity: Math.max(0, planned - completed),
        progressPercent,
        dueDate: row.due_date?.toISOString() ?? null,
        overdue,
        dueSoon,
        lowProgress,
        risk,
      }
    })

    return NextResponse.json({
      generatedAt: now.toISOString(),
      dueSoonDays,
      summary: {
        total: rows.length,
        active: rows.filter((row) => row.status === 'released' || row.status === 'in_progress').length,
        inProduction: rows.filter((row) => row.status === 'in_progress').length,
        overdue: items.filter((item) => item.overdue).length,
        dueSoon: items.filter((item) => item.dueSoon).length,
        lowProgress: items.filter((item) => item.lowProgress).length,
        completed: rows.filter((row) => row.status === 'completed').length,
      },
      risks: items.filter((item) => item.risk !== 'normal'),
    })
  } catch (error) {
    return routeError(error)
  }
}
