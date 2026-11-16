import {
  collectRecordAccessReport,
  createAccessAnalysisApi,
  AccessAnalysisApi,
} from '#content/modules/record-access-analysis';
import {
  createAccessReportTables,
  createRedactedAccessReport,
  downloadRedactedAccessReport,
} from '#content/modules/record-access-report';

jest.mock('#content/modules/utils', () => ({
  DynamicsUtils: { getEntityCollectionName: () => 'accounts' },
}));
const userId = '11111111-1111-1111-1111-111111111111';
const otherId = '22222222-2222-2222-2222-222222222222';
const recordId = '33333333-3333-3333-3333-333333333333';
const orgId = '44444444-4444-4444-4444-444444444444';
const roleId = '55555555-5555-5555-5555-555555555555';
const teamId = '66666666-6666-6666-6666-666666666666';
const buId = '77777777-7777-7777-7777-777777777777';
const readPrivilege = '88888888-8888-8888-8888-888888888888';
const writePrivilege = '99999999-9999-9999-9999-999999999999';
const appendToPrivilege = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const user = { userId, userName: 'Confidential User' };
const originalDocument = global.document;
const originalFetch = global.fetch;
let language = 'en';
let api: AccessAnalysisApi;
let get: jest.Mock;
let list: jest.Mock;
const metadata = {
  EntitySetName: 'accounts',
  SchemaName: 'Account',
  OwnershipType: 'UserOwned',
  PrimaryIdAttribute: 'accountid',
  Privileges: [
    { PrivilegeId: readPrivilege, Name: 'prvReadAccount', PrivilegeType: 'Read' },
    { PrivilegeId: writePrivilege, Name: 'prvWriteAccount', PrivilegeType: 'Write' },
    { PrivilegeId: appendToPrivilege, Name: 'prvAppendToAccount', PrivilegeType: 'AppendTo' },
  ],
};
function defaultGet(path: string): Record<string, unknown> {
  if (path.startsWith('EntityDefinitions')) {
    return metadata;
  }
  if (path.startsWith('accounts(')) {
    return {
      _ownerid_value: otherId,
      '_ownerid_value@Microsoft.Dynamics.CRM.lookuplogicalname': 'systemuser',
      _owningbusinessunit_value: buId,
    };
  }
  if (path.includes('RetrievePrincipalAccess')) {
    return { AccessRights: 'ReadAccess, AppendToAccess' };
  }
  if (path.startsWith('RetrieveSharedPrincipalsAndAccess')) {
    return { PrincipalAccesses: [] };
  }
  if (path.startsWith('organizations')) {
    return { ishierarchicalsecuritymodelenabled: true, maxdepthforhierarchicalsecuritymodel: 2 };
  }
  if (path.startsWith('systemusers')) {
    return {
      fullname: 'Confidential User',
      isdisabled: false,
      islicensed: true,
      accessmode: 0,
      _businessunitid_value: buId,
    };
  }
  throw new Error('Unexpected GET ' + path);
}
function defaultList(path: string): Array<Record<string, unknown>> {
  if (path.startsWith('businessunits')) {
    return [{ businessunitid: buId, name: 'Confidential BU' }];
  }
  if (path.includes('teammembership_association')) {
    return [];
  }
  if (path.includes('systemuserroles_association')) {
    return [{ roleid: roleId, name: 'Confidential Role', _businessunitid_value: buId }];
  }
  if (path.startsWith('roleprivilegescollection')) {
    return [
      { privilegeid: readPrivilege, privilegedepthmask: 8 },
      { privilegeid: writePrivilege, privilegedepthmask: 1 },
      { privilegeid: appendToPrivilege, privilegedepthmask: 2 },
    ];
  }
  if (path.includes('teamroles_association')) {
    return [{ roleid: roleId, name: 'Confidential Role', _businessunitid_value: buId }];
  }
  throw new Error('Unexpected list ' + path);
}

