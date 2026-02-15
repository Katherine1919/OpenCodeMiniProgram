import { RuleConfig, DEFAULT_RULES } from './utmParser';

interface RuleVersion {
  version: number;
  timestamp: number;
  rules: RuleConfig;
  active: boolean;
}

export class RulesManager {
  private rules: RuleConfig = DEFAULT_RULES;
  private version: number = 1;
  private remoteEndpoint?: string;
  private teamId?: string;
  
  constructor(remoteEndpoint?: string, teamId?: string) {
    this.remoteEndpoint = remoteEndpoint;
    this.teamId = teamId;
    this.loadLocalRules();
  }

  private async loadLocalRules(): Promise<void> {
    try {
      if (typeof localStorage === 'undefined') return;
      const stored = localStorage.getItem('utm-linter-rules');
      if (stored) {
        const parsed: RuleVersion = JSON.parse(stored);
        this.rules = { ...DEFAULT_RULES, ...parsed.rules };
        this.version = parsed.version;
      }
    } catch {
      // Use defaults
    }
  }

  async fetchRemoteRules(): Promise<void> {
    if (!this.remoteEndpoint || !this.teamId) return;
    
    try {
      const response = await fetch(
        `${this.remoteEndpoint}/rules?teamId=${this.teamId}&version=${this.version}`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.version > this.version) {
          this.rules = { ...DEFAULT_RULES, ...data.rules };
          this.version = data.version;
          this.saveLocalRules();
        }
      }
    } catch {
      // Keep local rules on failure
    }
  }

  private saveLocalRules(): void {
    if (typeof localStorage === 'undefined') return;
    const versionData: RuleVersion = {
      version: this.version,
      timestamp: Date.now(),
      rules: this.rules,
      active: true,
    };
    localStorage.setItem('utm-linter-rules', JSON.stringify(versionData));
  }

  getRules(): RuleConfig {
    return this.rules;
  }

  getVersion(): number {
    return this.version;
  }

  setLocalRules(rules: Partial<RuleConfig>): void {
    this.rules = { ...this.rules, ...rules };
    this.version++;
    this.saveLocalRules();
  }

  rollbackToVersion(targetVersion: number): boolean {
    try {
      if (typeof localStorage === 'undefined') return false;
      const stored = localStorage.getItem('utm-linter-rules');
      if (!stored) return false;
      
      const parsed: RuleVersion = JSON.parse(stored);
      if (parsed.version === targetVersion) {
        this.rules = parsed.rules;
        this.version = targetVersion;
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}