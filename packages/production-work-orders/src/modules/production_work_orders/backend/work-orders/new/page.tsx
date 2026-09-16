import { Page, PageBody, PageHeader } from '@open-mercato/ui/backend/Page'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import WorkOrderForm from '../WorkOrderForm'

export const metadata = {
  requireAuth: true,
  requireFeatures: ['production_work_orders.create'],
  pageTitle: '新建生产工单',
  pageTitleKey: 'production_work_orders.new.title',
  pageGroup: '生产管理',
  pageGroupKey: 'production_work_orders.page.group',
}

export default function NewProductionWorkOrderPage() {
  const t = useT()
  return (
    <Page>
      <PageHeader title={t('production_work_orders.new.title', '新建生产工单')} />
      <PageBody><WorkOrderForm mode="create" /></PageBody>
    </Page>
  )
}
