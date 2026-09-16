'use client'

import { useEffect, useState } from 'react'
import { Page, PageBody, PageHeader } from '@open-mercato/ui/backend/Page'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'

export default function ProductionWorkOrdersPage() {
  const t = useT(); const [rows, setRows] = useState<any[]>([]); const [error, setError] = useState<string | null>(null)
  useEffect(() => { let cancelled = false; apiCall<{ items: any[] }>('/api/production-work-orders/work-orders').then((response) => { if (!cancelled) setRows(response.result?.items ?? []) }).catch((err: any) => { if (!cancelled) setError(err?.message ?? 'Failed to load work orders') }); return () => { cancelled = true } }, [])
  const openDetail = (id: string) => { window.location.href = `/admin/production-work-orders/work-orders/${id}` }
  return <Page><PageHeader title={t('production_work_orders.page.title', '生产工单')} /><PageBody>
    <div style={{ marginBottom: 16 }}><button type="button" onClick={() => { window.location.href = '/admin/production-work-orders/work-orders/new' }}>{t('production_work_orders.new', '新建工单')}</button></div>
    {error ? <div role="alert">{error}</div> : null}
    <DataTable data={rows} columns={[
      { id: 'order_no', header: t('production_work_orders.order_no', '工单编号'), accessorKey: 'order_no' },
      { id: 'product_id', header: t('production_work_orders.product', '产品'), accessorKey: 'product_id' },
      { id: 'planned_quantity', header: t('production_work_orders.planned_quantity', '计划数量'), accessorKey: 'planned_quantity' },
      { id: 'completed_quantity', header: t('production_work_orders.completed_quantity', '已完成'), accessorKey: 'completed_quantity' },
      { id: 'due_date', header: t('production_work_orders.due_date', '交期'), accessorKey: 'due_date' },
      { id: 'priority', header: t('production_work_orders.priority', '优先级'), accessorKey: 'priority' },
      { id: 'status', header: t('production_work_orders.status', '状态'), accessorKey: 'status' },
      { id: 'actions', header: t('production_work_orders.actions', '操作'), cell: ({ row }: any) => <button type="button" onClick={() => openDetail(row.original.id)}>{t('production_work_orders.view', '查看')}</button> },
    ]} />
  </PageBody></Page>
}
