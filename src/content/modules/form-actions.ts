// Form actions module for Dynamics 365 forms

/// <reference types="xrm" />

import { DynamicsUtils } from './utils';
import { WebApiClient } from './webapi-client';
import { ConfettiEffects } from './confetti-effects';
import { OptionSetData, OptionSetControl, OptionSetOption } from '#types/global';
import { contentT } from './localization';
import { convertSqlToFetchXml } from './sql-to-fetchxml';

interface Solution {
  uniquename: string;
  friendlyname: string;
  solutionid: string;
  version: string;
  ismanaged: boolean;
}

interface ExtensionInstance {
  getPreferredSolution(): Promise<Solution | null>;
  getDefaultSolution(): Promise<Solution | null>;
}

interface WorkflowProcess {
  scope_Formatted: string;
  mode_Formatted: string;
  statecode_Formatted: string;
  statuscode_Formatted: string;
  workflowid: string;
  name: string;
  description?: string;
  category: number;
  type?: number;
  mode?: number;
  scope?: number;
  statecode: number;
  statuscode?: number;
  createdon?: string;
  modifiedon?: string;
  _ownerid_value?: string;
  _ownerid_value_Formatted: string;
}

interface CustomApiProcess {
  customapiid: string;
  uniquename: string;
  displayname?: string;
  description?: string;
  bindingtype: number;
  createdon?: string;
  modifiedon?: string;
  _ownerid_value?: string;
  _ownerid_value_Formatted?: string;
}

interface AttributeDisplayMetadata {
  LogicalName?: string;
  DisplayName?:
    | string
    | {
        UserLocalizedLabel?: { Label?: string } | null;
        LocalizedLabels?: Array<{ Label?: string }>;
      };
}

function getLogicalAttributeName(propertyName: string): string | null {
  if (
    propertyName.includes('@') ||
    propertyName.endsWith('_Formatted') ||
    propertyName.endsWith('_LogicalName')
  ) {
    return null;
  }

  const lookupValueMatch = /^_(.+)_value$/.exec(propertyName);
  return lookupValueMatch?.[1] ?? propertyName;
}

const DEFAULT_SOLUTION_ID = '{FD140AAF-4DF4-11DD-BD17-0019B9312238}';

export function constructOnPremisesFormEditorUrl(
  clientUrl: string,
  entityName: string,
  formId: string
): string {
  const editorParameters = new URLSearchParams({
    etn: entityName,
    pagetype: 'formeditor',
    extraqs: `formid=${formId}`,
  });

  return `${clientUrl.replace(/\/$/, '')}/main.aspx?${editorParameters.toString()}`;
}

export function constructClassicFormEditorUrl(
  clientUrl: string,
  entityName: string,
  formId: string
): string {
  return `${clientUrl.replace(/\/$/, '')}/main.aspx?pagetype=formeditor&appSolutionId=${DEFAULT_SOLUTION_ID}&etn=${entityName.toLowerCase()}&extraqs=formtype=main&formId=${formId}`;
}

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

export class FormActions {
  private extension: ExtensionInstance;

  constructor(extension: ExtensionInstance) {
    this.extension = extension;
  }

  /**
   * Get the Xrm object, handling both modern and classic mode
   */
  private getXrm(): typeof Xrm {
    if (DynamicsUtils.isFormContext()) {
      const w = this.getWindow();
      return w?.Xrm || window.Xrm;
    }

    return window.Xrm;
  }

  private getWindow() {
    const iframes = Array.from(document.querySelectorAll('iframe')).filter(function (d) {
      return d.style.visibility !== 'hidden';
    });
    if ((Xrm as unknown as XrmStatic & { Internal: { isUci(): boolean } }).Internal?.isUci()) {
      return window;
    } else if (iframes && iframes.length > 0) {
      return iframes[0].contentWindow || window;
    }
  }
  /**
   * Get user's preferred solution information or fall back to Default solution
   */
  private async getPreferredSolution(): Promise<{
    solutionId: string;
    solutionFriendlyName: string;
    usedDefaultSolution: boolean;
    notificationMessage?: string;
  }> {
    // Try to get the preferred solution using the centralized method
    const preferredSolution = await this.extension.getPreferredSolution();
    try {
      if (
        preferredSolution &&
        preferredSolution.friendlyname !== 'Common Data Services Default Solution'
      ) {
        return {
          solutionId: preferredSolution.solutionid,
          solutionFriendlyName: preferredSolution.friendlyname,
          usedDefaultSolution: false,
        };
      } else {
        throw new Error('No custom preferred solution found');
      }
    } catch (error) {
      // Fall back to Default solution using the centralized method
      try {
        const defaultSolution = await this.extension.getDefaultSolution();

        if (defaultSolution) {
          return {
            solutionId: defaultSolution.solutionid,
            solutionFriendlyName: defaultSolution.friendlyname,
            usedDefaultSolution: true,
            notificationMessage: `No custom preferred solution found. Using ${preferredSolution?.friendlyname ?? defaultSolution.friendlyname}. You can set your preferred solution in Power Platform Maker Portal.`,
          };
        }
      } catch (defaultError) {
        // Ultimate fallback with hardcoded Default solution ID
        // Both preferred and default solution lookup failed, using hardcoded Default solution ID
      }

      // Ultimate fallback with hardcoded Default solution ID
      return {
        solutionId: 'fd140aaf-4df4-11dd-bd17-0019b9312238',
        solutionFriendlyName: 'Default Solution',
        usedDefaultSolution: true,
        notificationMessage:
          'No custom preferred solution found. Using Default solution. You can set your preferred solution in Power Platform Maker Portal.',
      };
    }
  }

