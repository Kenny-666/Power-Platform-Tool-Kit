type ContentLanguage = 'en' | 'zh-CN';

type ContentMessages = Record<string, string>;

const LANGUAGE_ATTRIBUTE = 'data-levelup-language';

// The injected page script must be a classic script, so it cannot import the React UI catalog.
const messages: Record<ContentLanguage, ContentMessages> = {
  en: {
    logicalNamesShown: 'Logical names displayed as clickable links ({count} fields processed) - click any logical name to copy it to clipboard',
    logicalNamesCleared: 'Logical names cleared and original labels restored',
    elementsUnlocked: '{count} elements unlocked', changedFieldsHighlighted: '{count} changed fields highlighted',
    webApiOpened: 'Web API record opened in new tab', subgridsRefreshed: '{count} subgrids refreshed', noOptionSets: 'No option set controls found on this form', optionSetsFound: 'Found {count} option set control(s)', recordCloned: 'Record cloned in new window', formRefreshed: 'Form refreshed with auto-save disabled', fieldsDisplayed: 'Displayed {count} field(s) from Web API', fieldsRetrieveFailed: 'Failed to retrieve fields via Web API',
    requiredEntityAndRecord: 'Entity name and record ID are required', recordOpened: 'Record opened: {entity} ({recordId})', requiredEntity: 'Entity name is required', recordWindowOpened: 'New {entity} record window opened', listOpened: '{entity} list opened', securityOpened: 'Security area opened', systemJobsOpened: 'System jobs opened', solutionsOpened: 'Solutions opened', processesOpened: 'Processes opened', mailboxesOpened: 'Mailboxes opened', mainPageOpened: 'Main page opened', advancedFindOpened: 'Advanced Find opened', mobileClientOpened: 'Mobile client opened', adminCenterCurrentOpened: 'Power Platform Admin center opened for current environment', adminCenterOpened: 'Power Platform Admin center opened', pagePinned: 'Current page pinned to side panel', pinFailed: 'Failed to pin to side panel: {error}', unknownError: 'Unknown error', solutionsHistoryOpened: 'Solutions history opened',
    content: 'Content', information: 'Information', copy: 'Copy', copied: 'Copied!', copyFailed: 'Copy Failed', search: 'Search...', quickNavigation: 'Quick Navigation', openInNewTab: 'Open in new tab', closeDialog: 'Close dialog', searchResults: '{visible} of {total} fields match "{query}"',
  },
  'zh-CN': {
    logicalNamesShown: '已显示逻辑名称的可点击链接（已处理 {count} 个字段）— 点击任意逻辑名称即可复制到剪贴板',
    logicalNamesCleared: '已清除逻辑名称并恢复原始标签', elementsUnlocked: '已解锁 {count} 个元素', changedFieldsHighlighted: '已突出显示 {count} 个已更改字段', webApiOpened: '已在新选项卡中打开 Web API 记录', subgridsRefreshed: '已刷新 {count} 个子网格', noOptionSets: '此表单中未找到选项集控件', optionSetsFound: '找到 {count} 个选项集控件', recordCloned: '已在新窗口中克隆记录', formRefreshed: '已在禁用自动保存的情况下刷新表单', fieldsDisplayed: '已显示 Web API 中的 {count} 个字段', fieldsRetrieveFailed: '无法通过 Web API 检索字段',
    requiredEntityAndRecord: '实体名称和记录 ID 为必填项', recordOpened: '已打开记录：{entity} ({recordId})', requiredEntity: '实体名称为必填项', recordWindowOpened: '已打开 {entity} 的新记录窗口', listOpened: '已打开 {entity} 列表', securityOpened: '已打开安全区域', systemJobsOpened: '已打开系统作业', solutionsOpened: '已打开解决方案', processesOpened: '已打开流程', mailboxesOpened: '已打开邮箱', mainPageOpened: '已打开主页', advancedFindOpened: '已打开高级查找', mobileClientOpened: '已打开移动客户端', adminCenterCurrentOpened: '已打开当前环境的 Power Platform 管理中心', adminCenterOpened: '已打开 Power Platform 管理中心', pagePinned: '已将当前页面固定到侧边栏', pinFailed: '无法固定到侧边栏：{error}', unknownError: '未知错误', solutionsHistoryOpened: '已打开解决方案历史记录',
    content: '内容', information: '信息', copy: '复制', copied: '已复制！', copyFailed: '复制失败', search: '搜索...', quickNavigation: '快速导航', openInNewTab: '在新选项卡中打开', closeDialog: '关闭对话框', searchResults: '“{query}”匹配 {total} 个字段中的 {visible} 个',
  },
};

export const getContentLanguage = (): ContentLanguage =>
  document.documentElement.getAttribute(LANGUAGE_ATTRIBUTE) === 'zh-CN' ? 'zh-CN' : 'en';

export const contentT = (key: string, values: Record<string, string | number> = {}): string =>
  Object.entries(values).reduce(
    (message, [name, value]) => message.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value)),
    messages[getContentLanguage()][key] ?? key
  );
