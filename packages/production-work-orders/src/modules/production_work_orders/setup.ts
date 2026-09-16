import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    superadmin: [
      'production_work_orders.view',
      'production_work_orders.create',
      'production_work_orders.edit',
      'production_work_orders.delete',
      'production_work_orders.release',
      'production_work_orders.report',
      'production_work_orders.execute',
      'production_work_orders.analyze',
    ],
    admin: [
      'production_work_orders.view',
      'production_work_orders.create',
      'production_work_orders.edit',
      'production_work_orders.release',
      'production_work_orders.report',
      'production_work_orders.execute',
      'production_work_orders.analyze',
    ],
    employee: [
      'production_work_orders.view',
      'production_work_orders.report',
      'production_work_orders.execute',
    ],
  },
}
export default setup
