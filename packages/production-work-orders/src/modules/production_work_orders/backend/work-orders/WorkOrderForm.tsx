'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useT } from '@open-mercato/shared/lib/i18n/context'

type Operation = { sequence: number; name: string; workCenterId?: string; standardMinutes?: number }

type WorkOrderFormProps = {
  mode: 'create' | 'edit'
  id?: string
  initial?: {
    order_no: string
    product_id: string
    planned_quantity: number
    due_date?: string | null
    priority: string
    notes?: string | null
  }
  initialOperations?: Operation[]
}

const statusOptions = ['draft', 'planned', 'released', 'in_progress', 'completed', 'cancelled']

export default function WorkOrderForm({ mode, id, initial, initialOperations = [] }: WorkOrderFormProps) {
  const t = useT()
  const router = useRouter()
  const [orderNo, setOrderNo] = useState(initial?.order_no ?? '')
  const [productId, setProductId] = useState(initial?.product_id ?? '')
  const [plannedQuantity, setPlannedQuantity] = useState(String(initial?.planned_quantity ?? ''))
  const [dueDate, setDueDate] = useState(initial?.due_date ? initial.due_date.slice(0, 10) : '')
  const [priority, setPriority] = useState(initial?.priority ?? 'normal')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [operations, setOperations] = useState<Operation[]>(initialOperations)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const addOperation = () => setOperations((items) => [...items, { sequence: items.length + 1, name: '' }])
  const removeOperation = (index: number) => setOperations((items) => items.filter((_, i) => i !== index).map((item, i) => ({ ...item, sequence: i + 1 })))
  const updateOperation = (index: number, patch: Partial<Operation>) => setOperations((items) => items.map((item, i) => i === index ? { ...item, ...patch } : item))

  async function submit() {
    setError(null)
    setSaving(true)
    const body = {
      ...(mode === 'edit' ? { id } : {}),
      orderNo: orderNo.trim(),
      productId: productId.trim(),
      plannedQuantity: Number(plannedQuantity),
      dueDate: dueDate || undefined,
      priority,
      notes: notes || undefined,
      operations: operations.map((operation) => ({
        sequence: operation.sequence,
        name: operation.name.trim(),
        workCenterId: operation.workCenterId || undefined,
        standardMinutes: operation.standardMinutes == null || operation.standardMinutes === undefined ? undefined : Number(operation.standardMinutes),
      })),
    }
    const response = await apiCall(
      mode === 'create' ? '/api/production-work-orders/work-orders' : `/api/production-work-orders/work-orders/${id}`,
      { method: mode === 'create' ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    )
    setSaving(false)
    if (!response.ok) {
      setError(t('production_work_orders.form.save_failed', '保存失败，请检查输入或权限。'))
      return
    }
    const result: any = response.result
    router.push(`/admin/production-work-orders/work-orders/${result?.id ?? id}`)
    router.refresh()
  }

  return (
    <div style={{ display: 'grid', gap: 20, maxWidth: 960 }}>
      {error ? <div role="alert">{error}</div> : null}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
        <label>{t('production_work_orders.order_no', '工单编号')}<input value={orderNo} onChange={(e) => setOrderNo(e.target.value)} required /></label>
        <label>{t('production_work_orders.product_id', '产品 ID')}<input value={productId} onChange={(e) => setProductId(e.target.value)} required /></label>
        <label>{t('production_work_orders.planned_quantity', '计划数量')}<input type="number" min="0.000001" step="any" value={plannedQuantity} onChange={(e) => setPlannedQuantity(e.target.value)} required /></label>
        <label>{t('production_work_orders.due_date', '交期')}<input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></label>
        <label>{t('production_work_orders.priority', '优先级')}<select value={priority} onChange={(e) => setPriority(e.target.value)}><option value="low">低</option><option value="normal">普通</option><option value="high">高</option><option value="urgent">紧急</option></select></label>
        <label style={{ gridColumn: '1 / -1' }}>{t('production_work_orders.notes', '备注')}<textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      </section>

      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h3>{t('production_work_orders.operations', '工序')}</h3>
          <button type="button" onClick={addOperation}>{t('production_work_orders.add_operation', '添加工序')}</button>
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          {operations.map((operation, index) => (
            <div key={`${operation.sequence}-${index}`} style={{ display: 'grid', gridTemplateColumns: '70px 2fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
              <label>序号<input type="number" min="1" value={operation.sequence} onChange={(e) => updateOperation(index, { sequence: Number(e.target.value) })} /></label>
              <label>工序名称<input value={operation.name} onChange={(e) => updateOperation(index, { name: e.target.value })} /></label>
              <label>工作中心 ID<input value={operation.workCenterId ?? ''} onChange={(e) => updateOperation(index, { workCenterId: e.target.value })} /></label>
              <label>标准分钟<input type="number" min="0" step="any" value={operation.standardMinutes ?? ''} onChange={(e) => updateOperation(index, { standardMinutes: e.target.value === '' ? undefined : Number(e.target.value) })} /></label>
              <button type="button" onClick={() => removeOperation(index)}>删除</button>
            </div>
          ))}
          {operations.length === 0 ? <p>{t('production_work_orders.no_operations', '暂未配置工序。')}</p> : null}
        </div>
      </section>

      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" disabled={saving} onClick={submit}>{saving ? '保存中…' : t('production_work_orders.save', '保存')}</button>
        <button type="button" onClick={() => router.back()}>{t('production_work_orders.cancel', '取消')}</button>
      </div>

      {mode === 'edit' ? <small>状态：{statusOptions.join(' → ')}</small> : null}
    </div>
  )
}
