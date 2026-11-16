import {
  AccessDiagnosticReport,
  AccountEvidence,
  AnalysisUser,
  DiagnosticCheck,
  HierarchyEvidence,
  RecordContext,
  RecordOperation,
  RoleEvidence,
  ShareEvidence,
  TeamEvidence,
  UserAccessReport,
  recordAccessOperations,
} from '#types/record-access';
import { DynamicsUtils } from './utils';

export interface AccessAnalysisApi {
  get(path: string): Promise<Record<string, unknown>>;
  list(path: string): Promise<Array<Record<string, unknown>>>;
}

const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id = (value: unknown): string =>
  String(value ?? '')
    .replace(/[{}]/g, '')
    .toLowerCase();
const text = (row: Record<string, unknown>, key: string): string => String(row[key] ?? '');
const formatted = (row: Record<string, unknown>, key: string): string =>
  text(row, `${key}@OData.Community.Display.V1.FormattedValue`);
const flag = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined;
const number = (value: unknown): number | undefined =>
  typeof value === 'number' ? value : undefined;
const rights = (value: unknown): string[] =>
  typeof value === 'string'
    ? value
        .split(',')
        .map(item => item.trim())
        .filter(item => item && item !== 'None')
    : [];

class DiagnosticError extends Error {
  constructor(
    message: string,
    readonly code?: string
  ) {
    super(message);
  }
}

async function check<T>(action: () => Promise<T>): Promise<DiagnosticCheck<T>> {
  try {
    return { status: 'ok', data: await action() };
  } catch (error) {
    return {
      status: 'unavailable',
      message: error instanceof Error ? error.message : String(error),
      code: error instanceof DiagnosticError ? error.code : undefined,
    };
  }
}
const unavailable = (message: string): DiagnosticCheck<never> => ({
  status: 'unavailable',
  message,
});

export function createAccessAnalysisApi(): AccessAnalysisApi {
  const root = `${Xrm.Utility.getGlobalContext().getClientUrl().replace(/\/$/, '')}/api/data/v9.0/`;
  const get = async (path: string): Promise<Record<string, unknown>> => {
    const url = new URL(path, root);
    if (!url.href.startsWith(root)) {
      throw new DiagnosticError('Invalid diagnostic request destination.');
    }
    const response = await fetch(url.href, {
      headers: {
        Accept: 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0',
        Prefer: 'odata.include-annotations="*",odata.maxpagesize=5000',
      },
    });
    if (!response.ok) {
      let code: string | undefined;
      let message = `${response.status} ${response.statusText}`;
      try {
        const body = (await response.json()) as { error?: { code?: string; message?: string } };
        code = body.error?.code;
        message = body.error?.message ?? message;
      } catch {
        /* Some endpoints return a non-JSON error body. */
      }
      throw new DiagnosticError(message, code);
    }
    return (await response.json()) as Record<string, unknown>;
  };
  return {
    get,
    list: async path => {
      const rows: Array<Record<string, unknown>> = [];
      const seen = new Set<string>();
      let next = path;
      while (next) {
        if (seen.has(next)) {
          throw new DiagnosticError('Repeated server pagination link; results are incomplete.');
        }
        seen.add(next);
        const page = await get(next);
        if (!Array.isArray(page.value)) {
          throw new DiagnosticError('Unexpected diagnostic collection response.');
        }
        rows.push(...(page.value as Array<Record<string, unknown>>));
        next = typeof page['@odata.nextLink'] === 'string' ? page['@odata.nextLink'] : '';
        if (
          !next &&
          (page['@Microsoft.Dynamics.CRM.morerecords'] === true ||
            page['@Microsoft.Dynamics.CRM.morerecords'] === 'true')
        ) {
          throw new DiagnosticError(
            'The server returned additional FetchXML pages without a continuation link; results are incomplete.'
          );
        }
      }
      return rows;
    },
  };
}

