import { z } from 'zod'

export const workOrderStatusSchema = z.enum(['draft', 'planned', 'released', 'in_progress', 'completed', 'cancelled'])
export const workOrderPrioritySchema = z.enum(['low', 'normal', 'high', 'urgent'])
export const operationExecutionStatusSchema = z.enum(['pending', 'in_progress', 'paused', 'completed'])

export const operationInputSchema = z.object({
  sequence: z.number().int().min(1),
  name: z.string().trim().min(1).max(255),
  workCenterId: z.string().uuid().optional(),
  standardMinutes: z.number().nonnegative().optional(),
})

const operationsSchema = z.array(operationInputSchema).max(100).superRefine((operations, ctx) => {
  const seen = new Set<number>()
  operations.forEach((operation, index) => {
    if (seen.has(operation.sequence)) {
      ctx.addIssue({ code: 'custom', path: [index, 'sequence'], message: 'Operation sequence must be unique' })
    }
    seen.add(operation.sequence)
  })
})

export const createWorkOrderSchema = z.object({
  tenantId: z.string().uuid(),
  organizationId: z.string().uuid(),
  orderNo: z.string().trim().min(1).max(64),
  productId: z.string().uuid(),
  plannedQuantity: z.number().positive(),
  dueDate: z.coerce.date().optional(),
  priority: workOrderPrioritySchema.default('normal'),
  notes: z.string().max(5000).optional(),
  operations: operationsSchema.default([]),
})

export const updateWorkOrderSchema = createWorkOrderSchema.partial().omit({ tenantId: true, organizationId: true }).extend({
  id: z.string().uuid(),
})

export const transitionWorkOrderSchema = z.object({
  id: z.string().uuid(),
  status: workOrderStatusSchema,
})

export const productionReportSchema = z.object({
  workOrderId: z.string().uuid(),
  quantity: z.number().positive(),
  actualMinutes: z.number().nonnegative().optional(),
  reportedAt: z.coerce.date().optional(),
  note: z.string().max(2000).optional(),
})

export const operationReportSchema = productionReportSchema.extend({
  operationId: z.string().uuid(),
  executionStatus: operationExecutionStatusSchema.optional(),
})

export type CreateWorkOrderInput = z.infer<typeof createWorkOrderSchema>
export type UpdateWorkOrderInput = z.infer<typeof updateWorkOrderSchema>
export type TransitionWorkOrderInput = z.infer<typeof transitionWorkOrderSchema>
export type ProductionReportInput = z.infer<typeof productionReportSchema>
export type OperationReportInput = z.infer<typeof operationReportSchema>
export type OperationExecutionStatus = z.infer<typeof operationExecutionStatusSchema>
