import { getContentLanguage } from './localization';

const chineseMessages = {
  'Current User Information': '当前用户信息',
  User: '用户',
  Property: '属性',
  Value: '值',
  Name: '名称',
  'User ID': '用户 ID',
  'Language ID': '语言 ID',
  'Security Roles': '安全角色',
  'Security Role': '安全角色',
  'Role ID': '角色 ID',
  Teams: '所属团队',
  Email: '电子邮件',
  'No security roles were returned.': '未返回安全角色。',
  'No teams found': '未找到所属团队',
  'Unable to retrieve teams': '无法查询所属团队',
  'User to Roles': '用户查角色',
  'Role to Users': '角色查用户',
  'No direct security roles': '未直接分配安全角色',
  'No directly assigned users': '未直接分配用户',
  '{count} directly assigned role(s)': '直接分配的安全角色：{count} 个',
  '{count} directly assigned user(s)': '直接分配的用户：{count} 个',
  'Access Analysis: {user}': '权限分析：{user}',
  'Effective Record Rights': '当前单据有效权限',
  'Role Privileges': '安全角色权限',
  'Access Sources': '访问来源',
  Operation: '操作',
  Result: '结果',
  Evidence: '依据',
  Source: '来源',
  'Assignment Source': '分配来源',
  'Privilege Depth': '权限范围',
  Read: '读取',
  Write: '写入',
  Delete: '删除',
  Append: '追加',
  'Append To': '追加到',
  Assign: '分配',
  Share: '共享',
  Allowed: '有权限',
  'Not allowed': '无权限',
  'User level': '用户级（个人）',
  'Business Unit': '业务部门级',
  'Parent: Child Business Units': '父子业务部门级',
  Organization: '组织级',
  'Not granted': '未授予',
  'Direct role': '用户直接分配角色',
  'Team role: {team}': '团队角色：{team}',
  'No matching table privilege was returned': '未返回匹配的实体权限',
  'Actual rights returned by RetrievePrincipalAccess for {entity} ({id}).':
    '通过 RetrievePrincipalAccess 返回的 {entity}（{id}）实际有效权限。',
  'Privileges for {entity} assigned through the user or a team.':
    '用户直接分配或通过所属团队获得的 {entity} 实体权限。',
  Ownership: '所有权',
  Shared: '共享',
  'Access team': '访问团队',
  'Hierarchy security': '层次结构安全',
  Applies: '符合',
  'Does not apply': '不符合',
  'No matching share found': '未找到匹配的共享关系',
  'Shared directly with the user': '直接共享给该用户',
  'No matching access team found': '未找到匹配的访问团队',
  'Requires review': '需进一步核查',
  'Owner team': '所有者团队',
  Unknown: '未知',
  'Dataverse does not expose an exact hierarchy-source attribution through this API. Review manager/position hierarchy when effective rights exist without ownership or a matching share.':
    '此 API 无法精确确认权限是否来自层次结构安全。存在有效权限但不符合所有权或共享关系时，请进一步核查经理或职位层次结构。',
  'Select at least one user or security role.': '请至少选择一个用户或安全角色。',
  'The selected user or security role identifiers are invalid.': '所选用户或安全角色标识无效。',
  'The membership lookup mode is invalid.': '关系查询模式无效。',
  'The record or user identifier is invalid.': '记录或用户标识无效。',
  'Access analysis request failed ({endpoint}): {status}':
    '权限分析请求失败（{endpoint}）：{status}',
  'New Tab': '新标签页',
} as const;

export type SecurityMessage = keyof typeof chineseMessages;

export function securityT(
  text: SecurityMessage,
  values: Record<string, string | number> = {},
  language: 'en' | 'zh-CN' = typeof document === 'undefined' ? 'en' : getContentLanguage()
): string {
  const translated = language === 'zh-CN' ? chineseMessages[text] : text;
  return translated.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    values[name] === undefined ? placeholder : String(values[name])
  );
}
