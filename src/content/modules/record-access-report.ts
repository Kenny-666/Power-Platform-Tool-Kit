import {
  AccessDiagnosticReport,
  DiagnosticCheck,
  RoleEvidence,
  UserAccessReport,
  recordAccessOperations,
} from '#types/record-access';
import { TableData } from './table-dialog';
import { accessT, AccessMessage } from './record-access-localization';
import { securityT } from './security-localization';

const value = (item: unknown): string =>
  item === undefined || item === null || item === '' ? securityT('Unknown') : String(item);
const boolean = (item: unknown): string =>
  typeof item === 'boolean' ? accessT(item ? 'yes' : 'no') : securityT('Unknown');
const dataText = (row: Record<string, unknown>, key: string): string => String(row[key] ?? '');
const formatted = (row: Record<string, unknown>, key: string): string =>
  dataText(row, `${key}@OData.Community.Display.V1.FormattedValue`);
const depth = (mask: number): string =>
  securityT(
    mask === 8
      ? 'Organization'
      : mask === 4
        ? 'Parent: Child Business Units'
        : mask === 2
          ? 'Business Unit'
          : mask === 1
            ? 'User level'
            : 'Not granted'
  );
const state = <T>(result: DiagnosticCheck<T>): string =>
  result.status === 'ok'
    ? accessT('checked')
    : accessT(result.status === 'skipped' ? 'skipped' : 'notChecked');
const issue = <T>(result: DiagnosticCheck<T>): string =>
  result.status === 'ok'
    ? ''
    : result.status === 'skipped'
      ? accessT('disabled')
      : `${accessT('incomplete')}${result.code ? ` (${result.code})` : ''} — ${result.message === 'Team membership is unavailable; team sharing cannot be ruled out.' ? accessT('teamDependency') : result.message}`;
const unavailableRow = <T>(result: DiagnosticCheck<T>, width: number): string[][] => [
  [state(result), issue(result), ...Array(Math.max(0, width - 2)).fill('')],
];
const rightsLabel = (rights: string[]): string =>
  rights.length
    ? rights
        .map(right => {
          const operation = recordAccessOperations.find(op => op.right === right);
          return operation ? securityT(operation.label) : right;
        })
        .join(', ')
    : accessT('missing');
const reasonKey: Record<UserAccessReport['reasons'][number], AccessMessage> = {
  'account-review': 'accountReview',
  disabled: 'disabled',
  license: 'license',
  'missing-read-privilege': 'missingRead',
  'scope-review': 'scopeReview',
  'visibility-review': 'visibility',
  incomplete: 'incomplete',
};
const summaryKey: Record<UserAccessReport['summary'], AccessMessage> = {
  allowed: 'allowed',
  denied: 'denied',
  'account-unavailable': 'accountUnavailable',
  unknown: 'unknown',
};
const roleDepth = (
  role: RoleEvidence,
  operation: (typeof recordAccessOperations)[number]['key']
): string =>
  role.privilegesKnown === false ? accessT('notChecked') : depth(role.depths[operation] ?? 0);
const roleSource = (role: RoleEvidence): string =>
  role.teamId
    ? securityT('Team role: {team}', { team: role.teamName ?? role.teamId })
    : securityT('Direct role');

