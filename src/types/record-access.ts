export const recordAccessOperations = [
  { key: 'Read', label: 'Read', right: 'ReadAccess' },
  { key: 'Write', label: 'Write', right: 'WriteAccess' },
  { key: 'Delete', label: 'Delete', right: 'DeleteAccess' },
  { key: 'Append', label: 'Append', right: 'AppendAccess' },
  { key: 'AppendTo', label: 'Append To', right: 'AppendToAccess' },
  { key: 'Assign', label: 'Assign', right: 'AssignAccess' },
  { key: 'Share', label: 'Share', right: 'ShareAccess' },
] as const;

export type RecordOperation = (typeof recordAccessOperations)[number]['key'];
export interface AnalysisUser {
  userId: string;
  userName: string;
}
export type DiagnosticCheck<T> =
  | { status: 'ok'; data: T }
  | { status: 'unavailable' | 'skipped'; message: string; code?: string };
export interface AccountEvidence {
  id: string;
  name: string;
  disabled?: boolean;
  licensed?: boolean;
  accessMode?: number;
  businessUnitId: string;
  businessUnitName: string;
  managerId: string;
  managerName: string;
  positionId: string;
  positionName: string;
}
export interface TeamEvidence {
  id: string;
  name: string;
  type: number;
  businessUnitId: string;
  regardingId: string;
}
export interface RoleEvidence {
  id: string;
  name: string;
  businessUnitId: string;
  businessUnitName: string;
  teamId?: string;
  teamName?: string;
  depths: Partial<Record<RecordOperation, number>>;
  privilegesKnown?: boolean;
}
export interface ShareEvidence {
  principalId: string;
  principalType: string;
  principalName: string;
  rights: string[];
  source: 'user' | 'team' | 'organization';
  accessTeam: boolean;
}
export interface HierarchyEvidence {
  enabled?: boolean;
  maxDepth?: number;
  managerChain: Array<{ id: string; name: string; businessUnitId: string }>;
  positionChain: Array<{ id: string; name: string }>;
  managerMatch: boolean;
  positionMatch: boolean;
}
export interface RecordContext {
  entity: string;
  recordId: string;
  timestamp: string;
  metadata: DiagnosticCheck<Record<string, unknown>>;
  record: DiagnosticCheck<Record<string, unknown>>;
  shares: DiagnosticCheck<Array<Record<string, unknown>>>;
  organization: DiagnosticCheck<Record<string, unknown>>;
  businessUnits: DiagnosticCheck<Array<Record<string, unknown>>>;
}
export interface UserAccessReport {
  user: AnalysisUser;
  account: DiagnosticCheck<AccountEvidence>;
  rights: DiagnosticCheck<string[]>;
  teams: DiagnosticCheck<TeamEvidence[]>;
  roles: DiagnosticCheck<RoleEvidence[]>;
  rolesComplete: boolean;
  shares: DiagnosticCheck<ShareEvidence[]>;
  hierarchy: DiagnosticCheck<HierarchyEvidence>;
  summary: 'allowed' | 'denied' | 'account-unavailable' | 'unknown';
  reasons: Array<
    | 'account-review'
    | 'disabled'
    | 'license'
    | 'missing-read-privilege'
    | 'scope-review'
    | 'visibility-review'
    | 'incomplete'
  >;
}
export interface AccessDiagnosticReport {
  context: RecordContext;
  users: UserAccessReport[];
}
