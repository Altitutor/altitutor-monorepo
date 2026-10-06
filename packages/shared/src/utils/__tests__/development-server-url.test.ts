import { developmentServerUrl } from '../development-server-url';

const device = { isNativeDevelopment: true, hostUri: '192.168.1.20:8082' };

describe('native development server URLs', () => {
  it.each([3001, 3004, 3016, 54321])('uses the Expo computer host and keeps service port %s', (port) => {
    expect(developmentServerUrl(`http://localhost:${port}/mobile-auth?state=test`, device))
      .toBe(`http://192.168.1.20:${port}/mobile-auth?state=test`);
  });

  it.each(['localhost', '127.0.0.1', '[::1]', '0.0.0.0'])('resolves loopback host %s', (host) => {
    expect(developmentServerUrl(`http://${host}:3004`, device)).toBe('http://192.168.1.20:3004/');
  });

  it.each(['10.0.0.4', '172.16.0.4', '172.31.0.4', '192.168.0.4'])('accepts LAN host %s', (host) => {
    expect(developmentServerUrl('https://localhost:3001/auth#return', {
      ...device, hostUri: `${host}:8081`,
    })).toBe(`https://${host}:3001/auth#return`);
  });

  it.each(['https://student.altitutor.com', 'https://project.supabase.co', 'http://192.168.2.30:3004'])
    ('keeps explicitly reachable origin %s', (origin) => {
      expect(developmentServerUrl(origin, device)).toBe(origin);
    });

  it('keeps configured URLs in production and web previews', () => {
    const origin = 'http://localhost:3001';
    expect(developmentServerUrl(origin, { ...device, isNativeDevelopment: false })).toBe(origin);
  });

  it.each([undefined, null, '', 'localhost:8082', '127.0.0.1:8081', 'example.exp.direct:80', '203.0.113.20:8081', 'invalid host'])
    ('keeps localhost when Expo has no usable LAN host (%s)', (hostUri) => {
      const origin = 'http://localhost:3001';
      expect(developmentServerUrl(origin, { ...device, hostUri })).toBe(origin);
    });
});
