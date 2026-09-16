'use client'

import { useEffect, useState } from 'react'
import { Page, PageBody, PageHeader } from '@open-mercato/ui/backend/Page'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'

export default function ProductionWorkOrdersPage() {
  const t = useT()
  const [rows, setRows] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    apiCall('/api/production-work-orders/work-orders')
      .then((response: any) => {
        if (!cancelled) setRows(response?.items ?? [])
      })
      .catch((err: any) => {
        if (!cancelled) setError(err?.message ?? 'Failed to load work orders')
      })
    return () => { cancelled = true }
  }, [])

  return (
    <Page>
      <PageHeader title={t('production_work_orders.page.title', '生产工单')} />
      <PageBody>
        {error ? <div role="alert">{error}</div> : null}
        <DataTable
          data={rows}
          columns={[
            { id: 'order_no', header: t('production_work_orders.order_no', '工单编号'), accessorKey: 'order_no' },
            { id: 'product_id', header: t('production_work_orders.product', '产品'), accessorKey: 'product_id' },
            { id: 'planned_quantity', header: t('production_work_orders.planned_quantity', '计划数量'), accessorKey: 'planned_quantity' },
            { id: 'due_date', header: t('production_work_orders.due_date', '交期'), accessorKey: 'due_date' },
            { id: 'priority', header: t('production_work_orders.priority', '优先级'), accessorKey: 'priority' },
            { id: 'status', header: t('production_work_orders.status', '状态'), accessorKey: 'status' },
          ]}
        />
      </PageBody>
    </Page>
  )
}