beforeEach(() => {
  language = 'en';
  global.document = { documentElement: { getAttribute: () => language } } as unknown as Document;
  (global as unknown as { Xrm: unknown }).Xrm = {
    Utility: {
      getGlobalContext: () => ({
        getClientUrl: () => 'https://private.crm.dynamics.cn',
        organizationSettings: { organizationId: orgId },
      }),
    },
    Navigation: { openConfirmDialog: jest.fn(async () => ({ confirmed: false })) },
  };
  get = jest.fn(async (path: string) => defaultGet(path));
  list = jest.fn(async (path: string) => defaultList(path));
  api = { get, list };
});
afterAll(() => {
  global.document = originalDocument;
  global.fetch = originalFetch;
  delete (global as unknown as { Xrm?: unknown }).Xrm;
});

it('uses the selected user bound function and creates a metadata-based seven-operation role matrix', async () => {
  const report = await collectRecordAccessReport('account', recordId, [user], api);
  expect(get).toHaveBeenCalledWith(
    expect.stringContaining(
      `systemusers(${userId})/Microsoft.Dynamics.CRM.RetrievePrincipalAccess(Target=@p1)`
    )
  );
  expect(report.users[0].roles).toMatchObject({
    status: 'ok',
    data: [{ depths: { Read: 8, Write: 1, AppendTo: 2 } }],
  });
  language = 'zh-CN';
  const matrix = createAccessReportTables(report).find(table =>
    table.title.includes('角色权限矩阵')
  )!;
  expect(matrix.headers.slice(3)).toEqual([
    '读取',
    '写入',
    '删除',
    '追加',
    '追加到',
    '分配',
    '共享',
  ]);
  expect(matrix.rows[0]).toEqual([
    'Confidential Role',
    '用户直接分配角色',
    buId,
    '组织级',
    '用户级（个人）',
    '未授予',
    '未授予',
    '业务部门级',
    '未授予',
    '未授予',
  ]);
  expect(createAccessReportTables(report)[0].rows[0][1]).toBe('能读取该单据');
});

it('skips effective access for a disabled account but retains role evidence', async () => {
  get.mockImplementation(async (path: string) =>
    path.startsWith(`systemusers(${userId})?`)
      ? { ...defaultGet(path), isdisabled: true, islicensed: false }
      : defaultGet(path)
  );
  const report = await collectRecordAccessReport('account', recordId, [user], api);
  expect(report.users[0]).toMatchObject({
    summary: 'account-unavailable',
    rights: { status: 'skipped' },
    roles: { status: 'ok' },
    reasons: ['disabled', 'license'],
  });
  expect(get.mock.calls.some(([path]) => path.includes('RetrievePrincipalAccess'))).toBe(false);
});

it('does not treat an unlicensed noninteractive account as disabled or deny its returned rights', async () => {
  get.mockImplementation(async (path: string) =>
    path.startsWith(`systemusers(${userId})?`)
      ? { ...defaultGet(path), islicensed: false, accessmode: 4 }
      : defaultGet(path)
  );
  const report = await collectRecordAccessReport('account', recordId, [user], api);
  expect(report.users[0].summary).toBe('allowed');
  expect(report.users[0].reasons).not.toContain('license');
});

it('queries only documented team fields so team, role and sharing checks are not broken by an invalid select', async () => {
  const allowedFields = new Set([
    'teamid',
    'name',
    'teamtype',
    '_businessunitid_value',
    '_regardingobjectid_value',
  ]);
  list.mockImplementation(async (path: string) => {
    if (path.includes('teammembership_association')) {
      const selected = new URL(path, 'https://example.test/').searchParams
        .get('$select')!
        .split(',');
      if (selected.some(field => !allowedFields.has(field))) {
        throw new Error('Could not find a property on team');
      }
      return [{ teamid: teamId, name: 'Owner Team', teamtype: 0 }];
    }
    return defaultList(path);
  });
  const report = await collectRecordAccessReport('account', recordId, [user], api);
  expect(report.users[0]).toMatchObject({
    teams: { status: 'ok' },
    rolesComplete: true,
    shares: { status: 'ok' },
  });
});

