import { Entity, PrimaryKey, Property, Index, Unique } from '@mikro-orm/core'

const newId = () => crypto.randomUUID()

@Entity({ tableName: 'production_work_orders' })
@Unique({ properties: ['tenant_id', 'organization_id', 'order_no'] })
@Index({ properties: ['organization_id'] })
@Index({ properties: ['organization_id', 'status'] })
export class ProductionWorkOrder {
  @PrimaryKey({ type: 'uuid' }) id: string = newId()
  @Property({ type: 'string' }) organization_id!: string
  @Property({ type: 'string' }) tenant_id!: string
  @Property({ type: 'string' }) order_no!: string
  @Property({ type: 'string' }) product_id!: string
  @Property({ type: 'decimal' }) planned_quantity!: number
  @Property({ type: 'decimal', default: 0 }) completed_quantity = 0
  @Property({ type: 'date', nullable: true }) due_date?: Date
  @Property({ type: 'string', default: 'normal' }) priority = 'normal'
  @Property({ type: 'string', default: 'draft' }) status = 'draft'
  @Property({ type: 'text', nullable: true }) notes?: string
  @Property() created_at: Date = new Date()
  @Property({ onUpdate: () => new Date() }) updated_at: Date = new Date()
  @Property({ nullable: true }) deleted_at?: Date
  @Property({ default: true }) is_active = true
}

@Entity({ tableName: 'production_work_order_operations' })
@Unique({ properties: ['tenant_id', 'organization_id', 'work_order_id', 'sequence'] })
@Index({ properties: ['organization_id'] })
@Index({ properties: ['work_order_id', 'sequence'] })
export class ProductionWorkOrderOperation {
  @PrimaryKey({ type: 'uuid' }) id: string = newId()
  @Property({ type: 'string' }) organization_id!: string
  @Property({ type: 'string' }) tenant_id!: string
  @Property({ type: 'string' }) work_order_id!: string
  @Property({ type: 'integer' }) sequence!: number
  @Property({ type: 'string' }) name!: string
  @Property({ type: 'string', nullable: true }) work_center_id?: string
  @Property({ type: 'decimal', nullable: true }) standard_minutes?: number
  @Property({ type: 'string', default: 'pending' }) status = 'pending'
  @Property({ type: 'decimal', default: 0 }) completed_quantity = 0
  @Property() created_at: Date = new Date()
  @Property({ onUpdate: () => new Date() }) updated_at: Date = new Date()
  @Property({ nullable: true }) deleted_at?: Date
  @Property({ default: true }) is_active = true
}
