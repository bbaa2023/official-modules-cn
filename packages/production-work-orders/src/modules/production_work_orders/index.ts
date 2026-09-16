import type { ModuleInfo } from '@open-mercato/shared/modules/registry'
import './commands/work-orders'
import './commands/reporting'

export const metadata: ModuleInfo = {
  name: 'production_work_orders',
  title: 'Production Work Orders',
  description: 'Production work orders and operation tracking.',
  ejectable: true,
}

export { features } from './acl'
export { setup } from './setup'
export default metadata
