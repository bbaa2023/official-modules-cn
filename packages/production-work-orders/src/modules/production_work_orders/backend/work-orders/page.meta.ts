export const metadata = {
  requireAuth: true,
  requireFeatures: ['production_work_orders.view'],
  pageTitle: '生产工单',
  pageTitleKey: 'production_work_orders.page.title',
  pageGroup: '生产管理',
  pageGroupKey: 'production_work_orders.page.group',
  pageOrder: 700,
  breadcrumb: [{ label: '生产工单', labelKey: 'production_work_orders.page.title' }],
} as const

export default metadata