it('accepts the inherited principal ownerid when matching a typed shared user', async () => {
  get.mockImplementation(async (path: string) =>
    path.startsWith('RetrieveSharedPrincipalsAndAccess')
      ? {
          PrincipalAccesses: [
            {
              Principal: { '@odata.type': '#Microsoft.Dynamics.CRM.systemuser', ownerid: userId },
              AccessMask: 'ReadAccess',
            },
          ],
        }
      : defaultGet(path)
  );
  const report = await collectRecordAccessReport('account', recordId, [user], api);
  expect(report.users[0].shares).toMatchObject({
    status: 'ok',
    data: [{ principalId: userId, source: 'user', rights: ['ReadAccess'] }],
  });
});

it('shows the original failed-check message locally but never includes it in the redacted export', async () => {
  const originalError = 'Could not find property exampleField on Microsoft.Dynamics.CRM.team';
  list.mockImplementation(async (path: string) => {
    if (path.includes('teammembership_association')) {
      throw new Error(originalError);
    }
    return defaultList(path);
  });
  const report = await collectRecordAccessReport('account', recordId, [user], api);
  language = 'zh-CN';
  const table = createAccessReportTables(report).find(item =>
    item.title.includes('团队成员关系 / 访问团队')
  )!;
  expect(table.rows[0][1]).toContain(originalError);
  const sharing = createAccessReportTables(report).find(item =>
    item.title.includes('匹配的共享关系')
  )!;
  expect(sharing.rows[0][1]).toContain('由于团队成员关系未能检查');
  expect(JSON.stringify(createRedactedAccessReport(report))).not.toContain(originalError);
});

it('preserves authoritative rights when sharing fails, marking that check unknown instead of absent', async () => {
  get.mockImplementation(async (path: string) => {
    if (path.startsWith('RetrieveSharedPrincipalsAndAccess')) {
      throw new Error('Sharing unavailable');
    }
    return defaultGet(path);
  });
  const report = await collectRecordAccessReport('account', recordId, [user], api);
  expect(report.users[0]).toMatchObject({
    summary: 'allowed',
    rights: { status: 'ok' },
    shares: { status: 'unavailable' },
  });
  expect(report.users[0].reasons).toContain('incomplete');
  language = 'zh-CN';
  const sharing = createAccessReportTables(report).find(table =>
    table.title.includes('匹配的共享关系')
  )!;
  expect(sharing.rows[0][0]).toBe('未能检查');
  expect(sharing.rows.flat()).not.toContain('未返回匹配的直接、团队或组织共享');
});

it('keeps a failed effective-rights request unknown and distinguishes it from confirmed denial', async () => {
  get.mockImplementation(async (path: string) => {
    if (path.includes('RetrievePrincipalAccess')) {
      throw new Error('403');
    }
    return defaultGet(path);
  });
  const unknown = await collectRecordAccessReport('account', recordId, [user], api);
  expect(unknown.users[0].summary).toBe('unknown');
  get.mockImplementation(async (path: string) =>
    path.includes('RetrievePrincipalAccess') ? { AccessRights: 'None' } : defaultGet(path)
  );
  list.mockImplementation(async (path: string) =>
    path.startsWith('roleprivilegescollection') ? [] : defaultList(path)
  );
  const denied = await collectRecordAccessReport('account', recordId, [user], api);
  expect(denied.users[0].summary).toBe('denied');
  expect(denied.users[0].reasons).toContain('missing-read-privilege');
});

