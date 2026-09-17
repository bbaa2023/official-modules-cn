import type { ModuleInfo } from '@open-mercato/shared/modules/registry'
import './commands/work-orders.js'
import './commands/reporting.js'

export const metadata: ModuleInfo = {
  name: 'production_work_orders',
  title: 'Production Work Orders',
  description: 'Production work orders and operation tracking.',
  ejectable: true,
}

export { features } from './acl.js'
export { setup } from './setup.js'
export default metadata
