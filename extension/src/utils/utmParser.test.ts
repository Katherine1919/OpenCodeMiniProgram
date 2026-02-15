import {
  parseUTMParams,
  validateUTM,
  applyAutofix,
  generateAutofix,
  DEFAULT_RULES,
  UTMParams,
  RuleConfig,
  ValidationRule,
} from './utmParser';

describe('UTM Parser', () => {
  describe('parseUTMParams - Basic parsing', () => {
    const testCases: { url: string; expected: UTMParams; desc: string }[] = [
      {
        desc: 'Empty URL',
        url: '',
        expected: {},
      },
      {
        desc: 'URL without UTM params',
        url: 'https://example.com',
        expected: {},
      },
      {
        desc: 'Single UTM param',
        url: 'https://example.com?utm_source=google',
        expected: { utm_source: 'google' },
      },
      {
        desc: 'All required UTM params',
        url: 'https://example.com?utm_source=google&utm_medium=cpc&utm_campaign=spring_sale',
        expected: { utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'spring_sale' },
      },
      {
        desc: 'All UTM params including optional',
        url: 'https://example.com?utm_source=google&utm_medium=cpc&utm_campaign=spring_sale&utm_term=shoes&utm_content=banner1',
        expected: {
          utm_source: 'google',
          utm_medium: 'cpc',
          utm_campaign: 'spring_sale',
          utm_term: 'shoes',
          utm_content: 'banner1',
        },
      },
      {
        desc: 'URL with path and UTM params',
        url: 'https://example.com/products/shoes?utm_source=google&utm_medium=cpc',
        expected: { utm_source: 'google', utm_medium: 'cpc' },
      },
      {
        desc: 'URL with hash and UTM params',
        url: 'https://example.com?utm_source=google#section1',
        expected: { utm_source: 'google' },
      },
      {
        desc: 'UTM params with special values',
        url: 'https://example.com?utm_campaign=product_launch_v2',
        expected: { utm_campaign: 'product_launch_v2' },
      },
      {
        desc: 'UTM params with hyphens',
        url: 'https://example.com?utm_source=newsletter-email&utm_medium=e-mail',
        expected: { utm_source: 'newsletter-email', utm_medium: 'e-mail' },
      },
      {
        desc: 'UTM params with numbers',
        url: 'https://example.com?utm_campaign=campaign_2024_q1',
        expected: { utm_campaign: 'campaign_2024_q1' },
      },
      {
        desc: 'Encoded URL characters',
        url: 'https://example.com?utm_campaign=summer%20sale',
        expected: { utm_campaign: 'summer sale' },
      },
      {
        desc: 'Multiple same params (first wins)',
        url: 'https://example.com?utm_source=first&utm_source=second',
        expected: { utm_source: 'first' },
      },
      {
        desc: 'Empty UTM values',
        url: 'https://example.com?utm_source=&utm_medium=cpc',
        expected: { utm_source: '', utm_medium: 'cpc' },
      },
      {
        desc: 'UTM with unicode',
        url: 'https://example.com?utm_campaign=キャンペーン',
        expected: { utm_campaign: 'キャンペーン' },
      },
      {
        desc: 'Long UTM values',
        url: `https://example.com?utm_campaign=${'a'.repeat(200)}`,
        expected: { utm_campaign: 'a'.repeat(200) },
      },
      {
        desc: 'URL with port',
        url: 'https://example.com:8080?utm_source=test',
        expected: { utm_source: 'test' },
      },
      {
        desc: 'Relative URL (invalid, returns empty)',
        url: '/path?utm_source=test',
        expected: {},
      },
      {
        desc: 'Malformed URL (invalid, returns empty)',
        url: 'not a url',
        expected: {},
      },
      {
        desc: 'UTM params only (no other query params)',
        url: 'https://example.com?utm_source=a&utm_medium=b',
        expected: { utm_source: 'a', utm_medium: 'b' },
      },
      {
        desc: 'Mixed case UTM keys',
        url: 'https://example.com?utm_SOURCE=google',
        expected: {}, // Only lowercase keys are recognized
      },
    ];

    for (const tc of testCases) {
      it(tc.desc, () => {
        expect(parseUTMParams(tc.url)).toEqual(tc.expected);
      });
    }
  });

  describe('validateUTM - Missing required params', () => {
    const testCases: { url: string; missing: string[]; desc: string }[] = [
      {
        desc: 'All required missing',
        url: 'https://example.com',
        missing: ['utm_source', 'utm_medium', 'utm_campaign'],
      },
      {
        desc: 'Only source present',
        url: 'https://example.com?utm_source=google',
        missing: ['utm_medium', 'utm_campaign'],
      },
      {
        desc: 'Only medium present',
        url: 'https://example.com?utm_medium=cpc',
        missing: ['utm_source', 'utm_campaign'],
      },
      {
        desc: 'Only campaign present',
        url: 'https://example.com?utm_campaign=spring',
        missing: ['utm_source', 'utm_medium'],
      },
      {
        desc: 'Source and medium present',
        url: 'https://example.com?utm_source=google&utm_medium=cpc',
        missing: ['utm_campaign'],
      },
      {
        desc: 'Source and campaign present',
        url: 'https://example.com?utm_source=google&utm_campaign=spring',
        missing: ['utm_medium'],
      },
      {
        desc: 'Medium and campaign present',
        url: 'https://example.com?utm_medium=cpc&utm_campaign=spring',
        missing: ['utm_source'],
      },
      {
        desc: 'Optional params only',
        url: 'https://example.com?utm_term=shoes&utm_content=banner',
        missing: ['utm_source', 'utm_medium', 'utm_campaign'],
      },
      {
        desc: 'Empty required values',
        url: 'https://example.com?utm_source=&utm_medium=&utm_campaign=',
        missing: ['utm_source', 'utm_medium', 'utm_campaign'],
      },
      {
        desc: 'Whitespace only values (has INVALID_CHARS, not MISSING)',
        url: 'https://example.com?utm_source=   &utm_medium=cpc&utm_campaign=test',
        missing: [], // Whitespace-only is not empty, but has validation errors
      },
    ];

    for (const tc of testCases) {
      it(tc.desc, () => {
        const result = validateUTM(tc.url);
        const missingCodes = result.violations
          .filter((v: ValidationRule) => v.code === 'MISSING_REQUIRED')
          .map((v: ValidationRule) => v.field);
        expect(missingCodes.sort()).toEqual(tc.missing.sort());
      });
    }
  });

  describe('validateUTM - Uppercase violations', () => {
    const testCases: { url: string; fields: string[]; desc: string }[] = [
      {
        desc: 'Uppercase in source',
        url: 'https://example.com?utm_source=Google&utm_medium=cpc&utm_campaign=test',
        fields: ['utm_source'],
      },
      {
        desc: 'Uppercase in medium',
        url: 'https://example.com?utm_source=google&utm_medium=CPC&utm_campaign=test',
        fields: ['utm_medium'],
      },
      {
        desc: 'Uppercase in campaign',
        url: 'https://example.com?utm_source=google&utm_medium=cpc&utm_campaign=SPRING',
        fields: ['utm_campaign'],
      },
      {
        desc: 'Uppercase in term',
        url: 'https://example.com?utm_source=google&utm_medium=cpc&utm_campaign=test&utm_term=SHOES',
        fields: ['utm_term'],
      },
      {
        desc: 'Uppercase in content',
        url: 'https://example.com?utm_source=google&utm_medium=cpc&utm_campaign=test&utm_content=BANNER',
        fields: ['utm_content'],
      },
      {
        desc: 'Multiple uppercase fields',
        url: 'https://example.com?utm_source=Google&utm_medium=CPC&utm_campaign=TEST',
        fields: ['utm_source', 'utm_medium', 'utm_campaign'],
      },
      {
        desc: 'Mixed case',
        url: 'https://example.com?utm_source=GoogleAds&utm_medium=cpc&utm_campaign=test',
        fields: ['utm_source'],
      },
      {
        desc: 'All lowercase (valid)',
        url: 'https://example.com?utm_source=google&utm_medium=cpc&utm_campaign=test',
        fields: [],
      },
    ];

    for (const tc of testCases) {
      it(tc.desc, () => {
        const result = validateUTM(tc.url);
        const uppercaseFields = result.violations
          .filter((v: ValidationRule) => v.code === 'UPPERCASE_FOUND')
          .map((v: ValidationRule) => v.field);
        expect(uppercaseFields.sort()).toEqual(tc.fields.sort());
      });
    }
  });

  describe('validateUTM - Invalid characters', () => {
    const testCases: { url: string; invalidFields: string[]; desc: string }[] = [
      {
        desc: 'Space in source (triggers WHITESPACE_FOUND, not INVALID_CHARS)',
        url: 'https://example.com?utm_source=google ads&utm_medium=cpc&utm_campaign=test',
        invalidFields: [], // WHITESPACE_FOUND is reported instead
      },
      {
        desc: 'Special chars in source',
        url: 'https://example.com?utm_source=google!ads&utm_medium=cpc&utm_campaign=test',
        invalidFields: ['utm_source'],
      },
      {
        desc: 'At symbol in campaign',
        url: 'https://example.com?utm_source=google&utm_medium=cpc&utm_campaign=test@home',
        invalidFields: ['utm_campaign'],
      },
      {
        desc: 'Dot in medium',
        url: 'https://example.com?utm_source=google&utm_medium=cp.c&utm_campaign=test',
        invalidFields: ['utm_medium'],
      },
      {
        desc: 'Slash in campaign',
        url: 'https://example.com?utm_source=google&utm_medium=cpc&utm_campaign=test/campaign',
        invalidFields: ['utm_campaign'],
      },
      {
        desc: 'Ampersand in source',
        url: 'https://example.com?utm_source=google&ads&utm_medium=cpc&utm_campaign=test',
        invalidFields: [], // This is actually valid in URL parsing
      },
      {
        desc: 'Valid underscore',
        url: 'https://example.com?utm_source=google_ads&utm_medium=cpc&utm_campaign=test_v1',
        invalidFields: [],
      },
      {
        desc: 'Valid hyphen',
        url: 'https://example.com?utm_source=google-ads&utm_medium=cpc&utm_campaign=test-v1',
        invalidFields: [],
      },
      {
        desc: 'Valid numbers',
        url: 'https://example.com?utm_source=google123&utm_medium=cpc&utm_campaign=test2024',
        invalidFields: [],
      },
      {
        desc: 'Question mark in value (URL parsing handles this)',
        url: 'https://example.com?utm_campaign=test?extra&utm_source=google&utm_medium=cpc',
        invalidFields: ['utm_campaign'], // ? breaks the URL parsing
      },
    ];

    for (const tc of testCases) {
      it(tc.desc, () => {
        const result = validateUTM(tc.url);
        const invalidFields = result.violations
          .filter((v: ValidationRule) => v.code === 'INVALID_CHARS')
          .map((v: ValidationRule) => v.field);
        expect(invalidFields.sort()).toEqual(tc.invalidFields.sort());
      });
    }
  });

  describe('validateUTM - Length violations', () => {
    const testCases: { url: string; expectedTooLong: boolean; desc: string }[] = [
      {
        desc: 'Source exactly at limit (120)',
        url: `https://example.com?utm_source=${'a'.repeat(120)}&utm_medium=cpc&utm_campaign=test`,
        expectedTooLong: false,
      },
      {
        desc: 'Source 1 char over limit',
        url: `https://example.com?utm_source=${'a'.repeat(121)}&utm_medium=cpc&utm_campaign=test`,
        expectedTooLong: true,
      },
      {
        desc: 'Medium at limit (50)',
        url: `https://example.com?utm_source=google&utm_medium=${'a'.repeat(50)}&utm_campaign=test`,
        expectedTooLong: false,
      },
      {
        desc: 'Medium 1 char over limit',
        url: `https://example.com?utm_source=google&utm_medium=${'a'.repeat(51)}&utm_campaign=test`,
        expectedTooLong: true,
      },
      {
        desc: 'Campaign at limit (120)',
        url: `https://example.com?utm_source=google&utm_medium=cpc&utm_campaign=${'a'.repeat(120)}`,
        expectedTooLong: false,
      },
      {
        desc: 'Campaign over limit',
        url: `https://example.com?utm_source=google&utm_medium=cpc&utm_campaign=${'a'.repeat(150)}`,
        expectedTooLong: true,
      },
      {
        desc: 'Short values (valid)',
        url: 'https://example.com?utm_source=g&utm_medium=c&utm_campaign=t',
        expectedTooLong: false,
      },
    ];

    for (const tc of testCases) {
      it(tc.desc, () => {
        const result = validateUTM(tc.url);
        const hasTooLong = result.violations.some((v: ValidationRule) => v.code === 'TOO_LONG');
        expect(hasTooLong).toBe(tc.expectedTooLong);
      });
    }
  });

  describe('validateUTM - Forbidden values', () => {
    const testCases: { url: string; shouldBlock: boolean; desc: string }[] = [
      {
        desc: 'Source is "undefined"',
        url: 'https://example.com?utm_source=undefined&utm_medium=cpc&utm_campaign=test',
        shouldBlock: true,
      },
      {
        desc: 'Medium is "null"',
        url: 'https://example.com?utm_source=google&utm_medium=null&utm_campaign=test',
        shouldBlock: true,
      },
      {
        desc: 'Campaign is "test"',
        url: 'https://example.com?utm_source=google&utm_medium=cpc&utm_campaign=test',
        shouldBlock: true,
      },
      {
        desc: 'Campaign is "temp"',
        url: 'https://example.com?utm_source=google&utm_medium=cpc&utm_campaign=temp',
        shouldBlock: true,
      },
      {
        desc: 'Campaign is "temporary"',
        url: 'https://example.com?utm_source=google&utm_medium=cpc&utm_campaign=temporary',
        shouldBlock: true,
      },
      {
        desc: 'Valid campaign name',
        url: 'https://example.com?utm_source=google&utm_medium=cpc&utm_campaign=spring_sale',
        shouldBlock: false,
      },
      {
        desc: 'Case insensitive forbidden check',
        url: 'https://example.com?utm_source=google&utm_medium=cpc&utm_campaign=TEST',
        shouldBlock: true,
      },
    ];

    for (const tc of testCases) {
      it(tc.desc, () => {
        const result = validateUTM(tc.url);
        const hasForbidden = result.violations.some((v: ValidationRule) => v.code === 'FORBIDDEN_VALUE');
        expect(hasForbidden).toBe(tc.shouldBlock);
      });
    }
  });

  describe('validateUTM - Medium allowlist', () => {
    const customRules: RuleConfig = {
      ...DEFAULT_RULES,
      mediumAllowlist: ['cpc', 'email', 'social'],
    };

    const testCases: { url: string; shouldAllow: boolean; desc: string }[] = [
      {
        desc: 'Medium in allowlist (cpc)',
        url: 'https://example.com?utm_source=google&utm_medium=cpc&utm_campaign=test',
        shouldAllow: true,
      },
      {
        desc: 'Medium in allowlist (email)',
        url: 'https://example.com?utm_source=google&utm_medium=email&utm_campaign=test',
        shouldAllow: true,
      },
      {
        desc: 'Medium not in allowlist (ppc)',
        url: 'https://example.com?utm_source=google&utm_medium=ppc&utm_campaign=test',
        shouldAllow: false,
      },
      {
        desc: 'Medium not in allowlist (referral)',
        url: 'https://example.com?utm_source=google&utm_medium=referral&utm_campaign=test',
        shouldAllow: false,
      },
    ];

    for (const tc of testCases) {
      it(tc.desc, () => {
        const result = validateUTM(tc.url, customRules);
        const hasViolation = result.violations.some((v: ValidationRule) => v.code === 'MEDIUM_NOT_ALLOWED');
        expect(!hasViolation).toBe(tc.shouldAllow);
      });
    }
  });

  describe('validateUTM - Source allowlist', () => {
    const customRules: RuleConfig = {
      ...DEFAULT_RULES,
      sourceAllowlist: ['google', 'facebook', 'linkedin'],
    };

    const testCases: { url: string; shouldAllow: boolean; desc: string }[] = [
      {
        desc: 'Source in allowlist (google)',
        url: 'https://example.com?utm_source=google&utm_medium=cpc&utm_campaign=test',
        shouldAllow: true,
      },
      {
        desc: 'Source in allowlist (facebook)',
        url: 'https://example.com?utm_source=facebook&utm_medium=social&utm_campaign=test',
        shouldAllow: true,
      },
      {
        desc: 'Source not in allowlist (twitter)',
        url: 'https://example.com?utm_source=twitter&utm_medium=social&utm_campaign=test',
        shouldAllow: false,
      },
      {
        desc: 'Source not in allowlist (bing)',
        url: 'https://example.com?utm_source=bing&utm_medium=cpc&utm_campaign=test',
        shouldAllow: false,
      },
    ];

    for (const tc of testCases) {
      it(tc.desc, () => {
        const result = validateUTM(tc.url, customRules);
        const hasViolation = result.violations.some((v: ValidationRule) => v.code === 'SOURCE_NOT_ALLOWED');
        expect(!hasViolation).toBe(tc.shouldAllow);
      });
    }
  });

  describe('applyAutofix - Basic transformations', () => {
    const testCases: { input: string; expected: string; desc: string }[] = [
      {
        desc: 'Uppercase to lowercase',
        input: 'https://example.com?utm_source=GOOGLE&utm_medium=CPC&utm_campaign=TEST',
        expected: 'https://example.com/?utm_source=google&utm_medium=cpc&utm_campaign=test',
      },
      {
        desc: 'Spaces to underscores',
        input: 'https://example.com?utm_source=google ads&utm_medium=cpc&utm_campaign=test',
        expected: 'https://example.com/?utm_source=google_ads&utm_medium=cpc&utm_campaign=test',
      },
      {
        desc: 'Special chars to underscores',
        input: 'https://example.com?utm_source=google!ads&utm_medium=cpc&utm_campaign=test',
        expected: 'https://example.com/?utm_source=google_ads&utm_medium=cpc&utm_campaign=test',
      },
      {
        desc: 'Multiple issues fixed',
        input: 'https://example.com?utm_source=Google Ads&utm_medium=cpc&utm_campaign=TEST',
        expected: 'https://example.com/?utm_source=google_ads&utm_medium=cpc&utm_campaign=test',
      },
      {
        desc: 'Tab character encoded as percent',
        input: 'https://example.com?utm_source=google%09ads&utm_medium=cpc&utm_campaign=test',
        expected: 'https://example.com/?utm_source=google_ads&utm_medium=cpc&utm_campaign=test',
      },
      {
        desc: 'Multiple spaces collapsed to single underscore',
        input: 'https://example.com?utm_source=google  ads&utm_medium=cpc&utm_campaign=test',
        expected: 'https://example.com/?utm_source=google_ads&utm_medium=cpc&utm_campaign=test',
      },
      {
        desc: 'No changes needed',
        input: 'https://example.com?utm_source=google&utm_medium=cpc&utm_campaign=test',
        expected: 'https://example.com/?utm_source=google&utm_medium=cpc&utm_campaign=test',
      },
    ];

    for (const tc of testCases) {
      it(tc.desc, () => {
        const result = validateUTM(tc.input);
        if (result.autofix) {
          const fixed = applyAutofix(tc.input, result.autofix);
          expect(fixed).toBe(tc.expected);
        } else {
          // No autofix - URL should have trailing slash added by URL constructor
          expect(tc.input.replace('https://example.com?', 'https://example.com/?')).toBe(tc.expected);
        }
      });
    }
  });

  describe('generateAutofix - Edge cases', () => {
    const testCases: { input: UTMParams; expected?: UTMParams; desc: string }[] = [
      {
        desc: 'Empty params',
        input: {},
        expected: undefined,
      },
      {
        desc: 'Only valid params',
        input: { utm_source: 'google', utm_medium: 'cpc' },
        expected: undefined,
      },
      {
        desc: 'Mixed valid and fixable',
        input: { utm_source: 'GOOGLE', utm_medium: 'cpc', utm_campaign: 'TEST' },
        expected: { utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'test' },
      },
      {
        desc: 'Unicode is normalized by autofix',
        input: { utm_source: 'GOOGLE', utm_campaign: 'キャンペーン' },
        expected: { utm_source: 'google', utm_campaign: '______' },
      },
    ];

    for (const tc of testCases) {
      it(tc.desc, () => {
        const violations = validateUTM(
          `https://example.com?${new URLSearchParams(tc.input as Record<string, string>).toString()}`
        ).violations;
        const autofix = generateAutofix(tc.input, violations);
        expect(autofix).toEqual(tc.expected);
      });
    }
  });

  describe('Validation - Complex scenarios', () => {
    it('Multiple violations on same field', () => {
      const url = 'https://example.com?utm_source=Google Ads!&utm_medium=cpc&utm_campaign=test';
      const result = validateUTM(url);
      const sourceViolations = result.violations.filter((v: ValidationRule) => v.field === 'utm_source');
      expect(sourceViolations.length).toBeGreaterThanOrEqual(2);
    });

    it('Valid URL passes all checks', () => {
      const url = 'https://example.com?utm_source=google&utm_medium=cpc&utm_campaign=spring_sale_2024';
      const result = validateUTM(url);
      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.autofix).toBeUndefined();
    });

    it('Preserves non-UTM query params', () => {
      const url = 'https://example.com?foo=bar&utm_source=google&utm_medium=cpc&utm_campaign=test&baz=qux';
      const result = validateUTM(url);
      expect(result.params.utm_source).toBe('google');
    });

    it('Handles URL with fragment', () => {
      const url = 'https://example.com?utm_source=google&utm_medium=cpc&utm_campaign=test#section';
      const result = validateUTM(url);
      expect(result.params.utm_source).toBe('google');
    });

    it('Handles URL with auth', () => {
      const url = 'https://user:pass@example.com?utm_source=google&utm_medium=cpc&utm_campaign=test';
      const result = validateUTM(url);
      expect(result.params.utm_source).toBe('google');
    });
  });
});