it('retains direct roles when team membership fails and does not claim a complete privilege set', async () => {
  list.mockImplementation(async (path: string) => {
    if (path.includes('teammembership_association')) {
      throw new Error('Team lookup denied');
    }
    return path.startsWith('roleprivilegescollection') ? [] : defaultList(path);
  });
  get.mockImplementation(async (path: string) =>
    path.includes('RetrievePrincipalAccess') ? { AccessRights: 'None' } : defaultGet(path)
  );
  const report = await collectRecordAccessReport('account', recordId, [user], api);
  expect(report.users[0]).toMatchObject({
    summary: 'denied',
    rolesComplete: false,
    roles: { status: 'ok', data: [{ name: 'Confidential Role' }] },
  });
  expect(report.users[0].reasons).not.toContain('missing-read-privilege');
  expect(report.users[0].reasons).toContain('incomplete');
});

it('keeps successful role depths when another role privilege lookup fails', async () => {
  list.mockImplementation(async (path: string) => {
    if (path.includes('systemuserroles_association')) {
      return [...defaultList(path), { roleid: otherId, name: 'Second Role' }];
    }
    if (path.startsWith('roleprivilegescollection') && decodeURIComponent(path).includes(otherId)) {
      throw new Error('Role lookup unavailable');
    }
    return defaultList(path);
  });
  const report = await collectRecordAccessReport('account', recordId, [user], api);
  expect(report.users[0].roles).toMatchObject({
    status: 'ok',
    data: [
      { name: 'Confidential Role', privilegesKnown: true, depths: { Read: 8 } },
      { name: 'Second Role', privilegesKnown: false },
    ],
  });
  expect(report.users[0].rolesComplete).toBe(false);
  language = 'zh-CN';
  const matrix = createAccessReportTables(report).find(table =>
    table.title.includes('角色权限矩阵')
  )!;
  expect(matrix.rows[1].slice(3)).toEqual(Array(7).fill('未能检查'));
});

it('matches shared principal IDs exactly and shows an access team with its granted rights', async () => {
  list.mockImplementation(async (path: string) =>
    path.includes('teammembership_association')
      ? [
          {
            teamid: teamId,
            name: 'Confidential Access Team',
            teamtype: 1,
            _regardingobjectid_value: recordId,
          },
        ]
      : defaultList(path)
  );
  get.mockImplementation(async (path: string) =>
    path.startsWith('RetrieveSharedPrincipalsAndAccess')
      ? {
          PrincipalAccesses: [
            {
              Principal: { '@odata.type': '#Microsoft.Dynamics.CRM.team', teamid: teamId },
              AccessMask: 'ReadAccess',
            },
            {
              Principal: {
                '@odata.type': '#Microsoft.Dynamics.CRM.systemuser',
                systemuserid: otherId,
                fullname: userId,
              },
              AccessMask: 'WriteAccess',
            },
          ],
        }
      : defaultGet(path)
  );
  const report = await collectRecordAccessReport('account', recordId, [user], api);
  expect(report.users[0].shares).toMatchObject({
    status: 'ok',
    data: [{ principalId: teamId, accessTeam: true, rights: ['ReadAccess'], source: 'team' }],
  });
  if (report.users[0].shares.status === 'ok') {
    expect(report.users[0].shares.data).toHaveLength(1);
  }
});

it('preserves distinct direct and team assignments of the same role', async () => {
  list.mockImplementation(async (path: string) =>
    path.includes('teammembership_association')
      ? [{ teamid: teamId, name: 'Confidential Owner Team', teamtype: 0 }]
      : defaultList(path)
  );
  const report = await collectRecordAccessReport('account', recordId, [user], api);
  expect(report.users[0].roles).toMatchObject({
    status: 'ok',
    data: [
      { id: roleId, depths: { Read: 8 } },
      { id: roleId, teamId, depths: { Read: 8 } },
    ],
  });
  expect(
    list.mock.calls.filter(([path]) => path.startsWith('roleprivilegescollection'))
  ).toHaveLength(1);
});

