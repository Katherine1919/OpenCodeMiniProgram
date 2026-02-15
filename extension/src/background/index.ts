import { validateUTM, applyAutofix } from '../utils/utmParser';
import { RulesManager } from '../utils/rulesManager';

const rulesManager = new RulesManager();

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.type === 'VALIDATE_URL') {
    const rules = rulesManager.getRules();
    const result = validateUTM(request.url, rules);
    sendResponse(result);
    return true;
  }
  
  if (request.type === 'APPLY_AUTOFIX') {
    const fixedUrl = applyAutofix(request.url, request.autofix);
    sendResponse({ url: fixedUrl });
    return true;
  }
  
  if (request.type === 'GET_RULES') {
    sendResponse({
      rules: rulesManager.getRules(),
      version: rulesManager.getVersion(),
    });
    return true;
  }
  
  if (request.type === 'REFRESH_RULES') {
    rulesManager.fetchRemoteRules().then(() => {
      sendResponse({
        rules: rulesManager.getRules(),
        version: rulesManager.getVersion(),
      });
    });
    return true;
  }
});

// Periodically check for rule updates
setInterval(() => {
  rulesManager.fetchRemoteRules();
}, 300000); // Every 5 minutes