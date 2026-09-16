import { createWorkOrderSchema, transitionWorkOrderSchema } from '../data/validators'

describe('production work-order validators', () => {
  it('accepts a minimal work order with default priority and empty operations', () => {
    const parsed = createWorkOrderSchema.parse({
      tenantId: '00000000-0000-0000-0000-000000000001',
      organizationId: '00000000-0000-0000-0000-000000000002',
      orderNo: 'WO-0001',
      productId: '00000000-0000-0000-0000-000000000003',
      plannedQuantity: 10,
    })
    expect(parsed.priority).toBe('normal')
    expect(parsed.operations).toEqual([])
  })

  it('rejects non-positive planned quantity', () => {
    expect(() => createWorkOrderSchema.parse({
      tenantId: '00000000-0000-0000-0000-000000000001',
      organizationId: '00000000-0000-0000-0000-000000000002',
      orderNo: 'WO-0001',
      productId: '00000000-0000-0000-0000-000000000003',
      plannedQuantity: 0,
    })).toThrow()
  })

  it('rejects duplicate operation sequence numbers', () => {
    expect(() => createWorkOrderSchema.parse({
      tenantId: '00000000-0000-0000-0000-000000000001',
      organizationId: '00000000-0000-0000-0000-000000000002',
      orderNo: 'WO-0001',
      productId: '00000000-0000-0000-0000-000000000003',
      plannedQuantity: 10,
      operations: [
        { sequence: 10, name: '切割' },
        { sequence: 10, name: '装配' },
      ],
    })).toThrow()
  })

  it('limits transition states to the module state machine values', () => {
    expect(transitionWorkOrderSchema.parse({ id: '00000000-0000-0000-0000-000000000004', status: 'released' }).status).toBe('released')
    expect(() => transitionWorkOrderSchema.parse({ id: '00000000-0000-0000-0000-000000000004', status: 'unknown' })).toThrow()
  })
})