function userTables(report: AccessDiagnosticReport, user: UserAccessReport): TableData[] {
  const prefix = `${user.user.userName} — `;
  const account = user.account.status === 'ok' ? user.account.data : undefined;
  const record = report.context.record.status === 'ok' ? report.context.record.data : undefined;
  const recordBU = record ? dataText(record, '_owningbusinessunit_value').toLowerCase() : '';
  const units =
    report.context.businessUnits.status === 'ok' ? report.context.businessUnits.data : undefined;
  const recordBUName = record ? formatted(record, '_owningbusinessunit_value') || recordBU : '';
  let relation = securityT('Unknown');
  if (account?.businessUnitId && recordBU) {
    relation = accessT(account.businessUnitId === recordBU ? 'sameBU' : 'differentBU');
    if (units) {
      const visited = new Set<string>();
      let parent = recordBU;
      while (parent && !visited.has(parent)) {
        visited.add(parent);
        const unit = units.find(item => dataText(item, 'businessunitid').toLowerCase() === parent);
        parent = unit ? dataText(unit, '_parentbusinessunitid_value').toLowerCase() : '';
        if (parent === account.businessUnitId) {
          relation = accessT('parentBU');
          break;
        }
      }
    }
  }
  const ownerId = record ? dataText(record, '_ownerid_value').toLowerCase() : '';
  const ownedByUser = Boolean(ownerId && ownerId === user.user.userId.toLowerCase());
  const ownerTeam =
    user.teams.status === 'ok' ? user.teams.data.find(team => team.id === ownerId) : undefined;
  const owned =
    record && ownerId && user.teams.status === 'ok'
      ? boolean(ownedByUser || Boolean(ownerTeam))
      : securityT('Unknown');
  const organizationOwned =
    report.context.metadata.status === 'ok' &&
    String(report.context.metadata.data.OwnershipType).includes('OrganizationOwned');
  const shared = user.shares.status === 'ok' ? user.shares.data : undefined;
  const accountRows = account
    ? [
        [
          accessT('enabled'),
          boolean(account.disabled === undefined ? undefined : !account.disabled),
        ],
        [accessT('licensed'), boolean(account.licensed)],
        [accessT('accessMode'), value(account.accessMode)],
        [accessT('businessUnit'), value(account.businessUnitName || account.businessUnitId)],
        [accessT('manager'), value(account.managerName || account.managerId)],
        [accessT('position'), value(account.positionName || account.positionId)],
      ]
    : unavailableRow(user.account, 2);
  const hierarchyRows =
    user.hierarchy.status === 'ok'
      ? [
          [accessT('hierarchyEnabled'), boolean(user.hierarchy.data.enabled)],
          [accessT('hierarchyDepth'), value(user.hierarchy.data.maxDepth)],
          [
            accessT('managerChain'),
            value(user.hierarchy.data.managerChain.map(item => item.name || item.id).join(' → ')),
          ],
          [accessT('managerMatch'), boolean(user.hierarchy.data.managerMatch)],
          [
            accessT('positionChain'),
            value(user.hierarchy.data.positionChain.map(item => item.name || item.id).join(' → ')),
          ],
          [accessT('positionMatch'), boolean(user.hierarchy.data.positionMatch)],
        ]
      : unavailableRow(user.hierarchy, 2);
  return [
    {
      title: prefix + accessT('account'),
      headers: [securityT('Property'), securityT('Value')],
      rows: accountRows,
    },
    {
      title: prefix + securityT('Effective Record Rights'),
      headers: [securityT('Operation'), securityT('Result')],
      rows: recordAccessOperations.map(op => [
        securityT(op.label),
        user.rights.status === 'ok'
          ? securityT(user.rights.data.includes(op.right) ? 'Allowed' : 'Not allowed')
          : state(user.rights),
      ]),
      description: issue(user.rights),
    },
    {
      title: prefix + accessT('matrix'),
      description: user.rolesComplete ? '' : accessT('incomplete'),
      headers: [
        securityT('Security Role'),
        securityT('Assignment Source'),
        accessT('roleBusinessUnit'),
        ...recordAccessOperations.map(op => securityT(op.label)),
      ],
      rows:
        user.roles.status === 'ok'
          ? user.roles.data.length
            ? user.roles.data.map(role => [
                role.name,
                roleSource(role),
                value(role.businessUnitName || role.businessUnitId),
                ...recordAccessOperations.map(op => roleDepth(role, op.key)),
              ])
            : [
                [
                  accessT('noRoles'),
                  '',
                  '',
                  ...recordAccessOperations.map(() => accessT('missing')),
                ],
              ]
          : unavailableRow(user.roles, 3 + recordAccessOperations.length),
    },
    {
      title: prefix + accessT('ownershipBU'),
      headers: [securityT('Property'), securityT('Value')],
      rows: [
        [
          accessT('owner'),
          organizationOwned
            ? accessT('organizationOwned')
            : record
              ? value(formatted(record, '_ownerid_value') || ownerId)
              : state(report.context.record),
        ],
        [securityT('Ownership'), organizationOwned ? accessT('organizationOwned') : owned],
        [
          accessT('recordBusinessUnit'),
          record ? value(recordBUName) : state(report.context.record),
        ],
        [accessT('businessUnit'), value(account?.businessUnitName || account?.businessUnitId)],
        [accessT('detail'), relation],
        ...(report.context.businessUnits.status !== 'ok'
          ? [[accessT('status'), state(report.context.businessUnits)]]
          : []),
      ],
    },
    {
      title: prefix + accessT('shares'),
      headers: [accessT('principal'), securityT('Source'), accessT('sharedRights')],
      description: accessT('shareNote'),
      rows: shared
        ? shared.length
          ? shared.map(item => [
              value(item.principalName || item.principalId),
              accessT(
                item.source === 'user'
                  ? 'directShare'
                  : item.source === 'organization'
                    ? 'organizationShare'
                    : 'teamShare'
              ),
              rightsLabel(item.rights),
            ])
          : [[accessT('noShares'), '', '']]
        : unavailableRow(user.shares, 3),
    },
    {
      title: prefix + accessT('teams'),
      headers: [
        securityT('Name'),
        accessT('teamType'),
        accessT('targetTeam'),
        accessT('sharedRights'),
      ],
      description: accessT('membershipNote'),
      rows:
        user.teams.status === 'ok'
          ? user.teams.data.length
            ? user.teams.data.map(team => [
                team.name,
                team.type === 1 ? accessT('accessTeam') : accessT('ownerTeam'),
                boolean(team.regardingId === report.context.recordId),
                shared
                  ? rightsLabel([
                      ...new Set(
                        shared
                          .filter(item => item.principalId === team.id)
                          .flatMap(item => item.rights)
                      ),
                    ])
                  : state(user.shares),
              ])
            : [[accessT('noTeams'), '', '', '']]
          : unavailableRow(user.teams, 4),
    },
    {
      title: prefix + accessT('hierarchy'),
      headers: [securityT('Property'), securityT('Value')],
      rows: hierarchyRows,
      description: accessT('hierarchyNote'),
    },
  ];
}