it('reports a manager-chain match as evidence without overriding the server denial', async () => {
  get.mockImplementation(async (path: string) => {
    if (path.startsWith(`systemusers(${otherId})?`)) {
      return { ...defaultGet(path), _parentsystemuserid_value: userId };
    }
    if (path.includes('RetrievePrincipalAccess')) {
      return { AccessRights: 'None' };
    }
    return defaultGet(path);
  });
  const report = await collectRecordAccessReport('account', recordId, [user], api);
  expect(report.users[0].summary).toBe('denied');
  expect(report.users[0].hierarchy).toMatchObject({
    status: 'ok',
    data: { enabled: true, managerMatch: true },
  });
});

it('compares two users while retaining unknown checks and redacts identifiers, names, URLs and errors', async () => {
  get.mockImplementation(async (path: string) => {
    if (path.startsWith(`systemusers(${otherId})/Microsoft.Dynamics.CRM.RetrievePrincipalAccess`)) {
      throw new Error('Confidential User ' + otherId + ' private.crm.dynamics.cn');
    }
    return defaultGet(path);
  });
  const report = await collectRecordAccessReport(
    'account',
    recordId,
    [user, { userId: otherId, userName: 'Another Confidential User' }],
    api
  );
  language = 'zh-CN';
  const comparison = createAccessReportTables(report).find(table => table.title === '双用户对比')!;
  expect(comparison.rows[0].slice(0, 3)).toEqual(['读取', '有权限', '未能检查']);
  const exported = JSON.stringify(createRedactedAccessReport(report));
  for (const secret of [
    userId,
    otherId,
    recordId,
    roleId,
    buId,
    'Confidential',
    'private.crm.dynamics.cn',
  ]) {
    expect(exported).not.toContain(secret);
  }
  expect(JSON.parse(exported).table).toBe('Table1');
  expect(exported).toContain('ReadAccess');
  expect(exported).toContain('unknown');
  expect(JSON.parse(exported).users[0].user).toBe('User1');
  await downloadRedactedAccessReport(report);
  expect(Xrm.Navigation.openConfirmDialog).toHaveBeenCalled();
});

it('classifies the server disabled/license error as an account failure rather than record denial', async () => {
  global.fetch = jest.fn(async (url: string) => {
    const path = new URL(url).pathname.split('/api/data/v9.0/')[1] + new URL(url).search;
    if (path.includes('RetrievePrincipalAccess')) {
      return {
        ok: false,
        status: 403,
        json: async () => ({
          error: { code: '0x8004d24d', message: 'Disabled or unlicensed user ' + userId },
        }),
      };
    }
    return {
      ok: true,
      json: async () =>
        path.startsWith('businessunits') ||
        path.includes('_association') ||
        path.startsWith('roleprivilegescollection')
          ? { value: defaultList(path) }
          : defaultGet(path),
    };
  }) as unknown as typeof fetch;
  const report = await collectRecordAccessReport('account', recordId, [user]);
  expect(report.users[0]).toMatchObject({
    summary: 'account-unavailable',
    rights: { status: 'unavailable', code: '0x8004d24d' },
  });
  expect(JSON.stringify(createRedactedAccessReport(report))).not.toContain(userId);
});

it('follows collection pagination without using mutating requests and rejects foreign continuation links', async () => {
  global.fetch = jest.fn(async (url: string) => ({
    ok: true,
    json: async () =>
      url.includes('page=2')
        ? { value: [{ name: 'Second' }] }
        : {
            value: [{ name: 'First' }],
            '@odata.nextLink': 'https://private.crm.dynamics.cn/api/data/v9.0/roles?page=2',
          },
  })) as unknown as typeof fetch;
  expect(await createAccessAnalysisApi().list('roles')).toEqual([
    { name: 'First' },
    { name: 'Second' },
  ]);
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ value: [], '@odata.nextLink': 'https://other.test/private' }),
  })) as unknown as typeof fetch;
  await expect(createAccessAnalysisApi().list('roles')).rejects.toThrow(
    'Invalid diagnostic request destination'
  );
});
