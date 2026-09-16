import { NextResponse } from 'next/server'
import { ProductionWorkOrder, ProductionWorkOrderOperation } from '../../data/entities'
import { requireProductionContext, routeError } from '../helpers'

export const metadata = {
  method: 'GET' as const,
  path: '/api/production-work-orders/dashboard',
  requireAuth: true,
  requireFeatures: ['production_work_orders.view'],
}

export const openApi = {
  summary: 'Production cockpit dashboard',
  tags: ['production_work_orders'],
}

export default async function GET(req: Request) {
  try {
    const { auth, em } = await requireProductionContext(req, 'production_work_orders.view')
    const rows = await em.find(ProductionWorkOrder, {
      tenant_id: auth.tenantId,
      organization_id: auth.orgId,
      deleted_at: null,
    }, { orderBy: { due_date: 'asc' }, limit: 500 })

    const operations = await em.find(ProductionWorkOrderOperation, {
      tenant_id: auth.tenantId,
      organization_id: auth.orgId,
      deleted_at: null,
    }, { orderBy: { sequence: 'asc' }, limit: 1000 })

    const now = new Date()
    const soonUntil = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
    const activeRows = rows.filter((r) => r.status === 'released' || r.status === 'in_progress')
    const planned = rows.reduce((sum, r) => sum + Number(r.planned_quantity), 0)
    const completed = rows.reduce((sum, r) => sum + Number(r.completed_quantity), 0)
    const progress = planned > 0 ? Math.round((completed / planned) * 1000) / 10 : 0
    const overdue = rows.filter((r) => !!r.due_date && r.due_date < now && r.status !== 'completed' && r.status !== 'cancelled')
    const dueSoon = rows.filter((r) => !!r.due_date && r.due_date >= now && r.due_date <= soonUntil && r.status !== 'completed' && r.status !== 'cancelled')
    const lowProgress = activeRows.filter((r) => Number(r.planned_quantity) > 0 && Number(r.completed_quantity) / Number(r.planned_quantity) < 0.5)

    const execution = {
      pending: operations.filter((o) => o.execution_status === 'pending').length,
      inProgress: operations.filter((o) => o.execution_status === 'in_progress').length,
      paused: operations.filter((o) => o.execution_status === 'paused').length,
      completed: operations.filter((o) => o.execution_status === 'completed').length,
      actualMinutes: operations.reduce((sum, o) => sum + Number(o.actual_minutes), 0),
    }

    const statusFlow = ['draft', 'planned', 'released', 'in_progress', 'completed', 'cancelled'].map((status) => ({
      status,
      count: rows.filter((r) => r.status === status).length,
    }))

    const percentOf = (r: ProductionWorkOrder) => Number(r.planned_quantity) > 0
      ? Math.round(Number(r.completed_quantity) / Number(r.planned_quantity) * 1000) / 10
      : 0

    const risks = [...overdue.map((r) => ({ id: r.id, orderNo: r.order_no, type: 'overdue', label: '已延期', progressPercent: percentOf(r), dueDate: r.due_date?.toISOString() ?? null })),
      ...dueSoon.map((r) => ({ id: r.id, orderNo: r.order_no, type: 'dueSoon', label: '临近交期', progressPercent: percentOf(r), dueDate: r.due_date?.toISOString() ?? null })),
      ...lowProgress.filter((r) => !overdue.some((x) => x.id === r.id)).map((r) => ({ id: r.id, orderNo: r.order_no, type: 'lowProgress', label: '低进度', progressPercent: percentOf(r), dueDate: r.due_date?.toISOString() ?? null }))
    ].slice(0, 8)

    const aiInsights = risks.slice(0, 6).map((r) => {
      const order = rows.find((x) => x.id === r.id)!
      const remaining = Math.max(0, Number(order.planned_quantity) - Number(order.completed_quantity))
      const daysToDue = order.due_date ? Math.ceil((order.due_date.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)) : null
      const high = r.type === 'overdue' || (r.type === 'dueSoon' && r.progressPercent < 50)
      const level = high ? 'high' : r.type === 'lowProgress' ? 'medium' : 'low'
      const reason = r.type === 'overdue'
        ? `已超过交期${daysToDue === null ? '' : `${Math.abs(daysToDue)}天`}，当前完成率仅 ${r.progressPercent}%`
        : r.type === 'dueSoon'
          ? `距离交期${daysToDue ?? 0}天，当前仍有 ${remaining} 个单位未完成`
          : `当前完成率 ${r.progressPercent}%，低于生产关注阈值 50%`
      const impact = r.type === 'overdue'
        ? '可能形成交付延期并挤压后续生产计划'
        : r.type === 'dueSoon'
          ? '若当前产出速度不提升，交期缓冲空间将快速收窄'
          : '可能造成在制任务积压与产能利用率下降'
      const action = r.type === 'overdue'
        ? '优先核查工序阻塞、暂停原因与剩余产量'
        : r.type === 'dueSoon'
          ? '优先确认当前工序进度，并评估加速或调整排产'
          : '检查工序执行状态，定位低产出环节'
      return { id: r.id, orderNo: r.orderNo, type: r.type, level, reason, impact, suggestedAction: action, progressPercent: r.progressPercent, dueDate: r.dueDate }
    })

    const inProduction = activeRows.filter((r) => r.status === 'in_progress').slice(0, 8).map((r) => ({
      id: r.id,
      orderNo: r.order_no,
      productId: r.product_id,
      plannedQuantity: Number(r.planned_quantity),
      completedQuantity: Number(r.completed_quantity),
      progressPercent: percentOf(r),
      dueDate: r.due_date?.toISOString() ?? null,
      priority: r.priority,
    }))

    return NextResponse.json({
      generatedAt: now.toISOString(),
      summary: {
        total: rows.length,
        active: activeRows.length,
        inProduction: activeRows.filter((r) => r.status === 'in_progress').length,
        completed: rows.filter((r) => r.status === 'completed').length,
        overdue: overdue.length,
        dueSoon: dueSoon.length,
        lowProgress: lowProgress.length,
        plannedQuantity: planned,
        completedQuantity: completed,
        remainingQuantity: Math.max(0, planned - completed),
        progressPercent: progress,
      },
      execution,
      statusFlow,
      risks,
      aiInsights,
      inProduction,
    })
  } catch (error) {
    return routeError(error)
  }
}