function account(row: Record<string, unknown>, userId: string): AccountEvidence {
  return {
    id: userId,
    name: text(row, 'fullname'),
    disabled: flag(row.isdisabled),
    licensed: flag(row.islicensed),
    accessMode: number(row.accessmode),
    businessUnitId: id(row._businessunitid_value),
    businessUnitName: formatted(row, '_businessunitid_value'),
    managerId: id(row._parentsystemuserid_value),
    managerName: formatted(row, '_parentsystemuserid_value'),
    positionId: id(row._positionid_value),
    positionName: formatted(row, '_positionid_value'),
  };
}
const accountSelect =
  'fullname,isdisabled,islicensed,accessmode,_businessunitid_value,_parentsystemuserid_value,_positionid_value';
function team(row: Record<string, unknown>): TeamEvidence {
  return {
    id: id(row.teamid),
    name: text(row, 'name'),
    type: Number(row.teamtype),
    businessUnitId: id(row._businessunitid_value),
    regardingId: id(row._regardingobjectid_value),
  };
}

async function loadContext(
  entity: string,
  recordId: string,
  api: AccessAnalysisApi
): Promise<RecordContext> {
  const metadata = await check(() =>
    api.get(
      `EntityDefinitions(LogicalName='${entity}')?$select=EntitySetName,SchemaName,OwnershipType,PrimaryIdAttribute,Privileges`
    )
  );
  const collection =
    metadata.status === 'ok' && typeof metadata.data.EntitySetName === 'string'
      ? metadata.data.EntitySetName
      : DynamicsUtils.getEntityCollectionName(entity);
  const target = encodeURIComponent(JSON.stringify({ '@odata.id': `${collection}(${recordId})` }));
  const organizationId = id(Xrm.Utility.getGlobalContext().organizationSettings.organizationId);
  const [record, shares, organization, businessUnits] = await Promise.all([
    check(() =>
      api.get(
        `${collection}(${recordId})${metadata.status === 'ok' && String(metadata.data.OwnershipType).includes('OrganizationOwned') ? '?$select=' + String(metadata.data.PrimaryIdAttribute ?? entity + 'id') : '?$select=_ownerid_value,_owningbusinessunit_value'}`
      )
    ),
    check(async () => {
      const response = await api.get(`RetrieveSharedPrincipalsAndAccess(Target=@p1)?@p1=${target}`);
      if (!Array.isArray(response.PrincipalAccesses)) {
        throw new DiagnosticError('Unexpected shared-access response.');
      }
      return response.PrincipalAccesses as Array<Record<string, unknown>>;
    }),
    check(() =>
      api.get(
        `organizations(${organizationId})?$select=ishierarchicalsecuritymodelenabled,maxdepthforhierarchicalsecuritymodel`
      )
    ),
    check(() => api.list('businessunits?$select=businessunitid,name,_parentbusinessunitid_value')),
  ]);
  return {
    entity,
    recordId,
    timestamp: new Date().toISOString(),
    metadata,
    record,
    shares,
    organization,
    businessUnits,
  };
}

