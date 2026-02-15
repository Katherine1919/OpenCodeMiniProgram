export interface UTMParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
}

export interface ValidationRule {
  code: string;
  message: string;
  severity: 'error' | 'warning';
  field?: keyof UTMParams;
}

export interface ValidationResult {
  valid: boolean;
  params: UTMParams;
  violations: ValidationRule[];
  autofix?: UTMParams;
}

export interface RuleConfig {
  requiredParams: (keyof UTMParams)[];
  maxLength: Record<keyof UTMParams, number>;
  allowedChars: RegExp;
  lowercaseOnly: boolean;
  sourceAllowlist?: string[];
  mediumAllowlist?: string[];
  forbiddenValues?: string[];
}

export const DEFAULT_RULES: RuleConfig = {
  requiredParams: ['utm_source', 'utm_medium', 'utm_campaign'],
  maxLength: {
    utm_source: 120,
    utm_medium: 50,
    utm_campaign: 120,
    utm_term: 120,
    utm_content: 120,
  },
  allowedChars: /^[a-z0-9_-]+$/,
  lowercaseOnly: true,
  sourceAllowlist: undefined,
  mediumAllowlist: ['cpc', 'ppc', 'email', 'social', 'organic', 'referral', 'display', 'affiliate'],
  forbiddenValues: ['undefined', 'null', 'test', 'temp', 'temporary'],
};

export function parseUTMParams(url: string): UTMParams {
  try {
    const urlObj = new URL(url);
    const params: UTMParams = {};
    
    const utmKeys: (keyof UTMParams)[] = [
      'utm_source',
      'utm_medium', 
      'utm_campaign',
      'utm_term',
      'utm_content',
    ];
    
    for (const key of utmKeys) {
      const value = urlObj.searchParams.get(key);
      if (value !== null) {
        params[key] = value;
      }
    }
    
    return params;
  } catch {
    return {};
  }
}

export function validateUTM(
  url: string,
  config: RuleConfig = DEFAULT_RULES
): ValidationResult {
  const params = parseUTMParams(url);
  const violations: ValidationRule[] = [];
  
  // Check required params
  for (const required of config.requiredParams) {
    if (!params[required] || params[required] === '') {
      violations.push({
        code: 'MISSING_REQUIRED',
        message: `Missing required parameter: ${required}`,
        severity: 'error',
        field: required,
      });
    }
  }
  
  // Validate each param
  for (const [key, value] of Object.entries(params)) {
    if (!value) continue;
    const field = key as keyof UTMParams;
    
    // Check lowercase
    if (config.lowercaseOnly && value !== value.toLowerCase()) {
      violations.push({
        code: 'UPPERCASE_FOUND',
        message: `${key} must be lowercase: "${value}"`,
        severity: 'error',
        field,
      });
    }
    
    // Check whitespace first (includes spaces, tabs, etc.)
    if (/\s/.test(value)) {
      violations.push({
        code: 'WHITESPACE_FOUND',
        message: `${key} contains whitespace`,
        severity: 'error',
        field,
      });
    }
    
    // Check allowed characters (skip if whitespace found, as it would fail this check too)
    if (!/\s/.test(value) && !config.allowedChars.test(value)) {
      violations.push({
        code: 'INVALID_CHARS',
        message: `${key} contains invalid characters: "${value}"`,
        severity: 'error',
        field,
      });
    }
    
    // Check length
    const maxLen = config.maxLength[field];
    if (maxLen && value.length > maxLen) {
      violations.push({
        code: 'TOO_LONG',
        message: `${key} exceeds ${maxLen} characters (${value.length})`,
        severity: 'error',
        field,
      });
    }
    
    // Check forbidden values
    if (config.forbiddenValues?.includes(value.toLowerCase())) {
      violations.push({
        code: 'FORBIDDEN_VALUE',
        message: `${key} uses forbidden value: "${value}"`,
        severity: 'error',
        field,
      });
    }
    
    // Check allowlists
    if (field === 'utm_source' && config.sourceAllowlist) {
      if (!config.sourceAllowlist.includes(value)) {
        violations.push({
          code: 'SOURCE_NOT_ALLOWED',
          message: `Source "${value}" not in allowlist`,
          severity: 'error',
          field,
        });
      }
    }
    
    if (field === 'utm_medium' && config.mediumAllowlist) {
      if (!config.mediumAllowlist.includes(value)) {
        violations.push({
          code: 'MEDIUM_NOT_ALLOWED',
          message: `Medium "${value}" not in allowlist`,
          severity: 'error',
          field,
        });
      }
    }
  }
  
  // Generate autofix
  const autofix = generateAutofix(params, violations);
  
  return {
    valid: violations.length === 0,
    params,
    violations,
    autofix,
  };
}

export function generateAutofix(
  params: UTMParams,
  violations: ValidationRule[]
): UTMParams | undefined {
  const autofix: UTMParams = { ...params };
  let hasFixes = false;
  
  for (const violation of violations) {
    if (!violation.field) continue;
    const value = autofix[violation.field];
    if (!value) continue;
    
    switch (violation.code) {
      case 'UPPERCASE_FOUND':
        autofix[violation.field] = value.toLowerCase();
        hasFixes = true;
        break;
      case 'WHITESPACE_FOUND':
        autofix[violation.field] = value.replace(/\s+/g, '_');
        hasFixes = true;
        break;
      case 'INVALID_CHARS':
        autofix[violation.field] = value.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
        hasFixes = true;
        break;
    }
  }
  
  return hasFixes ? autofix : undefined;
}

export function applyAutofix(url: string, autofix: UTMParams): string {
  try {
    const urlObj = new URL(url);
    
    for (const [key, value] of Object.entries(autofix)) {
      if (value) {
        urlObj.searchParams.set(key, value);
      }
    }
    
    return urlObj.toString();
  } catch {
    return url;
  }
}