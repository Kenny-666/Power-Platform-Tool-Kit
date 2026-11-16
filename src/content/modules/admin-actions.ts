// Admin actions module for Dynamics 365 administration

/// <reference types="xrm" />

import { WebApiClient } from './webapi-client';
import { DynamicsUtils } from './utils';

interface ImpersonationUser {
  systemuserid: string;
  azureactivedirectoryobjectid: string;
  fullname: string;
  internalemailaddress: string;
  domainname: string;
}

interface SearchResult {
  users: ImpersonationUser[];
  hasMoreResults: boolean;
  totalResultsMessage?: string;
}

interface SecurityRole {
  roleid: string;
  name: string;
  businessUnitName?: string;
}

interface SecurityRoleMembership {
  userId: string;
  userName: string;
  userEmail: string;
  roleId: string;
  roleName: string;
}

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const validateIds = (ids: string[]): string[] => {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new Error('Select at least one user or security role.');
  }

  if (ids.length > 100 || ids.some(id => !GUID_PATTERN.test(id))) {
    throw new Error('The selected user or security role identifiers are invalid.');
  }

  return ids;
};

// Global variable to store current impersonation
let currentImpersonationUser: ImpersonationUser | null = null;

export class AdminActions {
  /**
   * Get environment information
   */
  static getEnvironmentInfo(): Record<string, unknown> {
    try {
      const globalContext = Xrm.Utility.getGlobalContext();
      const organizationSettings = globalContext.organizationSettings;
      const version = globalContext.getVersion();

      const envInfo = {
        organizationGeo: organizationSettings.organizationGeo,
        organizationId: organizationSettings.organizationId,
        uniqueName: organizationSettings.uniqueName,
        version: version,
        clientUrl: globalContext.getClientUrl(),
        currentUserId: globalContext.userSettings.userId,
        currentUserName: globalContext.userSettings.userName,
        organizationLanguageId: organizationSettings.languageId,
        isOnPremise: globalContext.isOnPremise,
        webResourceUrl: globalContext.getWebResourceUrl(''),
      };

      return envInfo;
    } catch (error) {
      throw new Error(
        `Failed to get environment information: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get current user information
   */
  static async getCurrentUserInfo(): Promise<Record<string, unknown>> {
    try {
      const globalContext = Xrm.Utility.getGlobalContext();
      const userSettings = globalContext.userSettings;
      const roles = userSettings.roles as
        | Xrm.Collection.ItemCollection<Xrm.LookupValue>
        | undefined;
      const securityRoles = Array.from({ length: roles?.getLength() ?? 0 }, (_, index) => {
        const role = roles?.get(index);
        return { id: role?.id ?? '', name: role?.name ?? '' };
      }).filter(role => role.name);

      let teams: Array<{ id: string; name: string }> = [];
      let teamsError: string | undefined;
      try {
        const userId = userSettings.userId.replace(/[{}]/g, '');
        const result = await WebApiClient.getInstance().executeFetchXml(
          'teams',
          `<fetch><entity name="team"><attribute name="teamid" /><attribute name="name" /><link-entity name="teammembership" from="teamid" to="teamid" intersect="true"><filter><condition attribute="systemuserid" operator="eq" value="${userId}" /></filter></link-entity></entity></fetch>`
        );
        const fetchedTeams = result.entities as Array<{ teamid?: string; name?: string }>;
        teams = fetchedTeams
          .filter(team => team.name)
          .map(team => ({ id: team.teamid ?? '', name: team.name ?? '' }));
      } catch (error) {
        teamsError = error instanceof Error ? error.message : 'Unable to retrieve teams';
      }

      const userInfo = {
        userId: userSettings.userId,
        userName: userSettings.userName,
        languageId: userSettings.languageId,
        securityRoles,
        teams,
        defaultDashboardId: userSettings.defaultDashboardId,
      };

      DynamicsUtils.createMuiPopup({
        id: 'levelup-current-user-info',
        title: 'Current User Information',
        tables: [
          {
            title: 'User',
            headers: ['Property', 'Value'],
            rows: [
              ['Name', userInfo.userName],
              ['User ID', userInfo.userId],
              ['Language ID', String(userInfo.languageId)],
            ],
          },
          {
            title: 'Security Roles',
            headers: ['Name', 'ID'],
            rows: securityRoles.map(role => [role.name, role.id]),
            description:
              securityRoles.length === 0 ? 'No security roles were returned.' : undefined,
          },
          {
            title: 'Teams',
            headers: ['Name', 'ID'],
            rows:
              teams.length > 0
                ? teams.map(team => [team.name, team.id])
                : [[teamsError ?? 'No teams found', '']],
          },
        ],
        layoutMode: 'dual-pane',
        enableSearch: true,
      });

      return userInfo;
    } catch (error) {
      throw new Error(
        `Failed to get user information: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Check if the current user has a specific privilege
   */
  static async checkUserPrivilege(privilegeName: string): Promise<boolean> {
    // Ensure Xrm context is available
    if (typeof Xrm === 'undefined' || !Xrm.Utility) {
      throw new Error('Xrm context not available');
    }

    // For the specific case of impersonation privilege, use FetchXML to check
    if (privilegeName === 'prvActOnBehalfOfAnotherUser') {
      const fetchXml = `
        <fetch count="1">
          <entity name="roleprivileges">
            <link-entity name="role" from="roleid" to="roleid">
              <attribute name="name" />
              <attribute name="isinherited" />
              <link-entity name="systemuserroles" from="roleid" to="roleid" intersect="true">
                <filter>
                  <condition attribute="systemuserid" operator="eq-userid" />
                </filter>
              </link-entity>
            </link-entity>
            <link-entity name="privilege" from="privilegeid" to="privilegeid" link-type="inner">
              <filter>
                <condition attribute="name" operator="eq" value="${privilegeName}" />
              </filter>
            </link-entity>
          </entity>
        </fetch>
      `;

      try {
        const webApiClient = WebApiClient.getInstance();
        const result = await webApiClient.executeFetchXml('roleprivilegescollection', fetchXml);

        // If we get any results, the user has the privilege
        return result && result.entities && result.entities.length > 0;
      } catch (fetchError) {
        // Fallback to role name check if FetchXML fails
        try {
          const globalContext = Xrm.Utility.getGlobalContext();
          const userRoles = globalContext.userSettings
            .roles as Xrm.Collection.ItemCollection<Xrm.LookupValue>;

          if (!userRoles || userRoles.getLength() === 0) {
            return false;
          }

          // Check if user is a system administrator (usually has all privileges)
          for (let i = 0; i < userRoles.getLength(); i++) {
            const role = userRoles.get(i);
            const roleName = role.name?.toLowerCase();

            // System Administrator role typically has all privileges including impersonation
            if (roleName === 'system administrator') {
              return true;
            }
          }

          return false;
        } catch (roleError) {
          // If both FetchXML and role check fail, throw the original error
          throw fetchError;
        }
      }
    }
    // For other privileges, implement as needed
    return false;
  }

  /**
   * Get organization settings
   */
  static getOrganizationSettings(): Record<string, unknown> {
    try {
      const globalContext = Xrm.Utility.getGlobalContext();
      const orgSettings = globalContext.organizationSettings;

      const settings = {
        organizationId: orgSettings.organizationId,
        uniqueName: orgSettings.uniqueName,
        languageId: orgSettings.languageId,
        organizationGeo: orgSettings.organizationGeo,
        baseCurrencyId: orgSettings.baseCurrencyId,
        defaultCountryCode: orgSettings.defaultCountryCode,
        isAutoSaveEnabled: orgSettings.isAutoSaveEnabled,
      };

      return settings;
    } catch (error) {
      throw new Error(
        `Failed to get organization settings: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get client information
   */
  static getClientInfo(): Record<string, unknown> {
    try {
      const globalContext = Xrm.Utility.getGlobalContext();

      const clientInfo = {
        client: globalContext.client,
        clientUrl: globalContext.getClientUrl(),
        currentTheme: globalContext.getCurrentTheme(),
        isOnPremise: globalContext.isOnPremise,
        organizationUrl: globalContext.getClientUrl(),
        version: globalContext.getVersion(),
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
      };

      return clientInfo;
    } catch (error) {
      throw new Error(
        `Failed to get client information: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Search for users by name or email with result truncation notifications
   */
  static async searchUsers(query: string): Promise<SearchResult> {
    try {
      console.log('🔍 [AdminActions] searchUsers called with query:', query);
      const webApiClient = WebApiClient.getInstance();
      console.log('🔍 [AdminActions] Got WebApiClient instance, calling searchUsers...');
      const result = await webApiClient.searchUsers(query);
      console.log('🔍 [AdminActions] WebApiClient.searchUsers returned:', result);
      console.log('🔍 [AdminActions] Result users array length:', result?.users?.length);
      return result;
    } catch (error) {
      console.error('🔍 [AdminActions] Error searching users:', error);
      throw new Error(
        `Failed to search users: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /** Search security roles that can be added to a bulk membership lookup. */
  static async searchSecurityRoles(query: string): Promise<SecurityRole[]> {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      return [];
    }

    const escapedQuery = trimmedQuery
      .replace(/&/g, '&amp;')
      .replace(/'/g, '&apos;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const result = await WebApiClient.getInstance().executeFetchXml(
      'roles',
      `<fetch top="50"><entity name="role"><attribute name="roleid" /><attribute name="name" /><order attribute="name" /><filter><condition attribute="name" operator="like" value="%${escapedQuery}%" /></filter><link-entity name="businessunit" from="businessunitid" to="businessunitid" alias="businessunit" link-type="outer"><attribute name="name" /></link-entity></entity></fetch>`
    );

    return (result.entities as Array<Partial<SecurityRole> & Record<string, string | undefined>>)
      .filter(role => role.roleid && role.name)
      .map(role => ({
        roleid: role.roleid as string,
        name: role.name as string,
        businessUnitName: role['businessunit.name'],
      }));
  }

  /**
   * Show direct system-user/role associations in the CRM-page table dialog.
   * Team-inherited roles are intentionally excluded because they are not systemuserroles records.
   */
  static async getSecurityRoleMemberships(
    mode: 'users-to-roles' | 'roles-to-users',
    ids: string[]
  ): Promise<{ displayedCount: number }> {
    if (mode !== 'users-to-roles' && mode !== 'roles-to-users') {
      throw new Error('The membership lookup mode is invalid.');
    }

    const values = validateIds(ids)
      .map(id => `<value>${id}</value>`)
      .join('');
    const fetchXml =
      mode === 'users-to-roles'
        ? `<fetch><entity name="systemuser"><attribute name="systemuserid" /><attribute name="fullname" /><attribute name="internalemailaddress" /><filter><condition attribute="systemuserid" operator="in">${values}</condition></filter><link-entity name="systemuserroles" from="systemuserid" to="systemuserid" intersect="true" link-type="outer"><link-entity name="role" from="roleid" to="roleid" alias="securityrole" link-type="outer"><attribute name="roleid" /><attribute name="name" /></link-entity></link-entity></entity></fetch>`
        : `<fetch><entity name="role"><attribute name="roleid" /><attribute name="name" /><filter><condition attribute="roleid" operator="in">${values}</condition></filter><link-entity name="systemuserroles" from="roleid" to="roleid" intersect="true" link-type="outer"><link-entity name="systemuser" from="systemuserid" to="systemuserid" alias="securityuser" link-type="outer"><attribute name="systemuserid" /><attribute name="fullname" /><attribute name="internalemailaddress" /></link-entity></link-entity></entity></fetch>`;
    const result = await WebApiClient.getInstance().executeFetchXml(
      mode === 'users-to-roles' ? 'systemusers' : 'roles',
      fetchXml
    );

    const memberships = (result.entities as Array<Record<string, unknown>>).map(entity => {
      const value = (key: string): string => String(entity[key] ?? '');
      return mode === 'users-to-roles'
        ? {
            userId: value('systemuserid'),
            userName: value('fullname'),
            userEmail: value('internalemailaddress'),
            roleId: value('securityrole.roleid'),
            roleName: value('securityrole.name'),
          }
        : {
            userId: value('securityuser.systemuserid'),
            userName: value('securityuser.fullname'),
            userEmail: value('securityuser.internalemailaddress'),
            roleId: value('roleid'),
            roleName: value('name'),
          };
    });

    const groups = new Map<
      string,
      { name: string; email: string; memberships: SecurityRoleMembership[] }
    >();
    for (const membership of memberships) {
      const id = mode === 'users-to-roles' ? membership.userId : membership.roleId;
      const name = mode === 'users-to-roles' ? membership.userName : membership.roleName;
      const email = mode === 'users-to-roles' ? membership.userEmail : '';
      const group = groups.get(id) ?? { name, email, memberships: [] };
      group.memberships.push(membership);
      groups.set(id, group);
    }

    DynamicsUtils.createMuiPopup({
      id: 'levelup-security-role-memberships',
      title: mode === 'users-to-roles' ? 'User to Roles' : 'Role to Users',
      tables: Array.from(groups.values()).map(group => ({
        title: group.email ? `${group.name} (${group.email})` : group.name,
        headers:
          mode === 'users-to-roles' ? ['Security Role', 'Role ID'] : ['User', 'Email', 'User ID'],
        rows:
          mode === 'users-to-roles'
            ? group.memberships.map(membership => [
                membership.roleName || 'No direct security roles',
                membership.roleId,
              ])
            : group.memberships.map(membership => [
                membership.userName || 'No directly assigned users',
                membership.userEmail,
                membership.userId,
              ]),
        description:
          mode === 'users-to-roles'
            ? `${group.memberships.filter(membership => membership.roleId).length} directly assigned role(s)`
            : `${group.memberships.filter(membership => membership.userId).length} directly assigned user(s)`,
      })),
      layoutMode: 'dual-pane',
      enableSearch: true,
      showOpenInNewTab: true,
    });

    return { displayedCount: groups.size };
  }

  /**
   * Start impersonation for a specific user
   */
  static startImpersonation(user: ImpersonationUser): boolean {
    try {
      if (!user.azureactivedirectoryobjectid) {
        throw new Error('User does not have an Azure AD Object ID');
      }

      currentImpersonationUser = user;
      console.log(
        'Started impersonating user:',
        user.fullname,
        'with Azure AD ID:',
        user.azureactivedirectoryobjectid
      );

      // Note: Actual header injection is now handled by the background script via declarativeNetRequest
      // This is more secure and reliable than function overriding

      return true;
    } catch (error) {
      console.error('Error starting impersonation:', error);
      throw new Error(
        `Failed to start impersonation: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Stop impersonation
   */
  static stopImpersonation(): boolean {
    try {
      currentImpersonationUser = null;
      console.log('Stopped impersonation');
      return true;
    } catch (error) {
      console.error('Error stopping impersonation:', error);
      throw new Error(
        `Failed to stop impersonation: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get current impersonation status
   */
  static getCurrentImpersonation(): ImpersonationUser | null {
    return currentImpersonationUser;
  }
}