async function loadRoles(
  userId: string,
  teams: DiagnosticCheck<TeamEvidence[]>,
  context: RecordContext,
  api: AccessAnalysisApi
): Promise<{ roles: RoleEvidence[]; complete: boolean }> {
  const direct = await api.list(
    `systemusers(${userId})/systemuserroles_association?$select=roleid,name,_businessunitid_value`
  );
  let complete = teams.status === 'ok';
  const assignments = direct.map(row => ({ row, team: undefined as TeamEvidence | undefined }));
  for (const currentTeam of teams.status === 'ok'
    ? teams.data.filter(item => item.type !== 1)
    : []) {
    const teamRoles = await check(() =>
      api.list(
        `teams(${currentTeam.id})/teamroles_association?$select=roleid,name,_businessunitid_value`
      )
    );
    if (teamRoles.status === 'ok') {
      assignments.push(...teamRoles.data.map(row => ({ row, team: currentTeam })));
    } else {
      complete = false;
    }
  }
  const metadata = context.metadata.status === 'ok' ? context.metadata.data : undefined;
  const privilegeMap = new Map<string, RecordOperation>();
  for (const privilege of (Array.isArray(metadata?.Privileges) ? metadata.Privileges : []) as Array<
    Record<string, unknown>
  >) {
    const operation = recordAccessOperations.find(
      op =>
        String(privilege.PrivilegeType) === op.key ||
        text(privilege, 'Name').toLowerCase() ===
          `prv${op.key}${String(metadata?.SchemaName ?? '')}`.toLowerCase()
    );
    if (operation) {
      privilegeMap.set(id(privilege.PrivilegeId), operation.key);
    }
  }
  if (!privilegeMap.size) {
    complete = false;
  }
  const uniqueIds = [...new Set(assignments.map(item => id(item.row.roleid)))];
  const depthByRole = new Map<string, Partial<Record<RecordOperation, number>>>();
  // Query each role separately to keep URLs bounded and preserve already collected evidence.
  for (const roleId of privilegeMap.size ? uniqueIds : []) {
    const query = `<fetch><entity name="roleprivileges"><attribute name="privilegeid" /><attribute name="privilegedepthmask" /><filter><condition attribute="roleid" operator="eq" value="${roleId}" /><condition attribute="privilegeid" operator="in">${[...privilegeMap.keys()].map(key => `<value>${key}</value>`).join('')}</condition></filter></entity></fetch>`;
    const rows = await check(() =>
      api.list(`roleprivilegescollection?fetchXml=${encodeURIComponent(query)}`)
    );
    if (rows.status !== 'ok') {
      complete = false;
      continue;
    }
    const depths: Partial<Record<RecordOperation, number>> = {};
    for (const row of rows.data) {
      const op = privilegeMap.get(id(row.privilegeid));
      if (op) {
        const mask = Number(row.privilegedepthmask);
        const depth = [8, 4, 2, 1].find(value => (mask & value) !== 0) ?? 0;
        depths[op] = Math.max(depths[op] ?? 0, depth);
      }
    }
    depthByRole.set(roleId, depths);
  }
  return {
    complete,
    roles: assignments.map(item => ({
      id: id(item.row.roleid),
      name: text(item.row, 'name'),
      businessUnitId: id(item.row._businessunitid_value),
      businessUnitName: formatted(item.row, '_businessunitid_value'),
      teamId: item.team?.id,
      teamName: item.team?.name,
      depths: depthByRole.get(id(item.row.roleid)) ?? {},
      privilegesKnown: depthByRole.has(id(item.row.roleid)),
    })),
  };
}

function matchShares(
  context: RecordContext,
  userId: string,
  teams: DiagnosticCheck<TeamEvidence[]>
): DiagnosticCheck<ShareEvidence[]> {
  if (context.shares.status !== 'ok') {
    return context.shares;
  }
  if (teams.status !== 'ok') {
    return unavailable('Team membership is unavailable; team sharing cannot be ruled out.');
  }
  const organizationId = id(Xrm.Utility.getGlobalContext().organizationSettings.organizationId);
  const matches: ShareEvidence[] = [];
  for (const item of context.shares.data) {
    const principal = item.Principal as Record<string, unknown> | undefined;
    if (!principal) {
      return unavailable('Shared principal details were not returned.');
    }
    const principalType =
      text(principal, '@odata.type').replace('#Microsoft.Dynamics.CRM.', '') ||
      (principal.systemuserid
        ? 'systemuser'
        : principal.teamid
          ? 'team'
          : principal.organizationid
            ? 'organization'
            : '');
    const principalId = id(
      principal.systemuserid ?? principal.teamid ?? principal.organizationid ?? principal.ownerid
    );
    if (!principalId || !['systemuser', 'team', 'organization'].includes(principalType)) {
      return unavailable(
        'The shared principal identity is unavailable; matching sharing cannot be ruled out.'
      );
    }
    const currentTeam = teams.data.find(value => value.id === principalId);
    let source: ShareEvidence['source'] | undefined;
    if (principalType === 'systemuser' && principalId === userId) {
      source = 'user';
    }
    if (principalType === 'team' && currentTeam) {
      source = 'team';
    }
    if (principalType === 'organization' && principalId === organizationId) {
      source = 'organization';
    }
    if (source) {
      matches.push({
        principalId,
        principalType,
        principalName: currentTeam?.name ?? text(principal, 'fullname') ?? '',
        rights: rights(item.AccessMask ?? item.AccessRights),
        source,
        accessTeam: currentTeam?.type === 1,
      });
    }
  }
  return { status: 'ok', data: matches };
}

