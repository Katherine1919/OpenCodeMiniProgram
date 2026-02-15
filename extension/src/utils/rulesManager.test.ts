import { describe, it, expect } from 'vitest';
import { RulesManager } from './rulesManager';
import { DEFAULT_RULES } from './utmParser';

describe('RulesManager', () => {
  describe('Rule versioning', () => {
    it('starts with default rules', () => {
      const manager = new RulesManager();
      const rules = manager.getRules();
      expect(rules.requiredParams).toEqual(DEFAULT_RULES.requiredParams);
    });

    it('starts at version 1', () => {
      const manager = new RulesManager();
      expect(manager.getVersion()).toBe(1);
    });

    it('increments version on rule change', () => {
      const manager = new RulesManager();
      const initialVersion = manager.getVersion();
      manager.setLocalRules({ lowercaseOnly: false });
      expect(manager.getVersion()).toBe(initialVersion + 1);
    });

    it('preserves existing rules when partially updating', () => {
      const manager = new RulesManager();
      manager.setLocalRules({ lowercaseOnly: false });
      const rules = manager.getRules();
      expect(rules.requiredParams).toEqual(DEFAULT_RULES.requiredParams);
      expect(rules.lowercaseOnly).toBe(false);
    });
  });

  describe('Rollback', () => {
    it('returns false for non-existent version', () => {
      const manager = new RulesManager();
      const result = manager.rollbackToVersion(999);
      expect(result).toBe(false);
    });

    it('returns true when rolling back to current version', () => {
      const manager = new RulesManager();
      const currentVersion = manager.getVersion();
      const result = manager.rollbackToVersion(currentVersion);
      expect(result).toBe(true);
    });
  });

  describe('Rule configuration', () => {
    it('can customize max lengths', () => {
      const manager = new RulesManager();
      manager.setLocalRules({
        maxLength: { ...DEFAULT_RULES.maxLength, utm_source: 50 },
      });
      const rules = manager.getRules();
      expect(rules.maxLength.utm_source).toBe(50);
    });

    it('can customize allowlists', () => {
      const manager = new RulesManager();
      manager.setLocalRules({
        sourceAllowlist: ['google', 'facebook'],
      });
      const rules = manager.getRules();
      expect(rules.sourceAllowlist).toEqual(['google', 'facebook']);
    });

    it('can disable lowercase requirement', () => {
      const manager = new RulesManager();
      manager.setLocalRules({ lowercaseOnly: false });
      const rules = manager.getRules();
      expect(rules.lowercaseOnly).toBe(false);
    });

    it('can customize forbidden values', () => {
      const manager = new RulesManager();
      manager.setLocalRules({
        forbiddenValues: ['test', 'temp', 'draft'],
      });
      const rules = manager.getRules();
      expect(rules.forbiddenValues).toContain('draft');
    });

    it('can change required params', () => {
      const manager = new RulesManager();
      manager.setLocalRules({
        requiredParams: ['utm_source', 'utm_medium'],
      });
      const rules = manager.getRules();
      expect(rules.requiredParams).toEqual(['utm_source', 'utm_medium']);
      expect(rules.requiredParams).not.toContain('utm_campaign');
    });
  });

  describe('Rule merging', () => {
    it('merges partial updates correctly', () => {
      const manager = new RulesManager();
      manager.setLocalRules({ lowercaseOnly: false });
      manager.setLocalRules({
        maxLength: { ...DEFAULT_RULES.maxLength, utm_campaign: 200 },
      });
      
      const rules = manager.getRules();
      expect(rules.lowercaseOnly).toBe(false);
      expect(rules.maxLength.utm_campaign).toBe(200);
      expect(rules.maxLength.utm_source).toBe(DEFAULT_RULES.maxLength.utm_source);
    });
  });
});