'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Page, PageBody, PageHeader } from '@open-mercato/ui/backend/Page'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useT } from '@open-mercato/shared/lib/i18n/context'

const nextStatuses: Record<string, string[]> = {
  draft: ['planned', 'cancelled'], planned: ['released', 'cancelled'], released: ['in_progress', 'cancelled'], in_progress: ['completed', 'cancelled'], completed: [], cancelled: [],
}

export default function ProductionWorkOrderDetailPage() {
  const t = useT(); const params = useParams<{ id: string }>(); const router = useRouter(); const id = params?.id
  const [data, setData] = useState<any>(null); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false)
  const load = async () => { const response = await apiCall(`/api/production-work-orders/work-orders/${id}`); if (!response.ok) { setError(t('production_work_orders.detail.load_failed', '无法加载工单。')); return }; setData(response.result) }
  useEffect(() => { if (id) void load() }, [id])
  const progress = useMemo(() => { if (!data?.order) return 0; const planned = Number(data.order.planned_quantity) || 0; const completed = Number(data.order.completed_quantity) || 0; return planned > 0 ? Math.min(100, Math.round(completed / planned * 100)) : 0 }, [data])
  const transition = async (status: string) => { setBusy(true); setError(null); const response = await apiCall(`/api/production-work-orders/work-orders/${id}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }); setBusy(false); if (!response.ok) { setError(t('production_work_orders.detail.transition_failed', '状态变更失败。')); return }; await load() }
  if (error && !data) return <Page><PageHeader title="生产工单详情" /><PageBody><div role="alert">{error}</div></PageBody></Page>
  if (!data?.order) return <Page><PageHeader title="生产工单详情" /><PageBody>加载中…</PageBody></Page>
  const order = data.order
  return <Page><PageHeader title={`生产工单详情 · ${order.order_no}`} /><PageBody><div style={{ display: 'grid', gap: 24, maxWidth: 1100 }}>
    {error ? <div role="alert">{error}</div> : null}
    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16 }}>
      <div><strong>工单编号</strong><div>{order.order_no}</div></div><div><strong>产品 ID</strong><div>{order.product_id}</div></div><div><strong>计划数量</strong><div>{order.planned_quantity}</div></div><div><strong>优先级</strong><div>{order.priority}</div></div><div><strong>交期</strong><div>{order.due_date ? new Date(order.due_date).toLocaleDateString() : '—'}</div></div><div><strong>当前状态</strong><div>{order.status}</div></div><div><strong>已完成</strong><div>{order.completed_quantity}</div></div><div><strong>进度</strong><div>{progress}%</div></div>
    </section>
    <section><div style={{ height: 12, background: 'var(--om-color-surface-muted, #eee)', borderRadius: 8, overflow: 'hidden' }}><div style={{ width: `${progress}%`, height: '100%', background: 'currentColor' }} /></div></section>
    <section><h3>状态操作</h3><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{(nextStatuses[order.status] ?? []).map((status) => <button key={status} type="button" disabled={busy} onClick={() => transition(status)}>{status}</button>)}{(nextStatuses[order.status] ?? []).length === 0 ? <span>当前状态没有可用的下一步操作。</span> : null}</div></section>
    <section><h3>工序</h3>{data.operations?.length ? <div style={{ display: 'grid', gap: 8 }}>{data.operations.map((operation: any) => <div key={operation.id} style={{ display: 'grid', gridTemplateColumns: '70px 2fr 1fr 1fr', gap: 8, padding: 10, border: '1px solid var(--om-color-border, #ddd)', borderRadius: 6 }}><strong>#{operation.sequence}</strong><span>{operation.name}</span><span>{operation.work_center_id ?? '—'}</span><span>{operation.standard_minutes ?? '—'} 分钟</span></div>)}</div> : <p>暂无工序。</p>}</section>
    {order.notes ? <section><h3>备注</h3><p style={{ whiteSpace: 'pre-wrap' }}>{order.notes}</p></section> : null}
    <div style={{ display: 'flex', gap: 10 }}><button type="button" onClick={() => router.push(`/admin/production-work-orders/work-orders/${id}/edit`)}>编辑</button><button type="button" onClick={() => router.back()}>返回</button></div>
  </div></PageBody></Page>
}