async function hierarchy(
  context: RecordContext,
  selected: AccountEvidence,
  api: AccessAnalysisApi
): Promise<HierarchyEvidence> {
  if (context.record.status !== 'ok') {
    throw new DiagnosticError(
      'Record ownership is unavailable; hierarchy relationships cannot be checked.'
    );
  }
  const row = context.record.data;
  const ownerType = text(row, '_ownerid_value@Microsoft.Dynamics.CRM.lookuplogicalname');
  const result: HierarchyEvidence = {
    enabled:
      context.organization.status === 'ok'
        ? flag(context.organization.data.ishierarchicalsecuritymodelenabled)
        : undefined,
    maxDepth:
      context.organization.status === 'ok'
        ? number(context.organization.data.maxdepthforhierarchicalsecuritymodel)
        : undefined,
    managerChain: [],
    positionChain: [],
    managerMatch: false,
    positionMatch: false,
  };
  if (ownerType !== 'systemuser') {
    return result;
  }
  let owner = account(
    await api.get(`systemusers(${id(row._ownerid_value)})?$select=${accountSelect}`),
    id(row._ownerid_value)
  );
  const ownerPosition = owner.positionId;
  const visitedManagers = new Set<string>();
  while (owner.managerId) {
    if (visitedManagers.has(owner.managerId)) {
      throw new DiagnosticError('Cycle detected in manager hierarchy.');
    }
    visitedManagers.add(owner.managerId);
    owner = account(
      await api.get(`systemusers(${owner.managerId})?$select=${accountSelect}`),
      owner.managerId
    );
    result.managerChain.push({
      id: owner.id,
      name: owner.name,
      businessUnitId: owner.businessUnitId,
    });
    if (owner.id === selected.id) {
      result.managerMatch = true;
    }
  }
  let positionId = ownerPosition;
  const visitedPositions = new Set<string>();
  while (positionId) {
    if (visitedPositions.has(positionId)) {
      throw new DiagnosticError('Cycle detected in position hierarchy.');
    }
    visitedPositions.add(positionId);
    const position = await api.get(`positions(${positionId})?$select=name,_parentpositionid_value`);
    positionId = id(position._parentpositionid_value);
    if (positionId) {
      const parent = await api.get(`positions(${positionId})?$select=name`);
      result.positionChain.push({ id: positionId, name: text(parent, 'name') });
      if (positionId === selected.positionId) {
        result.positionMatch = true;
      }
    }
  }
  return result;
}

