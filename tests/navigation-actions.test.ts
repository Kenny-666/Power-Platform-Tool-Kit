import { NavigationActions } from '#content/modules/navigation-actions';
import { DynamicsUtils } from '#content/modules/utils';

describe('NavigationActions on-premises URLs', () => {
  const openPage = jest.spyOn(DynamicsUtils, 'openPage').mockImplementation(() => 'opened');

  beforeEach(() => {
    (global as any).document = {
      documentElement: { getAttribute: () => null },
    };
    (global as any).Xrm = {
      Utility: {
        getGlobalContext: () => ({
          organizationSettings: { bapEnvironmentId: undefined },
          getClientUrl: () => 'https://crm.contoso.local/org/',
        }),
      },
    };
  });

  afterEach(() => {
    openPage.mockClear();
  });

  afterAll(() => {
    openPage.mockRestore();
  });

  it('uses local Dynamics routes instead of Power Platform routes', () => {
    NavigationActions.openSecurity();
    NavigationActions.openSystemJobs();
    NavigationActions.openSolutions();
    NavigationActions.openSolutionsHistory();

    expect(openPage).toHaveBeenNthCalledWith(
      1,
      { entityName: 'role', pageType: 'entitylist' },
      expect.any(String)
    );
    expect(openPage).toHaveBeenNthCalledWith(
      2,
      { entityName: 'asyncoperation', pageType: 'entitylist' },
      expect.any(String)
    );
    expect(openPage).toHaveBeenNthCalledWith(
      3,
      { url: 'https://crm.contoso.local/org/tools/Solution/home_solution.aspx?etc=7100' },
      expect.any(String)
    );
    expect(openPage).toHaveBeenNthCalledWith(
      4,
      {
        url: 'https://crm.contoso.local/org/main.aspx?pagetype=entitylist&etn=msdyn_solutionhistory',
      },
      expect.any(String)
    );
  });

  it('uses entity lists and the classic solution manager for online environments', () => {
    (global as any).Xrm.Utility.getGlobalContext = () => ({
      organizationSettings: {
        organizationId: 'organization-id',
        bapEnvironmentId: '59d9ff5f-616f-4db3-868c-653fb9cc0cf6',
      },
      getClientUrl: () => 'https://contoso.crm.dynamics.com/',
    });

    NavigationActions.openSecurity();
    NavigationActions.openSystemJobs();
    NavigationActions.openSolutions();

    expect(openPage).toHaveBeenNthCalledWith(
      1,
      { entityName: 'role', pageType: 'entitylist' },
      expect.any(String)
    );
    expect(openPage).toHaveBeenNthCalledWith(
      2,
      { entityName: 'asyncoperation', pageType: 'entitylist' },
      expect.any(String)
    );
    expect(openPage).toHaveBeenNthCalledWith(
      3,
      { url: 'https://contoso.crm.dynamics.com/tools/Solution/home_solution.aspx?etc=7100' },
      expect.any(String)
    );
  });

  it('falls back to the Maker portal when classic online solution navigation throws', () => {
    (global as any).Xrm.Utility.getGlobalContext = () => ({
      organizationSettings: {
        organizationId: 'organization-id',
        bapEnvironmentId: '59d9ff5f-616f-4db3-868c-653fb9cc0cf6',
      },
      getClientUrl: () => 'https://contoso.crm.dynamics.com/',
    });
    openPage
      .mockImplementationOnce(() => {
        throw new Error('Classic solutions unavailable');
      })
      .mockImplementationOnce(() => 'opened');

    NavigationActions.openSolutions();

    expect(openPage).toHaveBeenNthCalledWith(
      2,
      {
        url: 'https://make.powerapps.com/environments/59d9ff5f-616f-4db3-868c-653fb9cc0cf6/solutions',
      },
      expect.any(String)
    );
  });

  it('uses local routes when an on-premises host has a BAP environment ID', () => {
    (global as any).Xrm.Utility.getGlobalContext = () => ({
      organizationSettings: {
        organizationId: 'organization-id',
        bapEnvironmentId: '59d9ff5f-616f-4db3-868c-653fb9cc0cf6',
      },
      getClientUrl: () => 'https://crm.contoso.local/org/',
    });

    NavigationActions.openSecurity();
    NavigationActions.openSolutions();
    NavigationActions.openSolutionsHistory();

    expect(openPage).toHaveBeenNthCalledWith(
      1,
      { entityName: 'role', pageType: 'entitylist' },
      expect.any(String)
    );
    expect(openPage).toHaveBeenNthCalledWith(
      2,
      { url: 'https://crm.contoso.local/org/tools/Solution/home_solution.aspx?etc=7100' },
      expect.any(String)
    );
    expect(openPage).toHaveBeenNthCalledWith(
      3,
      {
        url: 'https://crm.contoso.local/org/main.aspx?pagetype=entitylist&etn=msdyn_solutionhistory',
      },
      expect.any(String)
    );
  });

  it('opens toolkit navigation additions through Dynamics routes', () => {
    NavigationActions.openPluginTraceLogs();
    NavigationActions.openEnvironmentVariables();
    NavigationActions.openImportSolution();

    expect(openPage).toHaveBeenNthCalledWith(
      1,
      { entityName: 'plugintracelog', pageType: 'entitylist' },
      expect.any(String)
    );
    expect(openPage).toHaveBeenNthCalledWith(
      2,
      { entityName: 'environmentvariabledefinition', pageType: 'entitylist' },
      expect.any(String)
    );
    expect(openPage).toHaveBeenNthCalledWith(
      3,
      { url: 'https://crm.contoso.local/org/tools/solution/import/SolutionImportWizard.aspx' },
      expect.any(String)
    );
  });
});