  /**
   * Show logical names for fields, tabs, and sections
   */
  showLogicalNames(): string {
    // Display logical names for fields, tabs, and sections
    // First, clear any existing logical names to prevent duplicates
    this.clearLogicalNames();

    const xrm = this.getXrm();
    const w = this.getWindow();
    const attributes = xrm.Page.data.entity.attributes.get();
    let processedCount = 0;

    attributes.forEach((attr: Xrm.Attributes.Attribute) => {
      try {
        const logicalName = attr.getName();
        // Use default click handler that shows visual feedback
        DynamicsUtils.addClickHandlerToLogicalName(w, logicalName);
        processedCount++;
      } catch (_error) {
        // Skip fields that cause errors (e.g., virtual fields, calculated fields)
      }
    });

    return contentT('logicalNamesShown', { count: processedCount });
  }

  /**
   * Clear logical names and restore original labels
   */
  clearLogicalNames(): string {
    const w = this.getWindow();
    w?.document.querySelectorAll('.levelup-logical-name').forEach(x => x.remove());
    return contentT('logicalNamesCleared');
  }

  async showEntityInfo(): Promise<string> {
    const xrm = this.getXrm();
    const logicalName = xrm.Page.data.entity.getEntityName();
    const metadataUtility = xrm.Utility as typeof xrm.Utility & {
      getEntityMetadata?: (entityName: string) => Promise<{
        ObjectTypeCode?: number;
        EntitySetName?: string;
        DisplayName?: { UserLocalizedLabel?: { Label?: string } };
      }>;
    };

    const metadata = await metadataUtility.getEntityMetadata?.(logicalName);
    const displayName = metadata?.DisplayName?.UserLocalizedLabel?.Label ?? logicalName;
    DynamicsUtils.createMuiPopup({
      id: 'levelup-entity-info-popup',
      title: 'Entity Information',
      tables: [
        {
          title: displayName,
          headers: ['Property', 'Value'],
          rows: [
            ['Logical Name', logicalName],
            ['Entity Set Name', metadata?.EntitySetName ?? DynamicsUtils.getEntityCollectionName(logicalName)],
            ['Object Type Code', String(metadata?.ObjectTypeCode ?? 'Unavailable')],
          ],
        },
      ],
    });
    return `Entity information displayed for ${logicalName}`;
  }

  showFieldValue(data: { fieldName?: string }): string {
    const fieldName = data?.fieldName?.trim();
    if (!fieldName) {
      throw new Error('A field logical name is required');
    }

    const attribute = this.getXrm().Page.getAttribute(fieldName);
    if (!attribute) {
      return contentT('fieldNotFound', { fieldName });
    }

    const value = attribute.getValue();
    const textAttribute = attribute as Xrm.Attributes.Attribute & { getText?: () => string | null };
    let displayValue: string;
    if (value === null || value === undefined) {
      displayValue = '[NULL]';
    } else if (attribute.getAttributeType() === 'lookup' && Array.isArray(value)) {
      displayValue = (value as Xrm.LookupValue[])
        .map(lookup => `${lookup.name ?? '(unnamed)'} (${lookup.entityType}: ${lookup.id})`)
        .join(', ');
    } else {
      displayValue = textAttribute.getText?.() ?? (typeof value === 'string' ? value : JSON.stringify(value));
    }

    DynamicsUtils.createMuiPopup({
      id: 'levelup-field-value-popup',
      title: 'Field Value',
      tables: [
        {
          title: fieldName,
          headers: ['Property', 'Value'],
          rows: [
            ['Logical Name', fieldName],
            ['Type', attribute.getAttributeType()],
            ['Value', displayValue],
          ],
        },
      ],
    });
    return `Field value displayed for ${fieldName}`;
  }

