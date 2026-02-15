import { validateUTM, applyAutofix, ValidationResult } from '../utils/utmParser';
import { RulesManager } from '../utils/rulesManager';
import { EventQueue } from '../utils/eventQueue';

function detectPlatform(): string {
  const hostname = window.location.hostname;
  if (hostname.includes('linkedin.com')) return 'linkedin';
  if (hostname.includes('facebook.com') || hostname.includes('meta.com')) return 'meta';
  if (hostname.includes('google.com') && hostname.includes('ads')) return 'google';
  return 'unknown';
}

function findURLInputs(): HTMLInputElement[] {
  const selectors = [
    'input[type="url"]',
    'input[name*="url" i]',
    'input[name*="link" i]',
    'input[placeholder*="URL" i]',
    'input[placeholder*="link" i]',
    'textarea[name*="url" i]',
    'textarea[name*="link" i]',
  ];
  
  const inputs: HTMLInputElement[] = [];
  for (const selector of selectors) {
    inputs.push(...Array.from(document.querySelectorAll(selector)) as HTMLInputElement[]);
  }
  
  // LinkedIn Ads specific
  inputs.push(...Array.from(document.querySelectorAll('[data-test-form-element="destination-url"] input')) as HTMLInputElement[]);
  
  // Meta Ads specific
  inputs.push(...Array.from(document.querySelectorAll('[data-testid="website-url-input"] input')) as HTMLInputElement[]);
  
  // Google Ads specific
  inputs.push(...Array.from(document.querySelectorAll('.url-field input, [data-testid="final-url-input"]')) as HTMLInputElement[]);
  
  return [...new Set(inputs)];
}

function createErrorUI(result: ValidationResult): HTMLElement {
  const container = document.createElement('div');
  container.className = 'utm-linter-error-ui';
  container.style.cssText = `
    background: #fef2f2;
    border: 1px solid #ef4444;
    border-radius: 6px;
    padding: 12px;
    margin-top: 8px;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 13px;
  `;
  
  const title = document.createElement('div');
  title.textContent = '⚠️ UTM Validation Errors';
  title.style.cssText = 'font-weight: 600; color: #dc2626; margin-bottom: 8px;';
  container.appendChild(title);
  
  const list = document.createElement('ul');
  list.style.cssText = 'margin: 0 0 8px 0; padding-left: 16px; color: #7f1d1d;';
  
  for (const violation of result.violations) {
    const item = document.createElement('li');
    item.textContent = violation.message;
    item.style.marginBottom = '4px';
    list.appendChild(item);
  }
  container.appendChild(list);
  
  if (result.autofix) {
    const fixBtn = document.createElement('button');
    fixBtn.textContent = '🔧 Auto-fix Issues';
    fixBtn.style.cssText = `
      background: #dc2626;
      color: white;
      border: none;
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
    `;
    fixBtn.onclick = () => {
      const input = container.closest('.utm-linter-wrapper')?.querySelector('input, textarea') as HTMLInputElement;
      if (input && result.autofix) {
        const fixedUrl = applyAutofix(input.value, result.autofix);
        input.value = fixedUrl;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        container.remove();
      }
    };
    container.appendChild(fixBtn);
  }
  
  return container;
}

function wrapInput(input: HTMLInputElement): HTMLElement {
  const parent = input.parentElement;
  if (!parent) return input;
  
  const wrapper = document.createElement('div');
  wrapper.className = 'utm-linter-wrapper';
  wrapper.style.cssText = 'position: relative;';
  
  parent.insertBefore(wrapper, input);
  wrapper.appendChild(input);
  
  return wrapper;
}

let rulesManager: RulesManager;
let eventQueue: EventQueue;
const validatedInputs = new WeakSet<HTMLInputElement>();

async function init(): Promise<void> {
  const platform = detectPlatform();
  if (platform === 'unknown') return;
  
  rulesManager = new RulesManager(
    'https://api.utm-linter.io',
    'default-team'
  );
  await rulesManager.fetchRemoteRules();
  
  eventQueue = new EventQueue('https://api.utm-linter.io/events');
  eventQueue.startPeriodicFlush();
  
  observeDOM();
  interceptSubmits();
}

function validateInput(input: HTMLInputElement): void {
  if (validatedInputs.has(input)) return;
  validatedInputs.add(input);
  
  const wrapper = input.closest('.utm-linter-wrapper') || wrapInput(input);
  
  const handler = async () => {
    const url = input.value.trim();
    if (!url || !url.includes('utm_')) return;
    
    // Remove existing error UI
    wrapper.querySelector('.utm-linter-error-ui')?.remove();
    input.style.borderColor = '';
    
    const rules = rulesManager.getRules();
    const result = validateUTM(url, rules);
    
    // Log event
    await eventQueue.logEvent({
      type: result.valid ? 'validation_pass' : 'validation_fail',
      url: url.substring(0, 500),
      platform: detectPlatform(),
      violations: result.violations.map(v => v.code),
      ruleVersion: rulesManager.getVersion().toString(),
    });
    
    if (!result.valid) {
      input.style.borderColor = '#ef4444';
      const errorUI = createErrorUI(result);
      wrapper.appendChild(errorUI);
      
      // Block form submission
      input.dataset.utmValid = 'false';
    } else {
      input.dataset.utmValid = 'true';
    }
  };
  
  input.addEventListener('blur', handler);
  input.addEventListener('paste', () => setTimeout(handler, 0));
}

function observeDOM(): void {
  const observer = new MutationObserver(() => {
    const inputs = findURLInputs();
    for (const input of inputs) {
      validateInput(input);
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
  
  // Initial scan
  const inputs = findURLInputs();
  for (const input of inputs) {
    validateInput(input);
  }
}

function interceptSubmits(): void {
  document.addEventListener('submit', (e) => {
    const form = e.target as HTMLFormElement;
    const invalidInputs = form.querySelectorAll('[data-utm-valid="false"]');
    
    if (invalidInputs.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      
      // Scroll to first error
      invalidInputs[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Show alert
      alert('Please fix UTM validation errors before submitting.');
    }
  }, true);
  
  // Also intercept button clicks for AJAX forms
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const button = target.closest('button[type="submit"], [data-testid*="submit"], [data-testid*="save"]');
    
    if (button) {
      const form = button.closest('form') || document.querySelector('[role="dialog"]');
      if (form) {
        const invalidInputs = form.querySelectorAll('[data-utm-valid="false"]');
        if (invalidInputs.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          invalidInputs[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
          alert('Please fix UTM validation errors before submitting.');
        }
      }
    }
  }, true);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}