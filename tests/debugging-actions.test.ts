import { DebuggingActions } from '#content/modules/debugging-actions';

describe('DebuggingActions', () => {
  it('adds the monitor flag when Forms Monitor is enabled', () => {
    const location = {
      href: 'https://contoso.crm.dynamics.com/main.aspx?pagetype=entityrecord',
      reload: jest.fn(),
    };
    (global as typeof globalThis & { window: unknown }).window = { location };

    new DebuggingActions().enableFormsMonitor();

    expect(location.href).toBe(
      'https://contoso.crm.dynamics.com/main.aspx?pagetype=entityrecord&monitor=true'
    );
    expect(location.reload).not.toHaveBeenCalled();
  });

  it('reloads when Forms Monitor is already enabled', () => {
    const location = {
      href: 'https://contoso.crm.dynamics.com/main.aspx?monitor=true',
      reload: jest.fn(),
    };
    (global as typeof globalThis & { window: unknown }).window = { location };

    new DebuggingActions().enableFormsMonitor();

    expect(location.href).toBe('https://contoso.crm.dynamics.com/main.aspx?monitor=true');
    expect(location.reload).toHaveBeenCalledTimes(1);
  });
});
