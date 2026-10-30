import {
  constructClassicFormEditorUrl,
  constructOnPremisesFormEditorUrl,
  FormActions,
} from '#content/modules/form-actions';
import { WebApiClient } from '#content/modules/webapi-client';
import { DynamicsUtils } from '#content/modules/utils';

describe('FormActions', () => {
  beforeEach(() => {
    (global as any).document = {
      documentElement: { getAttribute: () => null },
    };
    const localStorage = { getItem: () => null };
    (global as any).window = {
      location: { hostname: 'crm.contoso.local' },
      localStorage,
    };
    (global as any).localStorage = localStorage;
  });

  it('uses the local editor when an on-premises client lacks isOnPremise', async () => {
    const openUrl = jest.fn();
    const getPreferredSolution = jest.fn();
    const formActions = new FormActions({ getPreferredSolution, getDefaultSolution: jest.fn() });
    const xrm = {
      Page: {
        data: { entity: { getEntityName: () => 'account' } },
        ui: { formSelector: { getCurrentItem: () => ({ getId: () => '{A1B2C3D4}' }) } },
      },
      Utility: {
        getGlobalContext: () => ({
          organizationSettings: { bapEnvironmentId: '59d9ff5f-616f-4db3-868c-653fb9cc0cf6' },
          getClientUrl: () => 'https://crm.contoso.local/org/',
        }),
      },
      Navigation: { openUrl },
    };

    (formActions as any).getXrm = () => xrm;

    await expect(formActions.openFormEditor()).resolves.toBe('Form editor opened for account');
    expect(openUrl).toHaveBeenCalledWith(
      'https://crm.contoso.local/org/main.aspx?etn=account&pagetype=formeditor&extraqs=formid%3D%7BA1B2C3D4%7D'
    );
    expect(getPreferredSolution).not.toHaveBeenCalled();
  });

  it('falls back to the Maker editor when opening the classic editor fails online', async () => {
    const openUrl = jest
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('Classic editor unavailable');
      })
      .mockImplementationOnce(() => undefined);
    const getPreferredSolution = jest.fn().mockResolvedValue({
      solutionid: 'solution-id',
      friendlyname: 'Preferred solution',
    });
    const formActions = new FormActions({ getPreferredSolution, getDefaultSolution: jest.fn() });
    const xrm = {
      Page: {
        data: { entity: { getEntityName: () => 'account' } },
        ui: { formSelector: { getCurrentItem: () => ({ getId: () => '{A1B2C3D4}' }) } },
      },
      Utility: {
        getGlobalContext: () => ({
          organizationSettings: { bapEnvironmentId: 'environment-id' },
          getClientUrl: () => 'https://org.crm.dynamics.com',
        }),
      },
      Navigation: { openUrl },
    };

    (formActions as any).getXrm = () => xrm;

    await expect(formActions.openFormEditor()).resolves.toContain('Preferred solution');
    expect(openUrl).toHaveBeenNthCalledWith(
      1,
      'https://org.crm.dynamics.com/main.aspx?pagetype=formeditor&appSolutionId={FD140AAF-4DF4-11DD-BD17-0019B9312238}&etn=account&extraqs=formtype=main&formId={A1B2C3D4}'
    );
    expect(openUrl).toHaveBeenNthCalledWith(
      2,
      'https://make.powerapps.com/e/environment-id/s/solution-id/entity/account/form/edit/{A1B2C3D4}'
    );
  });

  it('uses the Power Pane classic editor URL for online environments', () => {
    expect(
      constructClassicFormEditorUrl(
        'https://org.crm.dynamics.com/',
        'New_Sample_Application',
        '{A1B2C3D4-E5F6-7890-1234-56789ABCDEF0}'
      )
    ).toBe(
      'https://org.crm.dynamics.com/main.aspx?pagetype=formeditor&appSolutionId={FD140AAF-4DF4-11DD-BD17-0019B9312238}&etn=new_sample_application&extraqs=formtype=main&formId={A1B2C3D4-E5F6-7890-1234-56789ABCDEF0}'
    );
  });

  it('encodes the on-premises form editor parameters', () => {
    expect(
      constructOnPremisesFormEditorUrl(
        'https://crm.contoso.local/org/',
        'account',
        '{A1B2C3D4-E5F6-7890-1234-56789ABCDEF0}'
      )
    ).toBe(
      'https://crm.contoso.local/org/main.aspx?etn=account&pagetype=formeditor&extraqs=formid%3D%7BA1B2C3D4-E5F6-7890-1234-56789ABCDEF0%7D'
    );
  });

  it('focuses a field by its logical name', () => {
    const setFocus = jest.fn();
    const formActions = new FormActions({ getPreferredSolution: jest.fn(), getDefaultSolution: jest.fn() });
    (formActions as any).getXrm = () => ({
      Page: { getControl: (name: string) => (name === 'name' ? { setFocus } : null) },
    });

    expect(formActions.focusField({ fieldName: 'name' })).toBe('fieldFocused');
    expect(setFocus).toHaveBeenCalledTimes(1);
    expect(() => formActions.focusField({ fieldName: 'missing' })).toThrow('fieldNotFound');
  });

  it('populates required text and lookup fields after confirmation', async () => {
    const textAttribute = {
      getRequiredLevel: () => 'required',
      getValue: () => null,
      getAttributeType: () => 'string',
      getMaxLength: () => 100,
      setValue: jest.fn(),
    };
    const lookupAttribute = {
      getRequiredLevel: () => 'required',
      getValue: () => null,
      getAttributeType: () => 'lookup',
      getTargets: () => ['account'],
      getName: () => 'parentaccountid',
      setValue: jest.fn(),
    };
    const optionSetAttribute = {
      getRequiredLevel: () => 'required',
      getValue: () => null,
      getAttributeType: () => 'optionset',
      setValue: jest.fn(),
    };
    const retrieveMultiple = jest.fn().mockResolvedValue({
      value: [{ accountid: 'account-id', name: 'Contoso' }],
    });
    jest.spyOn(WebApiClient, 'getInstance').mockReturnValue({ retrieveMultiple } as any);
    const formActions = new FormActions({ getPreferredSolution: jest.fn(), getDefaultSolution: jest.fn() });
    (formActions as any).getXrm = () => ({
      Page: {
        ui: { getFormType: () => 1 },
        data: {
          entity: { attributes: { get: () => [textAttribute, lookupAttribute, optionSetAttribute] } },
        },
      },
      Utility: {
        getEntityMetadata: jest.fn().mockResolvedValue({
          PrimaryIdAttribute: 'accountid',
          PrimaryNameAttribute: 'name',
          EntitySetName: 'accounts',
        }),
      },
      Navigation: { openConfirmDialog: jest.fn().mockResolvedValue({ confirmed: true }) },
    });

    await expect(formActions.populateRequiredFields()).resolves.toBe('requiredFieldsPopulated');
    expect(textAttribute.setValue).toHaveBeenCalledWith('测试内容');
    expect(retrieveMultiple).toHaveBeenCalledWith('accounts', {
      select: ['accountid', 'name'],
      top: 1,
    });
    expect(lookupAttribute.setValue).toHaveBeenCalledWith([
      { id: 'account-id', name: 'Contoso', entityType: 'account' },
    ]);
    expect(optionSetAttribute.setValue).not.toHaveBeenCalled();

    jest.restoreAllMocks();
  });

  it('uses the lookup control entity types when the attribute has no targets', async () => {
    const lookupAttribute = {
      getRequiredLevel: () => 'required',
      getValue: () => null,
      getAttributeType: () => 'lookup',
      getName: () => 'ownerid',
      setValue: jest.fn(),
    };
    const retrieveMultiple = jest.fn().mockResolvedValue({
      value: [{ systemuserid: 'user-id', fullname: 'Test User' }],
    });
    jest.spyOn(WebApiClient, 'getInstance').mockReturnValue({ retrieveMultiple } as any);
    const formActions = new FormActions({ getPreferredSolution: jest.fn(), getDefaultSolution: jest.fn() });
    (formActions as any).getXrm = () => ({
      Page: {
        getControl: () => ({ getEntityTypes: () => ['systemuser'] }),
        ui: { getFormType: () => 1 },
        data: { entity: { attributes: { get: () => [lookupAttribute] } } },
      },
      Utility: {
        getEntityMetadata: jest.fn().mockResolvedValue({
          PrimaryIdAttribute: 'systemuserid',
          PrimaryNameAttribute: 'fullname',
          EntitySetName: 'systemusers',
        }),
      },
      Navigation: { openConfirmDialog: jest.fn().mockResolvedValue({ confirmed: true }) },
    });

    await expect(formActions.populateRequiredFields()).resolves.toBe('requiredFieldsPopulated');
    expect(lookupAttribute.setValue).toHaveBeenCalledWith([
      { id: 'user-id', name: 'Test User', entityType: 'systemuser' },
    ]);

    jest.restoreAllMocks();
  });

  it('shows option set display names alongside logical names', () => {
    const createPopup = jest.spyOn(DynamicsUtils, 'createMuiPopup').mockImplementation(jest.fn());
    const formActions = new FormActions({ getPreferredSolution: jest.fn(), getDefaultSolution: jest.fn() });
    (formActions as any).getXrm = () => ({
      Page: {
        getControl: () => [
          {
            getControlType: () => 'optionset',
            getName: () => 'statuscode',
            getLabel: () => 'Status Reason',
            getOptions: () => [{ text: 'Active', value: 1 }],
          },
        ],
      },
    });

    expect(formActions.showOptionSetValues()).toContain('1');
    expect(createPopup).toHaveBeenCalledWith(
      expect.objectContaining({
        tables: [
          expect.objectContaining({
            title: 'Status Reason (statuscode)',
            rows: [['Active', '1']],
          }),
        ],
      })
    );

    createPopup.mockRestore();
  });

  it('shows field display names and normalizes lookup response properties', async () => {
    const createPopup = jest.spyOn(DynamicsUtils, 'createMuiPopup').mockImplementation(jest.fn());
    const retrieveRecord = jest.fn().mockResolvedValue({
      accountid: 'account-id',
      name: 'Contoso',
      _createdby_value: 'user-id',
      _createdby_value_Formatted: 'Test User',
      _createdby_value_LogicalName: 'systemuser',
    });
    const getEntityMetadata = jest.fn().mockResolvedValue({
      Attributes: [
        {
          LogicalName: 'name',
          DisplayName: 'Account Name',
        },
        {
          LogicalName: 'createdby',
          DisplayName: 'Created By',
        },
      ],
    });
    jest.spyOn(WebApiClient, 'getInstance').mockReturnValue({ retrieveRecord } as any);
    const formActions = new FormActions({ getPreferredSolution: jest.fn(), getDefaultSolution: jest.fn() });
    (formActions as any).getXrm = () => ({
      Page: { data: { entity: { getEntityName: () => 'account', getId: () => '{record-id}' } } },
      Utility: { getEntityMetadata },
    });

    await expect(formActions.showAllFields()).resolves.toContain('3');
    expect(getEntityMetadata).toHaveBeenCalledWith(
      'account',
      expect.arrayContaining(['accountid', 'name', 'createdby'])
    );
    expect(createPopup).toHaveBeenCalledWith(
      expect.objectContaining({
        tables: [
          expect.objectContaining({
            headers: ['Display Name', 'Logical Name', 'Field Value'],
            rows: [
              ['accountid', 'accountid', 'account-id'],
              ['Created By', 'createdby', 'Test User'],
              ['Account Name', 'name', 'Contoso'],
            ],
          }),
        ],
      })
    );

    createPopup.mockRestore();
    jest.restoreAllMocks();
  });

  it('shows the raw Web API response for the current record', async () => {
    const createPopup = jest.spyOn(DynamicsUtils, 'createMuiPopup').mockImplementation(jest.fn());
    const retrieveRecord = jest.fn().mockResolvedValue({ name: 'Contoso' });
    jest.spyOn(WebApiClient, 'getInstance').mockReturnValue({ retrieveRecord } as any);
    const formActions = new FormActions({ getPreferredSolution: jest.fn(), getDefaultSolution: jest.fn() });
    (formActions as any).getXrm = () => ({
      Page: { data: { entity: { getEntityName: () => 'account', getId: () => '{record-id}' } } },
    });

    await expect(formActions.showRawJson()).resolves.toBe('rawJsonDisplayed');
    expect(retrieveRecord).toHaveBeenCalledWith('accounts', 'record-id');
    expect(createPopup).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'levelup-raw-json-popup' })
    );

    createPopup.mockRestore();
    jest.restoreAllMocks();
  });
});