async function analyzeUser(
  context: RecordContext,
  user: AnalysisUser,
  api: AccessAnalysisApi
): Promise<UserAccessReport> {
  const userId = id(user.userId);
  const [accountCheck, teams] = await Promise.all([
    check(async () =>
      account(await api.get(`systemusers(${userId})?$select=${accountSelect}`), userId)
    ),
    check(async () =>
      (
        await api.list(
          `systemusers(${userId})/teammembership_association?$select=teamid,name,teamtype,_businessunitid_value,_regardingobjectid_value`
        )
      ).map(team)
    ),
  ]);
  const collection =
    context.metadata.status === 'ok' && typeof context.metadata.data.EntitySetName === 'string'
      ? context.metadata.data.EntitySetName
      : DynamicsUtils.getEntityCollectionName(context.entity);
  const target = encodeURIComponent(
    JSON.stringify({ '@odata.id': `${collection}(${context.recordId})` })
  );
  const [effectiveRights, roleCollection, hierarchyCheck] = await Promise.all([
    accountCheck.status === 'ok' && accountCheck.data.disabled === true
      ? Promise.resolve<DiagnosticCheck<string[]>>({
          status: 'skipped',
          message:
            'The selected user is disabled. Account status must be resolved before checking effective access.',
        })
      : check(async () => {
          const response = await api.get(
            `systemusers(${userId})/Microsoft.Dynamics.CRM.RetrievePrincipalAccess(Target=@p1)?@p1=${target}`
          );
          if (typeof response.AccessRights !== 'string') {
            throw new DiagnosticError('Unexpected effective-access response.');
          }
          return rights(response.AccessRights);
        }),
    check(() => loadRoles(userId, teams, context, api)),
    accountCheck.status === 'ok'
      ? check(() => hierarchy(context, accountCheck.data, api))
      : Promise.resolve(unavailable('Account hierarchy details could not be retrieved.')),
  ]);
  const roles: DiagnosticCheck<RoleEvidence[]> =
    roleCollection.status === 'ok'
      ? { status: 'ok', data: roleCollection.data.roles }
      : roleCollection;
  const rolesComplete = roleCollection.status === 'ok' && roleCollection.data.complete;
  const matchedShares = matchShares(context, userId, teams);
  const isAccountFailure =
    effectiveRights.status !== 'ok' &&
    (effectiveRights.code?.toLowerCase() === '0x8004d24d' || effectiveRights.status === 'skipped');
  const summary: UserAccessReport['summary'] = isAccountFailure
    ? 'account-unavailable'
    : effectiveRights.status !== 'ok'
      ? 'unknown'
      : effectiveRights.data.includes('ReadAccess')
        ? 'allowed'
        : 'denied';
  const reasons: UserAccessReport['reasons'] = [];
  if (accountCheck.status === 'ok' && accountCheck.data.disabled === true) {
    reasons.push('disabled');
  }
  if (
    accountCheck.status === 'ok' &&
    accountCheck.data.licensed === false &&
    accountCheck.data.accessMode === 0
  ) {
    reasons.push('license');
  }
  if (isAccountFailure && !(accountCheck.status === 'ok' && accountCheck.data.disabled === true)) {
    reasons.push('account-review');
  }
  if (summary === 'allowed') {
    reasons.push('visibility-review');
  }
  if (
    summary === 'denied' &&
    rolesComplete &&
    roles.status === 'ok' &&
    roles.data.every(role => !role.depths.Read)
  ) {
    reasons.push('missing-read-privilege');
  } else if (summary === 'denied') {
    reasons.push('scope-review');
  }
  if (
    [
      accountCheck,
      teams,
      effectiveRights,
      roles,
      matchedShares,
      hierarchyCheck,
      context.record,
      context.organization,
      context.businessUnits,
    ].some(value => value.status === 'unavailable') ||
    !rolesComplete
  ) {
    reasons.push('incomplete');
  }
  return {
    user,
    account: accountCheck,
    teams,
    rights: effectiveRights,
    roles,
    rolesComplete,
    shares: matchedShares,
    hierarchy: hierarchyCheck,
    summary,
    reasons,
  };
}

export async function collectRecordAccessReport(
  entity: string,
  recordId: string,
  users: AnalysisUser[],
  api: AccessAnalysisApi = createAccessAnalysisApi()
): Promise<AccessDiagnosticReport> {
  if (
    !/^[a-z][a-z0-9_]*$/i.test(entity) ||
    !guid.test(recordId) ||
    !users.length ||
    users.length > 2 ||
    users.some(user => !guid.test(user.userId))
  ) {
    throw new Error('Select one or two valid users and an existing record.');
  }
  const getCache = new Map<string, Promise<Record<string, unknown>>>();
  const listCache = new Map<string, Promise<Array<Record<string, unknown>>>>();
  const snapshotApi: AccessAnalysisApi = {
    get: path => {
      if (!getCache.has(path)) {
        getCache.set(path, api.get(path));
      }
      return getCache.get(path)!;
    },
    list: path => {
      if (!listCache.has(path)) {
        listCache.set(path, api.list(path));
      }
      return listCache.get(path)!;
    },
  };
  const context = await loadContext(entity, id(recordId), snapshotApi);
  const uniqueUsers = [...new Map(users.map(user => [id(user.userId), user])).values()];
  const reports: UserAccessReport[] = [];
  for (const user of uniqueUsers) {
    reports.push(await analyzeUser(context, user, snapshotApi));
  }
  return { context, users: reports };
}
