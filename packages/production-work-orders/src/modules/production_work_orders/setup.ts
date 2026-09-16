import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    superadmin: [
      'production_work_orders.view',
      'production_work_orders.create',
      'production_work_orders.edit',
      'production_work_orders.delete',
      'production_work_orders.release',
    ],
    admin: [
      'production_work_orders.view',
      'production_work_orders.create',
      'production_work_orders.edit',
      'production_work_orders.release',
    ],
  },
}
export default setup
