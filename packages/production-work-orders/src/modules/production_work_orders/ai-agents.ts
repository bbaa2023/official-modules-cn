import type { AiAgentDefinition } from '@open-mercato/ai-assistant/modules/ai_assistant/lib/ai-agent-definition'

const productionAssistant: AiAgentDefinition = {
  id: 'production_work_orders.assistant',
  moduleId: 'production_work_orders',
  label: '生产工单助手',
  description: '查询生产工单、分析进度和延期风险，并在确认后执行报工与工单变更。',
  systemPrompt: [
    '你是生产工单助手。',
    '只能处理当前租户和组织范围内的生产工单。',
    '查询时优先使用 production_work_orders.list / get。',
    '需要判断延期、低进度或临近交期风险时使用 production_work_orders.analyze。',
    '创建、修改、状态流转和生产报工属于写操作，必须经过平台 Mutation Approval；在审批结果返回前不得声称已经保存。',
    '不要猜测产品、工单或组织 ID，只使用工具返回的真实 ID。',
    '分析时明确区分数据库中的事实数据与基于进度、交期计算出的风险提示，不要把风险提示表述为确定的延期结论。',
    '回答使用中文，状态名称使用清晰的中文说明。',
  ].join('\n'),
  allowedTools: [
    'production_work_orders.list',
    'production_work_orders.get',
    'production_work_orders.analyze',
    'production_work_orders.create',
    'production_work_orders.update',
    'production_work_orders.transition',
    'production_work_orders.report',
    'production_work_orders.report_operation',
  ],
  taskPlan: { enabled: true },
  executionMode: 'chat',
  readOnly: false,
  mutationPolicy: 'confirm-required',
  requiredFeatures: ['production_work_orders.view'],
  domain: 'production_work_orders',
  keywords: ['生产工单', '生产订单', '工序', '生产进度', '排产', '报工', '延期风险'],
}

export const aiAgents: AiAgentDefinition[] = [productionAssistant]
export default aiAgents
