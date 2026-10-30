import { translate } from '#localization/i18n';

describe('localization catalog', () => {
  it('returns English text and interpolates values', () => {
    expect(translate('en', 'recordOpened', { entity: 'account', recordId: '123' })).toBe(
      'Record opened: account (123)'
    );
  });

  it('returns Simplified Chinese text', () => {
    expect(translate('zh-CN', 'openById')).toBe('按 ID 打开');
  });
});
