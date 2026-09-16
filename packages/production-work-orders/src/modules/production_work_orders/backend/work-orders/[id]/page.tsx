'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Page, PageBody, PageHeader } from '@open-mercato/ui/backend/Page'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useT } from '@open-mercato/shared/lib/i18n/context'

const nextStatuses: Record<string, string[]> = {
  draft: ['planned', 'cancelled'], planned: ['released', 'cancelled'], released: ['in_progress', 'cancelled'], in_progress: ['completed', 'cancelled'], completed: [], cancelled: [],
}
const statusText: Record<string, string> = { draft: '草稿', planned: '已计划', released: '已下达', in_progress: '生产中', completed: '已完成', cancelled: '已取消' }
const executionText: Record<string, string> = { pending: '待执行', in_progress: '执行中', paused: '已暂停', completed: '已完成' }
const riskText: Record<string, string> = { overdue: '已逾期', high: '高风险', medium: '关注', normal: '正常' }

export default function ProductionWorkOrderDetailPage() {
  const t = useT(); const params = useParams<{ id: string }>(); const router = useRouter(); const id = params?.id
  const [data, setData] = useState<any>(null); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false)
  const [reportQty, setReportQty] = useState(''); const [reportMinutes, setReportMinutes] = useState(''); const [reportNote, setReportNote] = useState('')
  const [operationBusy, setOperationBusy] = useState<string | null>(null); const [operationReportQty, setOperationReportQty] = useState<Record<string, string>>({})
  const [analysis, setAnalysis] = useState<any>(null); const [analysisBusy, setAnalysisBusy] = useState(false)

  const load = async () => { const response = await apiCall(`/api/production-work-orders/work-orders/${id}`); if (!response.ok) { setError(t('production_work_orders.detail.load_failed', '无法加载工单。')); return }; setData(response.result) }
  useEffect(() => { if (id) void load() }, [id])

  const progress = useMemo(() => { if (!data?.order) return 0; const planned = Number(data.order.planned_quantity) || 0; const completed = Number(data.order.completed_quantity) || 0; return planned > 0 ? Math.min(100, Math.round(completed / planned * 100)) : 0 }, [data])
  const remaining = useMemo(() => Math.max(0, Number(data?.order?.planned_quantity || 0) - Number(data?.order?.completed_quantity || 0)), [data])

  const transition = async (status: string) => { setBusy(true); setError(null); const response = await apiCall(`/api/production-work-orders/work-orders/${id}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }); setBusy(false); if (!response.ok) { setError(t('production_work_orders.detail.transition_failed', '状态变更失败。')); return }; await load() }

  const report = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(null)
    const response = await apiCall(`/api/production-work-orders/work-orders/${id}/report`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quantity: Number(reportQty), actualMinutes: reportMinutes ? Number(reportMinutes) : undefined, note: reportNote || undefined }) })
    setBusy(false); if (!response.ok) { setError('生产报工失败，请检查数量和工单状态。'); return }
    setReportQty(''); setReportMinutes(''); setReportNote(''); await load()
  }

  const setOperationStatus = async (operationId: string, status: string) => {
    setOperationBusy(operationId); setError(null)
    const response = await apiCall(`/api/production-work-orders/work-orders/${id}/operations/${operationId}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    setOperationBusy(null); if (!response.ok) { setError('工序状态更新失败。'); return }; await load()
  }

  const reportOperation = async (operationId: string) => {
    const value = operationReportQty[operationId] ?? ''
    const quantity = Number(value)
    if (!Number.isFinite(quantity) || quantity <= 0) { setError('请输入大于 0 的工序报工数量。'); return }
    setOperationBusy(operationId); setError(null)
    const response = await apiCall(`/api/production-work-orders/work-orders/${id}/operations/${operationId}/report`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quantity }) })
    setOperationBusy(null); if (!response.ok) { setError('工序报工失败，请检查数量和工单状态。'); return }
    setOperationReportQty((current) => ({ ...current, [operationId]: '' })); await load()
  }

  const loadAnalysis = async () => {
    setAnalysisBusy(true); setError(null)
    const response = await apiCall('/api/production-work-orders/analysis?dueSoonDays=3')
    setAnalysisBusy(false); if (!response.ok) { setError('生产风险分析加载失败，请确认分析权限已配置。'); return }; setAnalysis(response.result)
  }

  if (error && !data) return <Page><PageHeader title="生产工单详情" /><PageBody><div role="alert">{error}</div></PageBody></Page>
  if (!data?.order) return <Page><PageHeader title="生产工单详情" /><PageBody>加载中…</PageBody></Page>
  const order = data.order

  return <Page><PageHeader title={`生产工单 · ${order.order_no}`} /><PageBody><div style={{ display: 'grid', gap: 20, maxWidth: 1180 }}>
    {error ? <div role="alert" style={{ padding: 12, border: '1px solid var(--om-color-border, #ddd)', borderRadius: 8 }}>{error}</div> : null}

    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14, padding: 18, border: '1px solid var(--om-color-border, #ddd)', borderRadius: 10 }}>
      <div><strong>工单编号</strong><div>{order.order_no}</div></div><div><strong>产品 ID</strong><div style={{ wordBreak: 'break-all' }}>{order.product_id}</div></div><div><strong>计划数量</strong><div>{order.planned_quantity}</div></div><div><strong>优先级</strong><div>{order.priority}</div></div><div><strong>交期</strong><div>{order.due_date ? new Date(order.due_date).toLocaleDateString() : '—'}</div></div><div><strong>当前状态</strong><div>{statusText[order.status] ?? order.status}</div></div><div><strong>已完成</strong><div>{order.completed_quantity}</div></div><div><strong>剩余数量</strong><div>{remaining}</div></div>
    </section>

    <section style={{ padding: 18, border: '1px solid var(--om-color-border, #ddd)', borderRadius: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><strong>生产进度</strong><strong>{progress}%</strong></div>
      <div style={{ height: 14, background: 'var(--om-color-surface-muted, #eee)', borderRadius: 8, overflow: 'hidden' }}><div style={{ width: `${progress}%`, height: '100%', background: 'currentColor', transition: 'width .2s' }} /></div>
      <div style={{ marginTop: 8, fontSize: 13 }}>计划 {order.planned_quantity} · 已完成 {order.completed_quantity} · 剩余 {remaining}</div>
    </section>

    <section style={{ padding: 18, border: '1px solid var(--om-color-border, #ddd)', borderRadius: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}><div><h3 style={{ margin: 0 }}>AI 生产风险分析</h3><div style={{ marginTop: 4, fontSize: 13 }}>基于当前工单、进度和交期计算，只读分析，不会修改数据。</div></div><button type="button" disabled={analysisBusy} onClick={loadAnalysis}>{analysisBusy ? '分析中…' : analysis ? '刷新分析' : '开始分析'}</button></div>
      {analysis ? <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 8 }}>{[['全部', analysis.summary.total], ['生产中', analysis.summary.inProduction], ['逾期', analysis.summary.overdue], ['临近交期', analysis.summary.dueSoon], ['低进度', analysis.summary.lowProgress], ['已完成', analysis.summary.completed]].map(([label, value]) => <div key={String(label)} style={{ padding: 10, border: '1px solid var(--om-color-border, #ddd)', borderRadius: 8 }}><div style={{ fontSize: 12 }}>{label}</div><strong>{value}</strong></div>)}</div>
        {analysis.risks?.length ? <div style={{ display: 'grid', gap: 8 }}>{analysis.risks.slice(0, 8).map((item: any) => <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr auto', gap: 8, alignItems: 'center', padding: 10, border: '1px solid var(--om-color-border, #ddd)', borderRadius: 8 }}><strong>{item.orderNo}</strong><span>{statusText[item.status] ?? item.status}</span><span>进度 {item.progressPercent}%</span><span>剩余 {item.remainingQuantity}</span><strong>{riskText[item.risk] ?? item.risk}</strong></div>)}</div> : <div>当前没有识别到需要关注的风险工单。</div>}
      </div> : null}
    </section>

    {order.status === 'released' || order.status === 'in_progress' ? <section style={{ padding: 18, border: '1px solid var(--om-color-border, #ddd)', borderRadius: 10 }}>
      <h3 style={{ marginTop: 0 }}>本次生产报工</h3>
      <form onSubmit={report} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr auto', gap: 10, alignItems: 'end' }}>
        <label>完成数量<input required min="0.000001" step="any" type="number" value={reportQty} onChange={(e) => setReportQty(e.target.value)} style={{ display: 'block', width: '100%', boxSizing: 'border-box' }} /></label>
        <label>实际工时（分钟）<input min="0" step="any" type="number" value={reportMinutes} onChange={(e) => setReportMinutes(e.target.value)} style={{ display: 'block', width: '100%', boxSizing: 'border-box' }} /></label>
        <label>备注<input value={reportNote} onChange={(e) => setReportNote(e.target.value)} style={{ display: 'block', width: '100%', boxSizing: 'border-box' }} /></label>
        <button type="submit" disabled={busy}>提交报工</button>
      </form>
    </section> : null}

    <section style={{ padding: 18, border: '1px solid var(--om-color-border, #ddd)', borderRadius: 10 }}>
      <h3 style={{ marginTop: 0 }}>工序执行</h3>
      {data.operations?.length ? <div style={{ display: 'grid', gap: 10 }}>{data.operations.map((operation: any) => {
        const opBusy = operationBusy === operation.id
        const opProgress = Number(order.planned_quantity) > 0 ? Math.min(100, Math.round(Number(operation.completed_quantity || 0) / Number(order.planned_quantity) * 100)) : 0
        return <div key={operation.id} style={{ padding: 14, border: '1px solid var(--om-color-border, #ddd)', borderRadius: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '60px 2fr 1fr 1fr', gap: 8 }}><strong>#{operation.sequence}</strong><strong>{operation.name}</strong><span>工作中心：{operation.work_center_id ?? '—'}</span><span>标准：{operation.standard_minutes ?? '—'} 分钟</span></div>
          <div style={{ marginTop: 10 }}>状态：<strong>{executionText[operation.execution_status] ?? operation.execution_status}</strong> · 完成 {operation.completed_quantity ?? 0} · 实际 {operation.actual_minutes ?? 0} 分钟</div>
          <div style={{ marginTop: 8, height: 8, background: 'var(--om-color-surface-muted, #eee)', borderRadius: 5, overflow: 'hidden' }}><div style={{ width: `${opProgress}%`, height: '100%', background: 'currentColor' }} /></div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end', marginTop: 10 }}>
            {operation.execution_status !== 'in_progress' && operation.execution_status !== 'completed' ? <button type="button" disabled={opBusy} onClick={() => setOperationStatus(operation.id, 'in_progress')}>开始</button> : null}
            {operation.execution_status === 'in_progress' ? <button type="button" disabled={opBusy} onClick={() => setOperationStatus(operation.id, 'paused')}>暂停</button> : null}
            {operation.execution_status === 'paused' ? <button type="button" disabled={opBusy} onClick={() => setOperationStatus(operation.id, 'in_progress')}>继续</button> : null}
            {operation.execution_status !== 'completed' ? <><label style={{ fontSize: 12 }}>本次数量<input min="0.000001" step="any" type="number" value={operationReportQty[operation.id] ?? ''} onChange={(e) => setOperationReportQty((current) => ({ ...current, [operation.id]: e.target.value }))} style={{ display: 'block', width: 110 }} /></label><button type="button" disabled={opBusy} onClick={() => reportOperation(operation.id)}>工序报工</button><button type="button" disabled={opBusy} onClick={() => setOperationStatus(operation.id, 'completed')}>完成工序</button></> : null}
          </div>
        </div>
      })}</div> : <p>暂无工序。</p>}
    </section>

    <section style={{ padding: 18, border: '1px solid var(--om-color-border, #ddd)', borderRadius: 10 }}>
      <h3 style={{ marginTop: 0 }}>工单状态</h3><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{(nextStatuses[order.status] ?? []).map((status) => <button key={status} type="button" disabled={busy} onClick={() => transition(status)}>{statusText[status] ?? status}</button>)}{(nextStatuses[order.status] ?? []).length === 0 ? <span>当前状态没有可用的下一步操作。</span> : null}</div>
    </section>

    {order.notes ? <section><h3>备注</h3><p style={{ whiteSpace: 'pre-wrap' }}>{order.notes}</p></section> : null}
    <div style={{ display: 'flex', gap: 10 }}><button type="button" onClick={() => router.push(`/admin/production-work-orders/work-orders/${id}/edit`)}>编辑工单</button><button type="button" onClick={() => router.back()}>返回</button></div>
  </div></PageBody></Page>
}
