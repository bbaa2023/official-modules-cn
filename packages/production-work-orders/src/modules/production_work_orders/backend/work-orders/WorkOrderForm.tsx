'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'

type Operation = {
  id?: string
  sequence: number
  name: string
  workCenterId?: string
  standardMinutes?: number
}

type WorkOrderFormProps = {
  mode: 'create' | 'edit'
  id?: string
  initial?: Record<string, any>
  initialOperations?: Array<Record<string, any>>
}

const normalizeOperations = (items: Array<Record<string, any>> = []): Operation[] =>
  items.map((item, index) => ({
    id: item.id ?? undefined,
    sequence: Number(item.sequence ?? index + 1),
    name: String(item.name ?? ''),
    workCenterId: item.workCenterId ?? item.work_center_id ?? undefined,
    standardMinutes: item.standardMinutes == null && item.standard_minutes == null
      ? undefined
      : Number(item.standardMinutes ?? item.standard_minutes),
  }))

export default function WorkOrderForm({ mode, id, initial, initialOperations }: WorkOrderFormProps) {
  const router = useRouter()
  const [orderNo, setOrderNo] = useState(String(initial?.order_no ?? ''))
  const [productId, setProductId] = useState(String(initial?.product_id ?? ''))
  const [plannedQuantity, setPlannedQuantity] = useState(String(initial?.planned_quantity ?? ''))
  const [dueDate, setDueDate] = useState(initial?.due_date ? new Date(initial.due_date).toISOString().slice(0, 10) : '')
  const [priority, setPriority] = useState(String(initial?.priority ?? 'normal'))
  const [notes, setNotes] = useState(String(initial?.notes ?? ''))
  const [operations, setOperations] = useState<Operation[]>(normalizeOperations(initialOperations))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const duplicateSequences = useMemo(() => {
    const seen = new Set<number>()
    const duplicates = new Set<number>()
    for (const operation of operations) {
      if (seen.has(operation.sequence)) duplicates.add(operation.sequence)
      seen.add(operation.sequence)
    }
    return duplicates
  }, [operations])

  const addOperation = () => {
    const maxSequence = operations.reduce((max, item) => Math.max(max, item.sequence || 0), 0)
    setOperations((current) => [...current, { sequence: maxSequence + 1, name: '' }])
  }

  const updateOperation = (index: number, patch: Partial<Operation>) => {
    setOperations((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item))
  }

  const removeOperation = (index: number) => {
    setOperations((current) => current.filter((_, itemIndex) => itemIndex !== index))
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!orderNo.trim()) return setError('请输入工单编号。')
    if (!productId.trim()) return setError('请输入产品 ID。')
    if (!plannedQuantity || Number(plannedQuantity) <= 0) return setError('计划数量必须大于 0。')
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(productId.trim())) return setError('产品 ID 必须是有效 UUID。')
    if (duplicateSequences.size) return setError(`工序序号重复：${Array.from(duplicateSequences).join('、')}`)
    if (operations.some((item) => !item.name.trim())) return setError('每个工序都必须填写工序名称。')
    if (operations.some((item) => !Number.isInteger(Number(item.sequence)) || Number(item.sequence) < 1)) return setError('工序序号必须是大于等于 1 的整数。')
    if (operations.some((item) => item.workCenterId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.workCenterId))) return setError('工作中心 ID 必须是有效 UUID。')

    const payload = {
      orderNo: orderNo.trim(),
      productId: productId.trim(),
      plannedQuantity: Number(plannedQuantity),
      dueDate: dueDate || undefined,
      priority,
      notes: notes || undefined,
      operations: operations.map((item) => ({
        ...(item.id ? { id: item.id } : {}),
        sequence: Number(item.sequence),
        name: item.name.trim(),
        workCenterId: item.workCenterId?.trim() || undefined,
        standardMinutes: item.standardMinutes == null || Number.isNaN(Number(item.standardMinutes)) ? undefined : Number(item.standardMinutes),
      })),
    }

    setSaving(true)
    try {
      const response = await apiCall<Record<string, any>>(
        mode === 'create' ? '/api/production-work-orders/work-orders' : `/api/production-work-orders/work-orders/${id}`,
        { method: mode === 'create' ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
      )
      if (!response.ok) {
        const message = response.result?.error ?? `保存失败（HTTP ${response.status}）。`
        throw new Error(message)
      }
      const result = response.result as { id?: string } | null
      const targetId = mode === 'create' ? result?.id : id
      if (!targetId) throw new Error('保存成功但未返回工单 ID。')
      router.push(`/admin/production-work-orders/work-orders/${targetId}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败。')
    } finally {
      setSaving(false)
    }
  }

  return <form onSubmit={save} style={{ display: 'grid', gap: 20, maxWidth: 1100 }}>
    {error ? <div role="alert" style={{ padding: 12, border: '1px solid #e0a0a0', borderRadius: 8 }}>{error}</div> : null}

    <section style={{ display: 'grid', gap: 14, padding: 18, border: '1px solid var(--om-color-border, #ddd)', borderRadius: 10 }}>
      <h3 style={{ margin: 0 }}>基本信息</h3>
      <label>工单编号<input required value={orderNo} onChange={(e) => setOrderNo(e.target.value)} style={{ display: 'block', width: '100%', boxSizing: 'border-box' }} /></label>
      <label>产品 UUID<input required value={productId} onChange={(e) => setProductId(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" style={{ display: 'block', width: '100%', boxSizing: 'border-box' }} /></label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <label>计划数量<input required min="0.000001" step="any" type="number" value={plannedQuantity} onChange={(e) => setPlannedQuantity(e.target.value)} style={{ display: 'block', width: '100%', boxSizing: 'border-box' }} /></label>
        <label>交期<input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ display: 'block', width: '100%', boxSizing: 'border-box' }} /></label>
        <label>优先级<select value={priority} onChange={(e) => setPriority(e.target.value)} style={{ display: 'block', width: '100%', boxSizing: 'border-box' }}><option value="low">低</option><option value="normal">普通</option><option value="high">高</option><option value="urgent">紧急</option></select></label>
      </div>
      <label>备注<textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={5000} rows={4} style={{ display: 'block', width: '100%', boxSizing: 'border-box' }} /></label>
    </section>

    <section style={{ display: 'grid', gap: 12, padding: 18, border: '1px solid var(--om-color-border, #ddd)', borderRadius: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h3 style={{ margin: 0 }}>生产工序</h3><button type="button" onClick={addOperation}>+ 添加工序</button></div>
      {operations.length === 0 ? <div>暂无工序，可点击“添加工序”。</div> : operations.map((operation, index) => <div key={`${operation.id ?? index}-${operation.sequence}`} style={{ display: 'grid', gridTemplateColumns: '90px 2fr 2fr 130px auto', gap: 10, alignItems: 'end', padding: 12, border: '1px solid var(--om-color-border, #ddd)', borderRadius: 8 }}>
        <label>序号<input type="number" min="1" step="1" value={operation.sequence} onChange={(e) => updateOperation(index, { sequence: Number(e.target.value) })} style={{ display: 'block', width: '100%', boxSizing: 'border-box' }} /></label>
        <label>工序名称<input value={operation.name} onChange={(e) => updateOperation(index, { name: e.target.value })} style={{ display: 'block', width: '100%', boxSizing: 'border-box' }} /></label>
        <label>工作中心 UUID<input value={operation.workCenterId ?? ''} onChange={(e) => updateOperation(index, { workCenterId: e.target.value || undefined })} placeholder="可选" style={{ display: 'block', width: '100%', boxSizing: 'border-box' }} /></label>
        <label>标准分钟<input type="number" min="0" step="any" value={operation.standardMinutes ?? ''} onChange={(e) => updateOperation(index, { standardMinutes: e.target.value === '' ? undefined : Number(e.target.value) })} style={{ display: 'block', width: '100%', boxSizing: 'border-box' }} /></label>
        <button type="button" onClick={() => removeOperation(index)}>删除</button>
      </div>)}
    </section>

    <div style={{ display: 'flex', gap: 10 }}><button type="submit" disabled={saving}>{saving ? '保存中…' : mode === 'create' ? '创建工单' : '保存修改'}</button><button type="button" disabled={saving} onClick={() => router.back()}>取消</button></div>
  </form>
}
