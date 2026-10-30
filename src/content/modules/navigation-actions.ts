// Navigation actions module for Dynamics 365

/// <reference types="xrm" />

import { DynamicsUtils } from './utils';
import { EntityMetadata, EntityMetadataCache } from '#types/global';
import { contentT } from './localization';

function isOnPremises(globalContext: Xrm.GlobalContext): boolean {
  const onPremisesIndicator = (
    globalContext as Xrm.GlobalContext & {
      isOnPremise?: unknown;
    }
  ).isOnPremise;

  if (typeof onPremisesIndicator === 'function') {
    return Boolean(onPremisesIndicator.call(globalContext));
  }

  if (typeof onPremisesIndicator === 'boolean') {
    return onPremisesIndicator;
  }

  try {
    const hostname = new URL(globalContext.getClientUrl()).hostname.toLowerCase();
    const onlineDomainSuffixes = [
      '.dynamics.com',
      '.dynamics.cn',
      '.microsoftdynamics.us',
      '.appsplatform.us',
    ];

    return !onlineDomainSuffixes.some(suffix => hostname.endsWith(suffix));
  } catch {
    return !globalContext.organizationSettings.bapEnvironmentId;
  }
}

function getOnPremisesUrl(globalContext: Xrm.GlobalContext, path: string): string {
  return `${globalContext.getClientUrl().replace(/\/$/, '')}${path}`;
}


export class NavigationActions {
  /**
   * Get entity metadata from cache for icon determination
   */
  private static getEntityMetadata(entityLogicalName: string): EntityMetadata | null {
    try {
      const globalContext = Xrm.Utility.getGlobalContext();
      const clientUrl = globalContext.getClientUrl();
      const url = new URL(clientUrl);
      const hostname = url.hostname.toLowerCase();
      const cacheKey = `levelup_entity_metadata_${hostname}`;

      const cached = localStorage.getItem(cacheKey);
      if (!cached) {
        return null;
      }

      const parsed = JSON.parse(cached) as EntityMetadataCache;
      if (parsed && parsed.entities && parsed.timestamp) {
        return (
          parsed.entities.find(
            entity => entity.LogicalName?.toLowerCase() === entityLogicalName?.toLowerCase()
          ) || null
        );
      }
    } catch (error) {
      // Silently handle cache errors to avoid breaking navigation actions
    }
    return null;
  }

  /**
   * Get appropriate icon URL for entity
   */
  private static getEntityIconUrl(entityLogicalName: string): string | null {
    const entityMetadata = this.getEntityMetadata(entityLogicalName);

    if (entityMetadata) {
      const globalContext = Xrm.Utility.getGlobalContext();
      const clientUrl = globalContext.getClientUrl();

      // If IconSmallName is not null, use it
      if (entityMetadata.IconSmallName) {
        return `${clientUrl}/Webresources/${entityMetadata.IconSmallName}`;
      }
      // If IconSmallName is null, use ObjectTypeCode
      if (entityMetadata.ObjectTypeCode) {
        return `${clientUrl}/_imgs/svg_${entityMetadata.ObjectTypeCode}.svg`;
      }
    }

    // Fallback to default icon
    return null;
  }

  /**
   * Open a record by entity name and ID
   */
  static openRecordById(data: { entityName: string; recordId: string }): string {
    const { entityName, recordId } = data;
    if (!entityName || !recordId) {
      throw new Error(contentT('requiredEntityAndRecord'));
    }

    return DynamicsUtils.openPage(
      {
        entityName,
        pageType: 'entityrecord',
        parameters: { id: recordId },
      },
      contentT('recordOpened', { entity: entityName, recordId })
    );
  }

  /**
   * Create a new record for specified entity
   */
  static createNewRecord(data: { entityName: string }): string {
    const { entityName } = data;
    if (!entityName) {
      throw new Error(contentT('requiredEntity'));
    }

    return DynamicsUtils.openPage(
      {
        entityName,
        pageType: 'entityrecord',
      },
      contentT('recordWindowOpened', { entity: entityName })
    );
  }

  /**
   * Open entity list view
   */
  static openEntityList(data: { entityName: string }): string {
    const { entityName } = data;
    if (!entityName) {
      throw new Error(contentT('requiredEntity'));
    }

    return DynamicsUtils.openPage(
      {
        entityName,
        pageType: 'entitylist',
      },
      contentT('listOpened', { entity: entityName })
    );
  }

  /**
   * Open Security area
   */
  static openSecurity(): string {
    return DynamicsUtils.openPage(
      {
        entityName: 'role',
        pageType: 'entitylist',
      },
      contentT('securityOpened')
    );
  }

  /**
   * Open System Jobs
   */
  static openSystemJobs(): string {
    return DynamicsUtils.openPage(
      {
        entityName: 'asyncoperation',
        pageType: 'entitylist',
      },
      contentT('systemJobsOpened')
    );
  }

