import { getContentLanguage } from './localization';

const messages = {
  accountReview: [
    'The server rejected the selected account state or license. Ask an administrator to verify licensing, enabled status and environment eligibility.',
    '服务端拒绝了所选账号状态或许可。请管理员核查许可证、启用状态及环境访问资格。',
  ],
  summary: ['Diagnosis summary', '诊断摘要'],
  account: ['Account status', '账号状态'],
  allowed: ['Can read the record', '能读取该单据'],
  denied: ['Cannot read the record', '不能读取该单据'],
  unknown: ['Unable to complete the check', '无法完成检查'],
  accountUnavailable: [
    'Account unavailable; effective access not confirmed',
    '账号不可用，未能确认有效访问权限',
  ],
  checked: ['Checked', '已检查'],
  notChecked: ['Could not check', '未能检查'],
  skipped: ['Not executed', '未执行'],
  disabled: [
    'The user is disabled. Ask an administrator to review the account; do not change record permissions to resolve this.',
    '用户已禁用。请管理员核查账号状态，不应通过修改单据权限处理此问题。',
  ],
  license: [
    'No license is reported for a read/write user. Verify licensing and environment eligibility. Noninteractive/application users have different licensing requirements.',
    '系统显示该读写用户未获许可证。请核查许可和环境访问资格；非交互/应用用户的许可要求不同。',
  ],
  missingRead: [
    'No Read privilege was found in the complete user/team role set. Sharing alone does not replace the required table privilege.',
    '在完整的用户/团队角色集合中未找到读取权限。共享本身不能替代必需的实体权限。',
  ],
  scopeReview: [
    'The server denied Read. Review role depths, record ownership/business unit and sharing below. These are evidence, not a definitive access-source attribution.',
    '服务端未授予读取权限。请核查下方角色范围、记录所有权/业务部门和共享。下列内容是排查证据，不是唯一权限来源的断言。',
  ],
  incomplete: [
    'Some checks failed. Unknown results must not be interpreted as missing roles, missing sharing or denied access.',
    '部分检查失败。未知结果不能当作没有角色、没有共享或没有访问权限。',
  ],
  visibility: [
    'Record Read is allowed. If the user cannot find it in the UI, check app access, view filters, form availability, field security, related-record permissions and session/cache. A permission result does not guarantee a business action succeeds.',
    '服务端允许读取该记录。若界面仍找不到，请检查应用访问、视图筛选、表单可用性、字段安全、关联记录权限及会话/缓存。权限结果不保证业务操作一定成功。',
  ],
  status: ['Status', '状态'],
  detail: ['Details / next step', '详情 / 下一步'],
  enabled: ['Enabled', '启用状态'],
  licensed: ['License reported', '系统许可状态'],
  accessMode: ['Access mode (Dataverse value)', '访问模式（Dataverse 值）'],
  businessUnit: ['Business unit', '业务部门'],
  recordBusinessUnit: ['Record owning business unit', '记录所属业务部门'],
  roleBusinessUnit: ['Role business unit', '角色所属业务部门'],
  owner: ['Record owner', '记录所有者'],
  organizationOwned: [
    'Organization-owned table; individual ownership does not apply',
    '组织所有的实体，不适用个人所有权',
  ],
  sameBU: ['Same business unit', '同一业务部门'],
  differentBU: [
    'Different business units; check role depth and modernized business-unit settings',
    '不同业务部门，请核查角色范围及跨业务部门所有权配置',
  ],
  parentBU: [
    'Selected user business unit is an ancestor of the record business unit',
    '所选用户业务部门是记录业务部门的上级',
  ],
  yes: ['Yes', '是'],
  no: ['No', '否'],
  missing: ['Not granted', '未授予'],
  noRoles: ['No user/team roles returned', '未返回用户/团队角色'],
  matrix: ['Role permission matrix', '角色权限矩阵'],
  ownershipBU: ['Ownership and business units', '所有权与业务部门'],
  shares: ['Matched sharing', '匹配的共享关系'],
  noShares: [
    'No matching direct, team or organization share returned',
    '未返回匹配的直接、团队或组织共享',
  ],
  shareNote: [
    'Sharing rights shown here are evidence from the sharing API, not proof of the sole access source. Cascaded/inherited access may need further review.',
    '这里显示共享接口返回的授予权限，不代表唯一访问来源。级联/继承访问可能需要进一步核查。',
  ],
  principal: ['Shared principal', '共享对象'],
  sharedRights: ['Granted sharing rights', '共享授予权限'],
  directShare: ['Direct user share', '直接共享给用户'],
  teamShare: ['Team share', '团队共享'],
  organizationShare: ['Organization share', '组织共享'],
  teams: ['Team membership / access teams', '团队成员关系 / 访问团队'],
  teamType: ['Team type', '团队类型'],
  ownerTeam: ['Owner/group team', '所有者/组团队'],
  accessTeam: ['Access team', '访问团队'],
  targetTeam: ['Linked to current record', '关联当前单据'],
  teamDependency: [
    'Team membership could not be checked, so matching team shares remain unknown. See the team membership section for the original failure.',
    '由于团队成员关系未能检查，暂时无法确认团队共享。请查看团队成员关系区域的原始失败原因。',
  ],
  membershipNote: [
    'Membership alone does not grant every operation. Compare granted sharing rights and the authoritative effective-rights result.',
    '仅有团队成员关系不代表拥有全部操作权限，应结合共享授予权限及服务端有效权限结果判断。',
  ],
  noTeams: ['No team memberships returned', '未返回团队成员关系'],
  hierarchy: ['Hierarchy evidence (not exact attribution)', '层次结构证据（非精确归因）'],
  hierarchyEnabled: ['Organization hierarchy security enabled', '组织层次结构安全启用状态'],
  hierarchyDepth: ['Configured hierarchy depth', '配置的层次结构深度'],
  manager: ['Selected user manager', '所选用户的经理'],
  position: ['Selected user position', '所选用户的职位'],
  managerChain: ['Owner manager chain', '所有者的经理链'],
  positionChain: ['Owner position ancestor chain', '所有者的职位上级链'],
  managerMatch: ['Selected user appears in the owner manager chain', '所选用户位于所有者经理链中'],
  positionMatch: [
    'Selected position appears in the owner position ancestor chain',
    '所选职位位于所有者职位上级链中',
  ],
  hierarchyNote: [
    'A hierarchy relationship does not prove access. Check enabled model, excluded tables, depth, business-unit restrictions and required Read privilege. Owner-team/shared-report hierarchy paths are not exhaustively enumerated.',
    '存在层次关系不等于已获得权限，还需核查启用模型、排除实体、深度、业务部门限制及必需读取权限。这里未穷举所有者团队/共享给下属的层次访问路径。',
  ],
  comparison: ['Two-user comparison', '双用户对比'],
  difference: ['Difference', '差异'],
  same: ['Same', '相同'],
  different: ['Different', '不同'],
  comparisonNote: [
    'Differences are troubleshooting clues, not proof that adding a role/team will fix access. Unknown checks are retained as unknown.',
    '差异是排查线索，不代表添加某角色/团队就能解决问题。未能检查的项目保持未知。',
  ],
  membership: ['Membership', '成员关系'],
  export: ['Export redacted diagnosis', '导出脱敏诊断'],
  exportWarning: [
    'Export a redacted JSON report? Names, emails, URLs, entity names, record/user/role/team/business-unit IDs and server error messages are excluded or replaced with aliases. Permission/configuration facts remain; review before sharing.',
    '导出脱敏 JSON 报告？姓名、邮件、URL、实体名、记录/用户/角色/团队/业务部门 ID 和服务端错误正文将被排除或替换为代号。权限/配置事实仍会保留，请在分享前复核。',
  ],
  limitations: ['Scope and limitations', '分析范围与限制'],
  timestamp: ['Analysis time', '分析时间'],
  readOnly: [
    'Read-only snapshot using the current session. No accounts, roles, shares or team membership are modified. Re-run after changes. Create is a table operation and is not treated as current-record access.',
    '使用当前会话的只读快照，不修改账号、角色、共享或团队成员关系。配置变更后应重新分析。创建是实体操作，不作为当前单据权限判断。',
  ],
} as const;

export type AccessMessage = keyof typeof messages;
export function accessT(key: AccessMessage): string {
  return messages[key][typeof document !== 'undefined' && getContentLanguage() === 'zh-CN' ? 1 : 0];
}
