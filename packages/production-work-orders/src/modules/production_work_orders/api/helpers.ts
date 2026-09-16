import { NextResponse } from 'next/server'
import { getAuthFromRequest, type AuthContext } from '@open-mercato/shared/lib/auth/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { CommandBus } from '@open-mercato/shared/lib/commands/command-bus'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { RbacService } from '@open-mercato/core/modules/auth/services/rbacService'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'

export async function requireProductionContext(req: Request, feature: string) {
  const auth = await getAuthFromRequest(req)
  if (!auth?.tenantId || !auth.orgId) throw new CrudHttpError(401, { error: 'Unauthorized' })
  const container = await createRequestContainer()
  const rbac = container.resolve('rbacService') as RbacService
  const allowed = await rbac.userHasAllFeatures(auth.sub, [feature], { tenantId: auth.tenantId, organizationId: auth.orgId })
  if (!allowed) throw new CrudHttpError(403, { error: 'Forbidden' })
  return { auth, container, em: container.resolve('em') as EntityManager, commandBus: container.resolve('commandBus') as CommandBus }
}

export const commandContext = (req: Request, container: Awaited<ReturnType<typeof createRequestContainer>>, auth: AuthContext): CommandRuntimeContext => ({
  container,
  auth,
  organizationScope: null,
  selectedOrganizationId: auth?.orgId ?? null,
  organizationIds: auth?.orgId ? [auth.orgId] : null,
  request: req,
})

export const routeError = (error: unknown) => {
  if (error instanceof CrudHttpError) return NextResponse.json(error.body, { status: error.status })
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}