  /**
   * Open Solutions
   */
  static openSolutions(): string {
    const globalContext = Xrm.Utility.getGlobalContext();
    const classicUrl = getOnPremisesUrl(
      globalContext,
      '/tools/Solution/home_solution.aspx?etc=7100'
    );

    try {
      return DynamicsUtils.openPage({ url: classicUrl }, contentT('solutionsOpened'));
    } catch (classicNavigationError) {
      if (isOnPremises(globalContext)) {
        throw classicNavigationError;
      }

      const fallbackUrl = `https://make.powerapps.com/environments/${globalContext.organizationSettings.bapEnvironmentId}/solutions`;
      return DynamicsUtils.openPage({ url: fallbackUrl }, contentT('solutionsOpened'));
    }
  }

  /**
   * Open Processes
   */
  static openProcesses(): string {
    return DynamicsUtils.openPage(
      {
        entityName: 'workflow',
        pageType: 'entitylist',
      },
      contentT('processesOpened')
    );
  }

  /**
   * Open Mailboxes
   */
  static openMailboxes(): string {
    return DynamicsUtils.openPage(
      {
        entityName: 'mailbox',
        pageType: 'entitylist',
      },
      contentT('mailboxesOpened')
    );
  }

  /**
   * Open main Dynamics 365 page
   */
  static openMain(): string {
    return DynamicsUtils.openPage({}, contentT('mainPageOpened'));
  }

  /**
   * Open Advanced Find
   */
  static openAdvancedFind(): string {
    return DynamicsUtils.openPage(
      {
        pageType: 'advancedfind',
      },
      contentT('advancedFindOpened')
    );
  }

  /**
   * Open Mobile Client (MoCA)
   */
  static openMobileClient(): string {
    const orgUrl = DynamicsUtils.getOrganizationUrl();
    const globalContext = Xrm.Utility.getGlobalContext();
    return DynamicsUtils.openPage(
      {
        url: `${orgUrl}/nga/main.htm?org=${globalContext.organizationSettings.uniqueName}&server=${globalContext.getClientUrl()}`,
      },
      contentT('mobileClientOpened')
    );
  }

  /**
   * Open Power Platform Admin Center for current environment
   */
  static openPowerPlatformAdmin(): string {
    try {
      const orgSettings = Xrm.Utility.getGlobalContext().organizationSettings;

      // Use bapEnvironmentId if available, otherwise fall back to generic admin center
      if (orgSettings && orgSettings.bapEnvironmentId) {
        return DynamicsUtils.openPage(
          {
            url: `https://admin.powerplatform.microsoft.com/environments/environment/${orgSettings.bapEnvironmentId}/hub`,
          },
          contentT('adminCenterCurrentOpened')
        );
      } else {
        return DynamicsUtils.openPage(
          {
            url: 'https://admin.powerplatform.microsoft.com',
          },
          contentT('adminCenterOpened')
        );
      }
    } catch (error) {
      return DynamicsUtils.openPage(
        {
          url: 'https://admin.powerplatform.microsoft.com',
        },
        contentT('adminCenterOpened')
      );
    }
  }

  /**
   * Pin current view or record to side panel
   */
  static async pinToSidePanel(): Promise<string> {
    try {
      const pageInput = Xrm.Utility.getPageContext().input;
      const entityName = pageInput.entityName;

      // Get appropriate icon for the entity
      const iconUrl = this.getEntityIconUrl(entityName);
      const paneSettings: { canClose: boolean; imageSrc?: string } = {
        canClose: true,
        ...(iconUrl && { imageSrc: iconUrl }),
      };

      const pane = await Xrm.App.sidePanes.createPane(paneSettings);
      if (pageInput.pageType === 'entityrecord') {
        pane.navigate({
          pageType: pageInput.pageType,
          entityName: pageInput.entityName,
          entityId: pageInput.entityId,
        });
      } else {
        pane.navigate({
          pageType: pageInput.pageType,
          entityName: pageInput.entityName,
        });
      }

      return contentT('pagePinned');
    } catch (error) {
      throw new Error(
        contentT('pinFailed', { error: error instanceof Error ? error.message : contentT('unknownError') })
      );
    }
  }

  /**
   * Open Plugin Trace Logs
   */
  static openPluginTraceLogs(): string {
    return DynamicsUtils.openPage(
      {
        entityName: 'plugintracelog',
        pageType: 'entitylist',
      },
      contentT('pluginTraceLogsOpened')
    );
  }

  /**
   * Open Environment Variables
   */
  static openEnvironmentVariables(): string {
    return DynamicsUtils.openPage(
      {
        entityName: 'environmentvariabledefinition',
        pageType: 'entitylist',
      },
      contentT('environmentVariablesOpened')
    );
  }

  /**
   * Open the classic solution import wizard.
   */
  static openImportSolution(): string {
    const globalContext = Xrm.Utility.getGlobalContext();
    const url = getOnPremisesUrl(globalContext, '/tools/solution/import/SolutionImportWizard.aspx');

    return DynamicsUtils.openPage({ url }, contentT('importSolutionOpened'));
  }

  /**
   * Open Solutions History
   */
  static openSolutionsHistory(): string {
    const globalContext = Xrm.Utility.getGlobalContext();
    const url = getOnPremisesUrl(
      globalContext,
      '/main.aspx?pagetype=entitylist&etn=msdyn_solutionhistory'
    );

    return DynamicsUtils.openPage({ url }, contentT('solutionsHistoryOpened'));
  }
}
