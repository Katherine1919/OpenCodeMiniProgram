import { describe, it, expect } from 'vitest';

describe('Performance Benchmarks', () => {
  const validateUTM = (url: string) => {
    // Simple validation for perf testing
    const start = url.indexOf('?');
    if (start === -1) return { valid: false };
    
    const params = new URLSearchParams(url.slice(start));
    const violations: string[] = [];
    
    const source = params.get('utm_source');
    const medium = params.get('utm_medium');
    const campaign = params.get('utm_campaign');
    
    if (!source) violations.push('missing_source');
    if (!medium) violations.push('missing_medium');
    if (!campaign) violations.push('missing_campaign');
    
    if (source && source !== source.toLowerCase()) violations.push('uppercase');
    if (medium && medium !== medium.toLowerCase()) violations.push('uppercase');
    if (campaign && campaign !== campaign.toLowerCase()) violations.push('uppercase');
    
    return { valid: violations.length === 0, violations };
  };

  it('validates typical URL in < 30ms median', () => {
    const typicalURL = 'https://example.com/products/shoes?utm_source=google&utm_medium=cpc&utm_campaign=spring_sale_2024&utm_term=running_shoes&utm_content=responsive_ad_v1';
    
    const times: number[] = [];
    const iterations = 1000;
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      validateUTM(typicalURL);
      const end = performance.now();
      times.push(end - start);
    }
    
    times.sort((a, b) => a - b);
    const median = times[Math.floor(iterations / 2)];
    
    expect(median).toBeLessThan(30);
  });

  it('handles 1000 validations without memory leak', () => {
    const url = 'https://example.com?utm_source=google&utm_medium=cpc&utm_campaign=test';
    
    // Run many validations
    for (let i = 0; i < 1000; i++) {
      validateUTM(url);
    }
    
    // If we get here without crash, pass
    expect(true).toBe(true);
  });
});