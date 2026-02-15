const validatedEl = document.getElementById('validated') as HTMLElement;
const blockedEl = document.getElementById('blocked') as HTMLElement;
const versionEl = document.getElementById('version') as HTMLElement;
const sourceEl = document.getElementById('source') as HTMLElement;
const refreshBtn = document.getElementById('refresh') as HTMLButtonElement;
const statusEl = document.getElementById('status') as HTMLElement;

// Get current tab info
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0];
  if (tab?.url) {
    const url = new URL(tab.url);
    const isAdPlatform = 
      url.hostname.includes('linkedin.com') ||
      url.hostname.includes('facebook.com') ||
      url.hostname.includes('google.com');
    
    if (isAdPlatform) {
      statusEl.textContent = '✅ Active on this page';
      statusEl.className = 'status active';
    } else {
      statusEl.textContent = '⏸️ No ad platform detected';
      statusEl.className = 'status inactive';
    }
  }
});

// Load stats from storage
chrome.storage.local.get(['validated', 'blocked', 'ruleVersion', 'ruleSource'], (result) => {
  validatedEl.textContent = (result.validated || 0).toString();
  blockedEl.textContent = (result.blocked || 0).toString();
  versionEl.textContent = (result.ruleVersion || 1).toString();
  sourceEl.textContent = result.ruleSource || 'Default';
});

refreshBtn.addEventListener('click', () => {
  refreshBtn.disabled = true;
  refreshBtn.textContent = 'Refreshing...';
  
  chrome.runtime.sendMessage({ type: 'REFRESH_RULES' }, (response) => {
    if (response) {
      versionEl.textContent = response.version.toString();
      sourceEl.textContent = 'Remote';
    }
    refreshBtn.disabled = false;
    refreshBtn.textContent = 'Refresh Rules';
  });
});