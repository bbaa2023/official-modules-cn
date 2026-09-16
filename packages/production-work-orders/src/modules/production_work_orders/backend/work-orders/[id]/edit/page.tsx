'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Page, PageBody, PageHeader } from '@open-mercato/ui/backend/Page'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import WorkOrderForm from '../../WorkOrderForm'

export default function EditProductionWorkOrderPage() {
  const params = useParams<{ id: string }>(); const id = params?.id
  const [data, setData] = useState<any>(null); const [error, setError] = useState<string | null>(null)
  useEffect(() => { if (!id) return; apiCall(`/api/production-work-orders/work-orders/${id}`).then((response) => { if (!response.ok) setError('无法加载工单。'); else setData(response.result) }) }, [id])
  if (error) return <Page><PageHeader title="编辑生产工单" /><PageBody><div role="alert">{error}</div></PageBody></Page>
  if (!data?.order) return <Page><PageHeader title="编辑生产工单" /><PageBody>加载中…</PageBody></Page>
  return <Page><PageHeader title={`编辑生产工单 · ${data.order.order_no}`} /><PageBody><WorkOrderForm mode="edit" id={id} initial={data.order} initialOperations={data.operations ?? []} /></PageBody></Page>
}
