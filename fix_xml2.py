import re

path = '/home/admin/.openclaw/extensions/wecom/webhook.js'
with open(path, 'r') as f:
    content = f.read()

# 查找解密后的 JSON 解析部分（根据实际代码调整）
old_code = '''    // 4. Parse decrypted JSON content (AI Bot format)
    let data;
    try {
      data = JSON.parse(decryptedContent);
      logger.debug("Parsed message data", {
        msgtype: data.msgtype,
        keys: Object.keys(data),
        text: JSON.stringify(data.text),
      });
    } catch (e) {
      logger.error("Failed to parse decrypted content as JSON", {
        error: e instanceof Error ? e.message : String(e),
        content: decryptedContent.substring(0, 200),
      });
      return null;
    }'''

new_code = '''    // 4. Parse decrypted content (support both JSON and XML)
    let data;
    try {
      if (decryptedContent.trim().startsWith('{')) {
        // AI Bot JSON format
        data = JSON.parse(decryptedContent);
        logger.debug("Parsed message data as JSON", {
          msgtype: data.msgtype,
          keys: Object.keys(data),
          text: JSON.stringify(data.text),
        });
      } else {
        // Enterprise WeChat XML format
        logger.debug("Parsing as XML format");
        const msgTypeMatch = decryptedContent.match(/<MsgType>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?<\\/MsgType>/);
        const contentMatch = decryptedContent.match(/<Content>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?<\\/Content>/);
        const fromUserMatch = decryptedContent.match(/<FromUserName>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?<\\/FromUserName>/);
        const msgIdMatch = decryptedContent.match(/<MsgId>(\\d+)<\\/MsgId>/);
        
        if (!msgTypeMatch || !contentMatch) {
          logger.error("Failed to parse XML content", { content: decryptedContent.substring(0, 200) });
          return null;
        }
        
        // Convert XML to JSON format expected by downstream
        data = {
          msgtype: msgTypeMatch[1],
          text: { content: contentMatch[1] },
          from_user: fromUserMatch ? fromUserMatch[1] : '',
          msgid: msgIdMatch ? msgIdMatch[1] : String(Date.now()),
        };
        
        logger.debug("Parsed message data as XML", {
          msgtype: data.msgtype,
          content: data.text.content.substring(0, 50),
        });
      }
    } catch (e) {
      logger.error("Failed to parse decrypted content", {
        error: e instanceof Error ? e.message : String(e),
        content: decryptedContent.substring(0, 200),
      });
      return null;
    }'''

if old_code in content:
    content = content.replace(old_code, new_code)
    with open(path, 'w') as f:
        f.write(content)
    print('SUCCESS: XML parsing support added')
else:
    print('ERROR: Code pattern not found')