  enableLabelCopy(): string {
    const xrm = this.getXrm();
    const contentWindow = this.getWindow();
    let boundCount = 0;

    xrm.Page.data.entity.attributes.get().forEach(attribute => {
      const logicalName = attribute.getName();
      const label = document.querySelector(`label[id$="${logicalName}-field-label"]`) as HTMLElement | null
        ?? contentWindow?.document.querySelector(`#${logicalName}_c`) as HTMLElement | null;
      if (!label || label.dataset.levelupCopyLogicalName === 'true') {
        return;
      }

      label.dataset.levelupCopyLogicalName = 'true';
      label.style.cursor = 'copy';
      label.title = `Click to copy ${logicalName}`;
      label.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        void navigator.clipboard.writeText(logicalName).then(
          () => DynamicsUtils.showToast(`Copied ${logicalName}`, 'success'),
          () => DynamicsUtils.showToast(`Unable to copy ${logicalName}`, 'error')
        );
      });
      boundCount++;
    });

    return `Enabled logical-name copying on ${boundCount} field label(s)`;
  }

  clearFieldNotifications(): string {
    let clearedCount = 0;
    this.getXrm().Page.ui.controls.forEach(control => {
      const notificationControl = control as Xrm.Controls.Control & {
        clearNotification?: (uniqueId?: string) => boolean;
      };
      if (notificationControl.clearNotification) {
        notificationControl.clearNotification();
        clearedCount++;
      }
    });
    return `Cleared notifications from ${clearedCount} field control(s)`;
  }

  refreshRibbon(): string {
    const ui = this.getXrm().Page.ui as typeof Xrm.Page.ui & { refreshRibbon?: () => void };
    if (!ui.refreshRibbon) {
      throw new Error('Ribbon refresh is not available on this page');
    }
    ui.refreshRibbon();
    return 'Ribbon refreshed';
  }

  toggleLookupLinks(): string {
    const documentRef = this.getWindow()?.document ?? document;
    const existingLinks = documentRef.querySelectorAll('.levelup-lookup-link');
    if (existingLinks.length > 0) {
      existingLinks.forEach(link => link.remove());
      return 'Lookup links removed';
    }

    const xrm = this.getXrm();
    let addedCount = 0;
    xrm.Page.ui.controls.forEach(control => {
      const lookupControl = control as Xrm.Controls.LookupControl;
      if (lookupControl.getControlType?.() !== 'lookup') {
        return;
      }

      const controlName = lookupControl.getName();
      const host = documentRef.querySelector(
        `[data-id^="${controlName}.fieldControl"], #${controlName}`
      ) as HTMLElement | null;
      if (!host || host.querySelector('.levelup-lookup-link')) {
        return;
      }

      const link = documentRef.createElement('button');
      link.type = 'button';
      link.className = 'levelup-lookup-link';
      link.title = `Open ${controlName} in a new window`;
      link.setAttribute('aria-label', link.title);
      link.textContent = '↗';
      Object.assign(link.style, {
        marginLeft: '4px',
        border: '0',
        background: 'transparent',
        color: 'inherit',
        cursor: 'pointer',
        fontSize: '16px',
        lineHeight: '1',
      });
      link.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        const lookup = lookupControl.getAttribute()?.getValue()?.[0];
        if (!lookup) {
          DynamicsUtils.showToast(`No value is selected for ${controlName}`, 'info');
          return;
        }
        const clientUrl = xrm.Utility.getGlobalContext().getClientUrl().replace(/\/$/, '');
        const recordUrl = `${clientUrl}/main.aspx?etn=${encodeURIComponent(lookup.entityType)}&id=${encodeURIComponent(lookup.id.replace(/[{}]/g, ''))}&pagetype=entityrecord`;
        const recordWindow = (this.getWindow() ?? window).open(recordUrl, '_blank');
        if (recordWindow) {
          recordWindow.opener = null;
        } else {
          DynamicsUtils.showToast('The browser blocked the record window', 'error');
        }
      });
      host.append(link);
      addedCount++;
    });

    return `Added lookup links to ${addedCount} field(s)`;
  }

  async executeFetchXml(
    data: { fetchXml?: string; resultLabel?: string }
  ): Promise<string> {
    const fetchXml = data?.fetchXml?.trim();
    const resultLabel = data?.resultLabel ?? 'FetchXML';
    if (!fetchXml) {
      throw new Error('FetchXML is required');
    }

    const documentElement = new DOMParser().parseFromString(fetchXml, 'application/xml').documentElement;
    if (documentElement.nodeName === 'parsererror' || documentElement.nodeName !== 'fetch') {
      throw new Error('FetchXML must contain a valid <fetch> root element');
    }
    const entityName = documentElement.querySelector('entity')?.getAttribute('name');
    if (!entityName) {
      throw new Error('FetchXML must contain an entity name');
    }

    const result = await WebApiClient.getInstance().executeFetchXml(
      DynamicsUtils.getEntityCollectionName(entityName),
      fetchXml
    );
    const entities = (result.entities ?? []) as Array<Record<string, unknown>>;
    const headers = Array.from(new Set(entities.flatMap(entity => Object.keys(entity).filter(key => !key.includes('@')))));
    const rows = entities.slice(0, 100).map(entity =>
      headers.map(header => {
        const value = entity[header];
        return value === null || value === undefined
          ? ''
          : typeof value === 'object'
            ? JSON.stringify(value)
            : String(value);
      })
    );

    DynamicsUtils.createMuiPopup({
      id: 'levelup-fetchxml-results-popup',
      title: `${resultLabel} Results (${result.totalCount})`,
      tables: [
        {
          title: entityName,
          headers: headers.length > 0 ? headers : ['Result'],
          rows: rows.length > 0 ? rows : [['No records returned']],
          description: entities.length > 100 ? 'Showing the first 100 returned records.' : undefined,
        },
      ],
      enableSearch: true,
      showOpenInNewTab: true,
    });
    return `${resultLabel} returned ${result.totalCount} record(s)`;
  }

  async executeSqlQuery(data: { sql?: string }): Promise<string> {
    const sql = data?.sql?.trim();
    if (!sql) {
      throw new Error('SQL query is required');
    }

    const { fetchXml } = convertSqlToFetchXml(sql);
    return this.executeFetchXml({ fetchXml, resultLabel: 'SQL Query' });
  }

  /**v
   * Enable "God Mode" - make all fields visible and editable
   */
  enableGodMode(): string {
    let unlockCount = 0;

    // Create the confetti burst effect first
    ConfettiEffects.createConfettiBurst();

    const xrm = this.getXrm();

    // Make all mandatory fields optional
    const attributes = xrm.Page.data.entity.attributes.get();
    attributes.forEach((attr: Xrm.Attributes.Attribute) => {
      if (attr.getRequiredLevel() === 'required') {
        attr.setRequiredLevel('none');
        unlockCount++;
      }
    });

    // Make all controls visible and enabled
    xrm.Page.ui.controls.forEach((control: Xrm.Controls.Control) => {
      // Cast to StandardControl to access setVisible and setDisabled
      const standardControl = control as Xrm.Controls.StandardControl;
      const wasHidden = standardControl.getVisible && !standardControl.getVisible();
      const wasDisabled = standardControl.getDisabled && standardControl.getDisabled();

      if (standardControl.setVisible) {
        standardControl.setVisible(true);
      }
      if (standardControl.setDisabled) {
        standardControl.setDisabled(false);
      }

      if (wasHidden || wasDisabled) {
        unlockCount++;
      }
    });

    // Make all tabs and sections visible
    xrm.Page.ui.tabs.forEach((tab: Xrm.Controls.Tab) => {
      const wasTabHidden = !tab.getVisible();
      tab.setVisible(true);

      if (wasTabHidden) {
        unlockCount++;
      }

      tab.sections.forEach((section: Xrm.Controls.Section) => {
        const wasSectionHidden = !section.getVisible();
        section.setVisible(true);

        if (wasSectionHidden) {
          unlockCount++;
        }
      });
    });

    return contentT('elementsUnlocked', { count: unlockCount });
  }

  /**
   * Highlight changed fields on the form
   */
  highlightChangedFields(): string {
    // Remove existing highlights
    DynamicsUtils.removeStyles('levelup-changed-fields');

    const xrm = this.getXrm();
    const changedFields: string[] = [];

    try {
      // Get the data XML which contains only changed fields
      const dataXml = xrm.Page.data.entity.getDataXml();

      if (dataXml) {
        // Parse the XML to extract field names
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(dataXml, 'text/xml');

        // Get the root element (entity name)
        const rootElement = xmlDoc.documentElement;

        if (rootElement) {
          // Get all child elements (these are the changed fields)
          const fieldElements = rootElement.children;

          for (let i = 0; i < fieldElements.length; i++) {
            const fieldName = fieldElements[i].tagName;
            changedFields.push(fieldName);
          }
        }
      }
    } catch (_error) {
      // If XML parsing fails, fall back to the attribute-level change detection
      DynamicsUtils.showToast('Unable to parse data XML, falling back to attribute checks', 'info');
      // Fallback to the old method if XML parsing fails
      const attributes = xrm.Page.data.entity.attributes.get();
      attributes.forEach((attr: Xrm.Attributes.Attribute) => {
        if (attr.getIsDirty && attr.getIsDirty()) {
          changedFields.push(attr.getName());
        }
      });
    }

    if (changedFields.length > 0) {
      // Create individual styles for each field to avoid selector conflicts
      const styles = changedFields
        .map(field => {
          return `
                #${field}_c, [data-id="${field}"] {
                    position: relative !important;
                    border-left: 4px solid #742774 !important;
                    background: linear-gradient(90deg, rgba(116, 39, 116, 0.05) 0%, transparent 100%) !important;
                    box-shadow: 0 0 0 1px rgba(116, 39, 116, 0.2) !important;
                    border-radius: 4px !important;
                    transition: all 0.2s ease !important;
                }

                #${field}_c:hover, [data-id="${field}"]:hover {
                    box-shadow: 0 0 0 1px rgba(116, 39, 116, 0.4) !important;
                    background: linear-gradient(90deg, rgba(116, 39, 116, 0.08) 0%, transparent 100%) !important;
                }

                #${field}_c::before, [data-id="${field}"]::before {
                    content: '●' !important;
                    position: absolute !important;
                    top: 8px !important;
                    right: 8px !important;
                    color: #742774 !important;
                    font-size: 8px !important;
                    opacity: 0.7 !important;
                    pointer-events: none !important;
                    z-index: 1000 !important;
                }`;
        })
        .join('\n');

      DynamicsUtils.addStyles('levelup-changed-fields', styles);
    }

    return contentT('changedFieldsHighlighted', { count: changedFields.length });
  }

  /**
   * Get current record URL
   */
  getRecordUrl(): string {
    const xrm = this.getXrm();
    const entityName = xrm.Page.data.entity.getEntityName();
    const recordId = xrm.Page.data.entity.getId().replace(/[{}]/g, '');
    const orgUrl = DynamicsUtils.getOrganizationUrl();

    const recordUrl = `${orgUrl}/main.aspx?etn=${entityName}&id=${recordId}&pagetype=entityrecord`;

    // Show in a text dialog with copy functionality
    DynamicsUtils.showTextDialog('Record URL', recordUrl);
    return recordUrl;
  }

  /**
   * Get current record ID
   */
  getRecordId(): string {
    const xrm = this.getXrm();
    const recordId = xrm.Page.data.entity.getId().replace(/[{}]/g, '');
    DynamicsUtils.showTextDialog('Record ID', recordId);
    return recordId;
  }

  /**
   * Open current record in Web API
   */
  openWebApiRecord(): string {
    const xrm = this.getXrm();
    const entityName = xrm.Page.data.entity.getEntityName();
    const recordId = xrm.Page.data.entity.getId().replace(/[{}]/g, '');
    const orgUrl = DynamicsUtils.getOrganizationUrl();

    const webApiUrl = `${orgUrl}/api/data/v9.0/${DynamicsUtils.getEntityCollectionName(entityName)}(${recordId})`;
    Xrm.Navigation.openUrl(webApiUrl);

    return contentT('webApiOpened');
  }

  /**
   * Refresh all subgrids on the form
   */
  refreshAllSubgrids(): string {
    const xrm = this.getXrm();
    let refreshedCount = 0;
    xrm.Page.ui.controls.forEach((control: Xrm.Controls.Control) => {
      if (control.getControlType && control.getControlType() === 'subgrid') {
        const subgridControl = control as Xrm.Controls.GridControl;
        if (subgridControl.refresh) {
          subgridControl.refresh();
          refreshedCount++;
        }
      }
    });

    return contentT('subgridsRefreshed', { count: refreshedCount });
  }

  /**
   * Show option set values in a popup table with enhanced performance for large datasets
   */
  showOptionSetValues(): string {
    const xrm = this.getXrm();
    // Get all optionset controls and their options
    const optionsetData: OptionSetData[] = xrm.Page.getControl()
      .filter((x: Xrm.Controls.Control) => x.getControlType() === 'optionset')
      .map((x: Xrm.Controls.Control) => {
        const optionsetControl = x as OptionSetControl;
        const name = optionsetControl.getName();
        return {
          name,
          displayName: optionsetControl.getLabel?.() || name,
          options: optionsetControl.getOptions(),
        };
      });

    if (optionsetData.length === 0) {
      return contentT('noOptionSets');
    }

    // Create separate tables for each optionset
    const tables = optionsetData.map(control => {
      const rows = control.options
        ? control.options.map((option: OptionSetOption) => [
            option.text || 'N/A',
            option.value === null ||
            option.value === undefined ||
            Number.isNaN(option.value) ||
            String(option.value) === 'NaN'
              ? '-'
              : String(option.value),
          ])
        : [];

      return {
        title: `${control.displayName} (${control.name})`,
        description: `${rows.length} option(s) available`,
        headers: ['OptionSet Name', 'OptionSet Value'],
        rows: rows,
      };
    });

    // Use dual-pane layout for multiple optionsets (> 1)
    const layoutMode = optionsetData.length > 1 ? 'dual-pane' : 'standard';

    // Show popup with dual-pane layout for better navigation
    DynamicsUtils.createMuiPopup({
      id: 'levelup-optionset-popup',
      title: `OptionSet Values (${optionsetData.length} controls)`,
      tables: tables,
      layoutMode: layoutMode,
      showOpenInNewTab: true,
    });

    return contentT('optionSetsFound', { count: optionsetData.length });
  }

  /**
   * Clone current record
   */
  async cloneRecord(): Promise<string> {
    const xrm = this.getXrm();
    const entityName = xrm.Page.data.entity.getEntityName();

    // Get all field values to pass as parameters
    const parameters: Record<string, string> = {};
    const attributes = xrm.Page.data.entity.attributes
      .get()
      .filter(
        a =>
          a.getName() !== 'createdon' &&
          a.getName() !== 'modifiedon' &&
          a.getName() !== 'createdby' &&
          a.getName() !== 'modifiedby' &&
          a.getName() !== 'ownerid'
      );

    attributes.forEach((attr: Xrm.Attributes.Attribute) => {
      const value = attr.getValue();
      if (value) {
        const attributeName = attr.getName();
        if (attr.getAttributeType() === 'lookup' && Array.isArray(value) && value.length > 0) {
          const lookupValue = value as Xrm.LookupValue[];
          parameters[attributeName] = lookupValue[0].id;
          parameters[`${attributeName}name`] = lookupValue[0].name ?? '';
          parameters[`${attributeName}type`] = lookupValue[0].entityType;
        } else {
          parameters[attributeName] = String(value);
        }
      }
    });
    await Xrm.Navigation.openForm({ entityName: entityName, openInNewWindow: true }, parameters);

    return contentT('recordCloned');
  }

  /**
   * Refresh form without saving and disable auto-save
   */
  async refreshWithoutSave(): Promise<string> {
    const xrm = this.getXrm();
    // Remove any existing changed field highlights
    DynamicsUtils.removeStyles('levelup-changed-fields');

    await xrm.Page.data.refresh(false);
    xrm.Page.data.entity.addOnSave((econtext: Xrm.Events.SaveEventContext) => {
      const eventArgs = econtext.getEventArgs();
      if (eventArgs.getSaveMode() === 70 || eventArgs.getSaveMode() === 2) {
        eventArgs.preventDefault();
      }
    });
    Xrm.Navigation.openAlertDialog({
      title: 'Information',
      text: 'Form refreshed without save. Autosave turned off.',
    });
    return contentT('formRefreshed');
  }

  /**
   * Show all field logical names with their current values in a popup table
   */
  async showAllFields(): Promise<string> {
    const xrm = this.getXrm();
    try {
      const entityLogicalName = xrm.Page.data.entity.getEntityName();
      const recordId = xrm.Page.data.entity.getId().replace(/[{}]/g, '');
      const collection = DynamicsUtils.getEntityCollectionName(entityLogicalName);
      const webApiClient = WebApiClient.getInstance();

      // Retrieve full record with annotations to get formatted values
      const record = await webApiClient.retrieveRecord(collection, recordId);
      const displayNames = new Map<string, string>();
      const attributeNames = [
        ...new Set(
          Object.keys(record)
            .map(getLogicalAttributeName)
            .filter((name): name is string => Boolean(name))
        ),
      ];

      try {
        const metadata = await xrm.Utility.getEntityMetadata(entityLogicalName, attributeNames);
        const attributeCollection = metadata.Attributes as unknown;
        const attributes = Array.isArray(attributeCollection)
          ? (attributeCollection as AttributeDisplayMetadata[])
          : (attributeCollection as { get?: () => AttributeDisplayMetadata[] })?.get?.() ?? [];
        attributes.forEach(attribute => {
          const logicalName = attribute.LogicalName;
          const metadataDisplayName = attribute.DisplayName;
          const displayName =
            typeof metadataDisplayName === 'string'
              ? metadataDisplayName
              : metadataDisplayName?.UserLocalizedLabel?.Label ??
                metadataDisplayName?.LocalizedLabels?.[0]?.Label;
          if (logicalName && displayName) {
            displayNames.set(logicalName, displayName);
          }
        });
      } catch {
        // Field values remain available when metadata cannot be retrieved.
      }

      const rows: string[][] = [];
      const processedFields = new Set<string>();

      // Simply iterate through all record properties
      Object.keys(record).forEach(key => {
        try {
          const logicalName = getLogicalAttributeName(key);
          if (!logicalName || processedFields.has(logicalName)) {
            return;
          }

          processedFields.add(logicalName);
          const recordValues = record as unknown as Record<string, unknown>;
          const value = recordValues[`${key}_Formatted`] ?? recordValues[key];
          let displayValue = '';

          if (value === null || value === undefined) {
            displayValue = '[NULL]';
          } else if (value === '') {
            displayValue = '[EMPTY STRING]';
          } else if (value instanceof Date) {
            // Handle Date objects
            displayValue = value.toISOString();
          } else if (typeof value === 'object') {
            // Handle other objects but avoid double quotes for simple values
            if (Array.isArray(value)) {
              displayValue = value.length === 0 ? '[empty array]' : value.join(', ');
            } else {
              // For objects, check if it's a simple value wrapped in quotes
              const stringified = JSON.stringify(value);
              // If it's a quoted string, remove the outer quotes
              if (
                stringified.startsWith('"') &&
                stringified.endsWith('"') &&
                stringified.length > 2
              ) {
                displayValue = stringified.slice(1, -1); // Remove outer quotes
              } else {
                displayValue = stringified;
              }
            }
          } else if (typeof value === 'string') {
            // If it's already a string, don't add extra quotes
            displayValue = value;
          } else {
            displayValue = String(value);
          }

          // Add all fields regardless of value
          rows.push([
            displayNames.get(logicalName) ?? logicalName,
            logicalName,
            displayValue,
          ]);
        } catch {
          const logicalName = getLogicalAttributeName(key) ?? key;
          rows.push([logicalName, logicalName, '[Error reading value]']);
        }
      });

      // Sort rows by logical name (case-insensitive) for predictable ordering
      rows.sort((a, b) => a[1].localeCompare(b[1], undefined, { sensitivity: 'base' }));

      DynamicsUtils.createMuiPopup({
        id: 'levelup-all-fields-popup',
        title: `All Fields (${rows.length})`,
        tables: [
          {
            title: 'Field Values (Web API)',
            headers: ['Display Name', 'Logical Name', 'Field Value'],
            description: `${rows.length} field(s) returned via Web API for ${entityLogicalName}`,
            rows,
          },
        ],
        layoutMode: 'standard',
        enableSearch: true,
        showOpenInNewTab: true,
      });

      return contentT('fieldsDisplayed', { count: rows.length });
    } catch (error) {
      DynamicsUtils.showToast('Error retrieving fields via Web API', 'error');
      return contentT('fieldsRetrieveFailed');
    }
  }

  /**
   * Set focus on a form control by its logical name.
   */
  focusField(data: { fieldName?: string }): string {
    const fieldName = data?.fieldName?.trim();
    if (!fieldName) {
      throw new Error(contentT('requiredFieldName'));
    }

    const control = this.getXrm().Page.getControl(fieldName) as Xrm.Controls.StandardControl | null;
    if (!control || typeof control.setFocus !== 'function') {
      throw new Error(contentT('fieldNotFound', { fieldName }));
    }

    control.setFocus();
    return contentT('fieldFocused', { fieldName });
  }

  private async populateLookupAttribute(
    attribute: Xrm.Attributes.LookupAttribute,
    xrm: typeof Xrm
  ): Promise<boolean> {
    const lookupAttribute = attribute as Xrm.Attributes.LookupAttribute & {
      getTargets?: () => string[];
    };
    const lookupControl = xrm.Page.getControl?.(attribute.getName()) as
      | (Xrm.Controls.LookupControl & { getEntityTypes?: () => string[] })
      | undefined;
    const targets = lookupAttribute.getTargets?.() ?? lookupControl?.getEntityTypes?.() ?? [];
    const orderedTargets = [
      ...targets.filter(target => target === 'systemuser'),
      ...targets.filter(target => target !== 'systemuser'),
    ];

    for (const target of orderedTargets) {
      try {
        const metadata = await xrm.Utility.getEntityMetadata(target);
        const primaryId = metadata.PrimaryIdAttribute;
        const primaryName = metadata.PrimaryNameAttribute;
        const collection = metadata.EntitySetName || DynamicsUtils.getEntityCollectionName(target);
        const response = await WebApiClient.getInstance().retrieveMultiple(collection, {
          select: [primaryId, primaryName],
          top: 1,
        });
        const record = (response.value ?? response.entities ?? [])[0] as
          | Record<string, unknown>
          | undefined;
        const id = record?.[primaryId] as string | undefined;
        if (!id) {
          continue;
        }

        attribute.setValue([
          {
            id,
            name: (record?.[primaryName] as string | undefined) ?? id,
            entityType: target,
          },
        ]);
        return true;
      } catch (error) {
        console.warn(`Unable to populate lookup field ${attribute.getName()} for ${target}:`, error);
      }
    }

    return false;
  }

  /**
   * Populate empty required text and lookup fields on a new record.
   */
  async populateRequiredFields(): Promise<string> {
    const xrm = this.getXrm();
    if (xrm.Page.ui.getFormType() !== 1) {
      throw new Error(contentT('populateRequiredFieldsNewOnly'));
    }

    const confirmation = await xrm.Navigation.openConfirmDialog({
      title: contentT('populateRequiredFieldsTitle'),
      text: contentT('populateRequiredFieldsConfirmation'),
      confirmButtonLabel: contentT('populateRequiredFieldsConfirm'),
      cancelButtonLabel: contentT('cancel'),
    });
    if (!confirmation.confirmed) {
      return contentT('populateRequiredFieldsCancelled');
    }

    let populatedCount = 0;
    for (const attribute of xrm.Page.data.entity.attributes.get()) {
      if (attribute.getRequiredLevel() !== 'required' || attribute.getValue() !== null) {
        continue;
      }

      switch (attribute.getAttributeType()) {
        case 'memo':
        case 'string': {
          const maxLength = (attribute as Xrm.Attributes.StringAttribute).getMaxLength();
          attribute.setValue('测试内容'.slice(0, maxLength));
          populatedCount++;
          break;
        }
        case 'lookup':
          if (await this.populateLookupAttribute(attribute as Xrm.Attributes.LookupAttribute, xrm)) {
            populatedCount++;
          }
          break;
      }
    }

    return contentT('requiredFieldsPopulated', { count: populatedCount });
  }

  /**
   * Display raw Web API JSON for the current record.
   */
  async showRawJson(): Promise<string> {
    const xrm = this.getXrm();
    try {
      const entityLogicalName = xrm.Page.data.entity.getEntityName();
      const recordId = xrm.Page.data.entity.getId().replace(/[{}]/g, '');
      const collection = DynamicsUtils.getEntityCollectionName(entityLogicalName);
      const record = await WebApiClient.getInstance().retrieveRecord(collection, recordId);
      const json = JSON.stringify(record, null, 2);

      DynamicsUtils.createMuiPopup({
        id: 'levelup-raw-json-popup',
        title: contentT('rawJsonTitle'),
        tables: [
          {
            title: entityLogicalName,
            headers: ['JSON'],
            rows: [[json]],
          },
        ],
        layoutMode: 'standard',
        showOpenInNewTab: true,
      });

      return contentT('rawJsonDisplayed');
    } catch (error) {
      throw new Error(
        contentT('rawJsonRetrieveFailed', {
          error: error instanceof Error ? error.message : contentT('unknownError'),
        })
      );
    }
  }

  /**
   * Open the form editor for the current record.
   */
  async openFormEditor(): Promise<string> {
    const xrm = this.getXrm();
    const entityName = xrm.Page.data.entity.getEntityName();
    const formId = xrm.Page.ui.formSelector.getCurrentItem().getId();
    const globalContext = xrm.Utility.getGlobalContext();

    try {
      const classicEditorUrl = isOnPremises(globalContext)
        ? constructOnPremisesFormEditorUrl(globalContext.getClientUrl(), entityName, formId)
        : constructClassicFormEditorUrl(globalContext.getClientUrl(), entityName, formId);

      xrm.Navigation.openUrl(classicEditorUrl);
      return `Form editor opened for ${entityName}`;
    } catch (classicEditorError) {
      if (isOnPremises(globalContext)) {
        const errorMessage =
          classicEditorError instanceof Error ? classicEditorError.message : 'Unknown error occurred';
        DynamicsUtils.showToast(`Failed to open form editor: ${errorMessage}`, 'error');
        throw new Error(`Failed to open form editor: ${errorMessage}`);
      }

      try {
        const environmentId = globalContext.organizationSettings.bapEnvironmentId;
        const solutionInfo = await this.getPreferredSolution();

        if (solutionInfo.usedDefaultSolution && solutionInfo.notificationMessage) {
          DynamicsUtils.showToast(solutionInfo.notificationMessage, 'info');
        }

        const makerEditorUrl = `https://make.powerapps.com/e/${environmentId}/s/${solutionInfo.solutionId}/entity/${entityName}/form/edit/${formId}`;
        xrm.Navigation.openUrl(makerEditorUrl);

        let successMessage = `Form editor opened for ${entityName} in solution: ${solutionInfo.solutionFriendlyName}`;
        if (solutionInfo.usedDefaultSolution && solutionInfo.notificationMessage) {
          successMessage += ` (${solutionInfo.notificationMessage})`;
        }

        return successMessage;
      } catch (makerEditorError) {
        const errorMessage =
          makerEditorError instanceof Error ? makerEditorError.message : 'Unknown error occurred';
        DynamicsUtils.showToast(`Failed to open form editor: ${errorMessage}`, 'error');
        throw new Error(`Failed to open form editor: ${errorMessage}`);
      }
    }
  }

  /**
   * Show table processes (workflows, business rules, BPFs, custom APIs, actions) in a dual-pane dialog
   */
  async showTableProcesses(): Promise<string> {
    const xrm = this.getXrm();
    try {
      const webApiClient = WebApiClient.getInstance();
      const entityName = xrm.Page.data.entity.getEntityName();
      const globalContext = Xrm.Utility.getGlobalContext();
      const environmentId = globalContext.organizationSettings.bapEnvironmentId;
      const onPremises = isOnPremises(globalContext);

      // Get solution information using the reusable method
      const solutionInfo = await this.getPreferredSolution();

      // Fetch all workflows for this entity in one call
      const workflowsResponse = await webApiClient.retrieveMultiple('workflows', {
        filter: `primaryentity eq '${entityName}' and statecode eq 1`,
        select: [
          'workflowid',
          'name',
          'description',
          'category',
          'type',
          'mode',
          'scope',
          'statecode',
          'statuscode',
          'createdon',
          'modifiedon',
          '_ownerid_value',
        ],
        orderBy: ['name asc'],
      });

      // Fetch custom APIs separately since they're in a different entity
      const customApisResponse = await webApiClient.retrieveMultiple('customapis', {
        filter: `bindingtype eq 1 and boundentitylogicalname eq '${entityName}'`,
        select: [
          'customapiid',
          'uniquename',
          'displayname',
          'description',
          'bindingtype',
          'createdon',
          'modifiedon',
          '_ownerid_value',
        ],
        orderBy: ['uniquename asc'],
      });

      const allWorkflows = workflowsResponse.value || [];
      const allCustomApis = customApisResponse.value || [];

      // Define process type configurations with their respective URL patterns
      const processTypes = [
        {
          title: 'Realtime Workflows',
          filter: (w: WorkflowProcess) => w.category === 0 && w.type === 1 && w.mode === 1,
          urlType: 'classicworkflow', // Uses classic Dynamics URL
        },
        {
          title: 'Background Workflows',
          filter: (w: WorkflowProcess) => w.category === 0 && w.type === 1 && w.mode === 0,
          urlType: 'classicworkflow', // Uses classic Dynamics URLv
        },
        {
          title: 'Flows',
          filter: (w: WorkflowProcess) => w.category === 5 && w.type === 1,
          urlType: 'flow', // Modern flows use Power Automate portal
        },
        {
          title: 'Business Rules',
          filter: (w: WorkflowProcess) => w.category === 2,
          urlType: 'businessrule',
        },
        {
          title: 'Business Process Flows',
          filter: (w: WorkflowProcess) => w.category === 4,
          urlType: 'classicworkflow', // Uses classic Dynamics URL
        },
        {
          title: 'Actions',
          filter: (w: WorkflowProcess) => w.category === 3,
          urlType: 'classicworkflow', // Uses classic Dynamics URL
        },
      ];

      const tables = [];
      let totalProcesses = 0;

      // Create tables for workflow-based processes
      processTypes.forEach(processType => {
        const processes = allWorkflows.filter(processType.filter);
        totalProcesses += processes.length;

        const rows = processes.map((process: WorkflowProcess) => {
          const name = process.name || 'N/A';
          const description = process.description || 'No description';

          // Generate the correct URL based on process type
          let makerUrl: string;
          const orgUrl = DynamicsUtils.getOrganizationUrl();

          if (processType.urlType === 'flow' && !onPremises) {
            // Modern flows use the Power Automate portal in online environments.
            makerUrl = `https://make.powerautomate.com/environments/${environmentId}/solutions/${solutionInfo.solutionId}/flows/${process.workflowid}/details?utm_source=levelup_extension`;
          } else if (processType.urlType === 'businessrule') {
            // Business rules use classic Dynamics URL
            makerUrl = `${orgUrl}/tools/systemcustomization/businessrules/businessRulesDesigner.aspx?BRlaunchpoint=BRGrid&appSolutionId=%7B${solutionInfo.solutionId}%7D&id=%7B${process.workflowid}%7D`;
          } else {
            // Workflows and Actions use classic Dynamics URL
            makerUrl = `${orgUrl}/sfa/workflow/edit.aspx?appSolutionId=%7b${solutionInfo.solutionId}%7d&id=%7b${process.workflowid}%7d`;
          }

          const nameWithLink = `<a href="${makerUrl}" target="_blank" style="color: #2563eb; text-decoration: none; font-weight: 500;">${name}</a>`;

          // Format status based on process type
          let status = '';
          if (
            processType.title === 'Realtime Workflows' ||
            processType.title === 'Background Workflows'
          ) {
            status = process.statecode_Formatted;
          } else if (processType.title === 'Business Rules') {
            status = `${process.statecode_Formatted} (${process.scope_Formatted})`;
          } else {
            status = process.statuscode_Formatted;
          }

          const owner = process._ownerid_value_Formatted || 'N/A';

          return [nameWithLink, description, status, owner];
        });

        tables.push({
          title: processType.title,
          description: `${processes.length} ${processType.title.toLowerCase()} found`,
          headers: ['Name', 'Description', 'Status', 'Owner'],
          rows,
          allowHtmlInColumns: [0], // Allow HTML in the Name column
        });
      });

      // Add Custom APIs table
      totalProcesses += allCustomApis.length;
      const customApiRows = await Promise.all(
        allCustomApis.map(async (api: CustomApiProcess) => {
          const name = api.uniquename || api.displayname || 'N/A';
          const description = api.description || 'No description';

          // Custom APIs use classic Dynamics URL pattern
          const orgUrl = DynamicsUtils.getOrganizationUrl();
          const appProperties = await Xrm.Utility.getGlobalContext().getCurrentAppProperties();
          const makerUrl = `${orgUrl}/main.aspx?appid=${appProperties.appId}&forceUCI=1&newWindow=true&pagetype=entityrecord&etn=customapi&id=${api.customapiid}`;
          const nameWithLink = `<a href="${makerUrl}" target="_blank" style="color: #2563eb; text-decoration: none; font-weight: 500;">${name}</a>`;

          const status = `Active (${api.bindingtype === 1 ? 'Entity' : 'Global'})`;
          const owner = api._ownerid_value_Formatted || 'N/A';

          return [nameWithLink, description, status, owner];
        })
      );

      tables.push({
        title: 'Custom APIs',
        description: `${allCustomApis.length} custom apis found`,
        headers: ['Name', 'Description', 'Status', 'Owner'],
        rows: customApiRows,
        allowHtmlInColumns: [0], // Allow HTML in the Name column
      });

      // If no processes were found at all, show a friendly alert and return
      if (totalProcesses === 0) {
        Xrm.Navigation.openAlertDialog({
          title: 'No processes found',
          text: `No workflows, business rules, flows, BPFs, actions, or custom APIs were found for ${entityName}.`,
        });

        return `No processes associated with ${entityName}`;
      }

      // Use dual-pane layout for better navigation
      DynamicsUtils.createMuiPopup({
        id: 'levelup-table-processes-popup',
        title: `Table Processes for ${entityName} (${totalProcesses} total)`,
        tables,
        layoutMode: 'dual-pane',
        showOpenInNewTab: true,
        enableSearch: true,
      });

      return `Found ${totalProcesses} processes across ${tables.length} categories for ${entityName}. Click any process name to open in Power Apps maker portal (${solutionInfo.solutionFriendlyName}).`;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      DynamicsUtils.showToast(`Failed to load table processes: ${errorMessage}`, 'error');
      throw new Error(`Failed to load table processes: ${errorMessage}`);
    }
  }
}
