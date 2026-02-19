const fs = require('fs');
const path = '/home/admin/.openclaw/extensions/wecom/webhook.js';

let content = fs.readFileSync(path, 'utf8');

// 查找并替换
const oldStr = `// 1. Parse JSON body to get encrypt field
    let encrypt;
    try {
      const jsonBody = JSON.parse(body);
      encrypt = jsonBody.encrypt;
      logger.debug("Parsed request body", { hasEncrypt: !!encrypt });
    } catch (e) {
      logger.error("Failed to parse request body as JSON",`;

const newStr = `// 1. Parse body to get encrypt field (JSON or XML)
    let encrypt;
    try {
      if (body.trim().startsWith('{')) {
        const jsonBody = JSON.parse(body);
        encrypt = jsonBody.encrypt;
        logger.debug("Parsed as JSON", { hasEncrypt: !!encrypt });
      } else {
        const match = body.match(/<Encrypt>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?<\\/Encrypt>/);
        if (match) {
          encrypt = match[1];
          logger.debug("Parsed as XML", { hasEncrypt: !!encrypt });
        }
      }
    } catch (e) {
      logger.error("Failed to parse body",`;

if (content.includes(oldStr)) {
  content = content.replace(oldStr, newStr);
  fs.writeFileSync(path, content);
  console.log('SUCCESS: Patch applied');
} else if (content.includes('JSON or XML')) {
  console.log('INFO: Already patched');
} else {
  console.log('ERROR: Pattern not found');
}
