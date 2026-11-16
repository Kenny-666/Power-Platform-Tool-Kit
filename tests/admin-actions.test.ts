import { AdminActions } from '#content/modules/admin-actions';
import { DynamicsUtils } from '#content/modules/utils';

const mockExecuteFetchXml = jest.fn();
jest.mock('#content/modules/webapi-client', () => ({
  WebApiClient: { getInstance: () => ({ executeFetchXml: mockExecuteFetchXml }) },
}));
jest.mock('#content/modules/utils', () => ({
  DynamicsUtils: { createMuiPopup: jest.fn(), getEntityCollectionName: () => 'accounts' },
}));
const userId = '11111111-1111-1111-1111-111111111111';
const recordId = '22222222-2222-2222-2222-222222222222';
const originalDocument = global.document;
let language = 'en';

describe('security result localization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    language = 'en';
    global.document = { documentElement: { getAttribute: () => language } } as unknown as Document;
    mockExecuteFetchXml.mockResolvedValue({ entities: [] });
  });
  afterAll(() => {
    global.document = originalDocument;
    delete (global as unknown as { Xrm?: unknown }).Xrm;
  });
  it.each(['users-to-roles', 'roles-to-users'] as const)(
    'localizes %s membership results and preserves selected names',
    async mode => {
      language = 'zh-CN';
      mockExecuteFetchXml.mockResolvedValue({
        entities:
          mode === 'users-to-roles'
            ? [
                {
                  systemuserid: userId,
                  fullname: 'Read',
                  'securityrole.roleid': recordId,
                  'securityrole.name': 'Sales Role',
                },
              ]
            : [{ roleid: recordId, name: 'Sales Role' }],
      });
      await AdminActions.getSecurityRoleMemberships(mode, [userId]);
      expect(DynamicsUtils.createMuiPopup).toHaveBeenLastCalledWith(
        expect.objectContaining({
          title: mode === 'users-to-roles' ? '用户查角色' : '角色查用户',
          tables: [
            expect.objectContaining(
              mode === 'users-to-roles'
                ? {
                    title: 'Read',
                    headers: ['安全角色', '角色 ID'],
                    rows: [['Sales Role', recordId]],
                    description: '直接分配的安全角色：1 个',
                  }
                : {
                    title: 'Sales Role',
                    headers: ['用户', '电子邮件', '用户 ID'],
                    rows: [['未直接分配用户', '', '']],
                    description: '直接分配的用户：0 个',
                  }
            ),
          ],
        })
      );
    }
  );

  it('localizes current user labels without changing the underlying returned user information', async () => {
    language = 'zh-CN';
    (global as unknown as { Xrm: unknown }).Xrm = {
      Utility: {
        getGlobalContext: () => ({
          userSettings: {
            userId,
            userName: 'Read',
            languageId: 2052,
            roles: { getLength: () => 1, get: () => ({ id: recordId, name: 'Sales Role' }) },
          },
        }),
      },
    };
    const result = await AdminActions.getCurrentUserInfo();
    expect(result.userName).toBe('Read');
    expect(DynamicsUtils.createMuiPopup).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '当前用户信息',
        tables: expect.arrayContaining([
          expect.objectContaining({
            title: '用户',
            rows: expect.arrayContaining([['名称', 'Read']]),
          }),
          expect.objectContaining({ title: '安全角色', rows: [['Sales Role', recordId]] }),
          expect.objectContaining({ title: '所属团队', rows: [['未找到所属团队', '']] }),
        ]),
      })
    );
  });
});