function comparisonTables(users: UserAccessReport[]): TableData[] {
  if (users.length !== 2) {
    return [];
  }
  const [a, b] = users;
  const headers = [securityT('Property'), a.user.userName, b.user.userName, accessT('difference')];
  const row = (
    name: string,
    left: string,
    right: string,
    sameIdentity = left === right
  ): string[] => [
    name,
    left,
    right,
    [left, right].some(
      item => item.includes(accessT('notChecked')) || item.includes(accessT('skipped'))
    )
      ? accessT('notChecked')
      : accessT(sameIdentity ? 'same' : 'different'),
  ];
  const rows = recordAccessOperations.map(op =>
    row(
      securityT(op.label),
      a.rights.status === 'ok'
        ? securityT(a.rights.data.includes(op.right) ? 'Allowed' : 'Not allowed')
        : state(a.rights),
      b.rights.status === 'ok'
        ? securityT(b.rights.data.includes(op.right) ? 'Allowed' : 'Not allowed')
        : state(b.rights)
    )
  );
  rows.push(
    row(
      accessT('businessUnit'),
      a.account.status === 'ok'
        ? value(a.account.data.businessUnitName || a.account.data.businessUnitId)
        : state(a.account),
      b.account.status === 'ok'
        ? value(b.account.data.businessUnitName || b.account.data.businessUnitId)
        : state(b.account),
      a.account.status === 'ok' &&
        b.account.status === 'ok' &&
        a.account.data.businessUnitId === b.account.data.businessUnitId
    )
  );
  for (const key of ['disabled', 'licensed', 'accessMode'] as const) {
    const accountValue = (user: UserAccessReport): string =>
      user.account.status !== 'ok'
        ? state(user.account)
        : key === 'accessMode'
          ? value(user.account.data.accessMode)
          : boolean(
              key === 'disabled'
                ? user.account.data.disabled === undefined
                  ? undefined
                  : !user.account.data.disabled
                : user.account.data.licensed
            );
    rows.push(row(accessT(key === 'disabled' ? 'enabled' : key), accountValue(a), accountValue(b)));
  }
  const roleIds = new Map<string, string>();
  for (const user of users) {
    if (user.roles.status === 'ok') {
      for (const role of user.roles.data) {
        roleIds.set(`${role.id}:${role.teamId ?? ''}`, `${role.name} (${roleSource(role)})`);
      }
    }
  }
  for (const [identity, name] of roleIds) {
    const roleValue = (user: UserAccessReport): string => {
      if (user.roles.status !== 'ok') {
        return state(user.roles);
      }
      const role = user.roles.data.find(item => `${item.id}:${item.teamId ?? ''}` === identity);
      return role
        ? recordAccessOperations
            .map(op => `${securityT(op.label)}: ${roleDepth(role, op.key)}`)
            .join('; ')
        : accessT(user.rolesComplete ? 'no' : 'notChecked');
    };
    rows.push(row(name, roleValue(a), roleValue(b)));
  }
  const teamNames = new Map<string, string>();
  for (const user of users) {
    if (user.teams.status === 'ok') {
      for (const team of user.teams.data) {
        teamNames.set(team.id, team.name);
      }
    }
  }
  for (const [teamId, name] of teamNames) {
    const member = (user: UserAccessReport): string =>
      user.teams.status === 'ok'
        ? boolean(user.teams.data.some(team => team.id === teamId))
        : state(user.teams);
    rows.push(row(`${accessT('membership')}: ${name}`, member(a), member(b)));
  }
  const shareValue = (user: UserAccessReport): string =>
    user.shares.status === 'ok'
      ? user.shares.data
          .map(
            share =>
              `${value(share.principalName || share.principalId)}: ${rightsLabel(share.rights)}`
          )
          .join('; ') || accessT('noShares')
      : state(user.shares);
  rows.push(row(accessT('shares'), shareValue(a), shareValue(b)));
  return [{ title: accessT('comparison'), headers, rows, description: accessT('comparisonNote') }];
}

export function createAccessReportTables(report: AccessDiagnosticReport): TableData[] {
  return [
    {
      title: accessT('summary'),
      headers: [securityT('User'), accessT('status'), accessT('detail')],
      rows: report.users.map(user => [
        user.user.userName,
        accessT(summaryKey[user.summary]),
        user.reasons.map(reason => accessT(reasonKey[reason])).join('\n'),
      ]),
      description: `${accessT('timestamp')}: ${report.context.timestamp}`,
    },
    ...comparisonTables(report.users),
    ...report.users.flatMap(user => userTables(report, user)),
    {
      title: accessT('limitations'),
      headers: [securityT('Property'), accessT('detail')],
      rows: [
        [accessT('status'), accessT('readOnly')],
        [accessT('hierarchy'), accessT('hierarchyNote')],
        [accessT('shares'), accessT('shareNote')],
        [accessT('detail'), accessT('visibility')],
        ...(report.context.metadata.status !== 'ok'
          ? [[accessT('matrix'), issue(report.context.metadata)]]
          : []),
        ...(report.context.organization.status !== 'ok'
          ? [[accessT('hierarchyEnabled'), issue(report.context.organization)]]
          : []),
      ],
    },
  ];
}

/** Construct an allowlisted export; never serialize the raw report or server error bodies. */
export function createRedactedAccessReport(
  report: AccessDiagnosticReport
): Record<string, unknown> {
  const aliases = new Map<string, string>();
  const alias = (kind: string, identifier?: string): string | undefined => {
    if (!identifier) {
      return undefined;
    }
    const key = `${kind}:${identifier.toLowerCase()}`;
    if (!aliases.has(key)) {
      aliases.set(
        key,
        `${kind}${[...aliases.keys()].filter(item => item.startsWith(kind + ':')).length + 1}`
      );
    }
    return aliases.get(key);
  };
  const serializeCheck = <T>(
    result: DiagnosticCheck<T>,
    transform: (data: T) => unknown
  ): Record<string, unknown> =>
    result.status === 'ok'
      ? { status: 'ok', data: transform(result.data) }
      : {
          status: result.status,
          code: result.code && /^0x[0-9a-f]+$/i.test(result.code) ? result.code : undefined,
        };
  report.users.forEach(user => alias('User', user.user.userId));
  return {
    schemaVersion: 1,
    redacted: true,
    analyzedAt: report.context.timestamp,
    table: 'Table1',
    record: 'Record1',
    recordEvidence: serializeCheck(report.context.record, row => ({
      owner: alias(
        dataText(row, '_ownerid_value@Microsoft.Dynamics.CRM.lookuplogicalname') === 'team'
          ? 'Team'
          : 'User',
        dataText(row, '_ownerid_value')
      ),
      businessUnit: alias('BU', dataText(row, '_owningbusinessunit_value')),
    })),
    context: {
      metadata: report.context.metadata.status,
      record: report.context.record.status,
      sharing: report.context.shares.status,
      organization: report.context.organization.status,
      businessUnits: report.context.businessUnits.status,
    },
    users: report.users.map(user => ({
      user: alias('User', user.user.userId),
      summary: user.summary,
      reasons: user.reasons,
      account: serializeCheck(user.account, item => ({
        disabled: item.disabled,
        licensed: item.licensed,
        accessMode: item.accessMode,
        businessUnit: alias('BU', item.businessUnitId),
        manager: alias('User', item.managerId),
        position: alias('Position', item.positionId),
      })),
      rights: serializeCheck(user.rights, item =>
        item.filter(right => recordAccessOperations.some(op => op.right === right))
      ),
      rolesComplete: user.rolesComplete,
      roles: serializeCheck(user.roles, items =>
        items.map(role => ({
          role: alias('Role', role.id),
          team: alias('Team', role.teamId),
          businessUnit: alias('BU', role.businessUnitId),
          privilegesKnown: role.privilegesKnown !== false,
          depths: Object.fromEntries(
            recordAccessOperations.map(op => [
              op.key,
              role.privilegesKnown === false ? null : (role.depths[op.key] ?? 0),
            ])
          ),
        }))
      ),
      teams: serializeCheck(user.teams, items =>
        items.map(team => ({
          team: alias('Team', team.id),
          type: team.type,
          businessUnit: alias('BU', team.businessUnitId),
          linkedToRecord: team.regardingId === report.context.recordId,
        }))
      ),
      shares: serializeCheck(user.shares, items =>
        items.map(share => ({
          principal: alias(
            share.source === 'user' ? 'User' : share.source === 'team' ? 'Team' : 'Organization',
            share.principalId
          ),
          source: share.source,
          accessTeam: share.accessTeam,
          rights: share.rights.filter(right =>
            recordAccessOperations.some(op => op.right === right)
          ),
        }))
      ),
      hierarchy: serializeCheck(user.hierarchy, item => ({
        enabled: item.enabled,
        maxDepth: item.maxDepth,
        managerMatch: item.managerMatch,
        positionMatch: item.positionMatch,
        managerChain: item.managerChain.map(manager => ({
          user: alias('User', manager.id),
          businessUnit: alias('BU', manager.businessUnitId),
        })),
        positionChain: item.positionChain.map(position => alias('Position', position.id)),
      })),
    })),
  };
}

export async function downloadRedactedAccessReport(report: AccessDiagnosticReport): Promise<void> {
  const confirmation = await Xrm.Navigation.openConfirmDialog({
    title: accessT('export'),
    text: accessT('exportWarning'),
  });
  if (!confirmation.confirmed) {
    return;
  }
  const blob = new Blob([JSON.stringify(createRedactedAccessReport(report), null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'record-access-diagnosis-redacted.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
