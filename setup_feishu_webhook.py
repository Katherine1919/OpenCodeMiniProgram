#!/usr/bin/env python3
import json
import sys

print("=" * 50)
print("飞书机器人配置工具")
print("=" * 50)
print()

# 获取Webhook地址
webhook_url = input("请输入飞书机器人Webhook地址: ").strip()

if not webhook_url:
    print("❌ 错误：Webhook地址不能为空")
    sys.exit(1)

# 简单验证
if not webhook_url.startswith("https://open.feishu.cn/open-apis/bot/v2/hook/"):
    print("⚠️  警告：URL格式可能不正确")
    print("正确格式: https://open.feishu.cn/open-apis/bot/v2/hook/xxxxxxxx")
    confirm = input("是否继续? (y/n): ").strip().lower()
    if confirm != 'y':
        sys.exit(1)

# 读取工作流文件
workflow_file = "/home/admin/.openclaw/workspace/jizhile_feishu_bot.json"

try:
    with open(workflow_file, 'r') as f:
        data = json.load(f)
    
    # 更新配置节点
    updated = False
    for node in data['nodes']:
        if node['name'] == '配置参数':
            old_code = node['parameters']['jsCode']
            new_code = old_code.replace(
                "webhookUrl: 'YOUR_WEBHOOK_URL_HERE'",
                f"webhookUrl: '{webhook_url}'"
            )
            node['parameters']['jsCode'] = new_code
            updated = True
            break
    
    if not updated:
        print("❌ 错误：未找到配置节点")
        sys.exit(1)
    
    # 保存文件
    with open(workflow_file, 'w') as f:
        json.dump(data, f, indent=2)
    
    print()
    print("=" * 50)
    print("✅ 配置成功！")
    print("=" * 50)
    print()
    print(f"工作流文件: {workflow_file}")
    print()
    print("下一步操作:")
    print("1. 在n8n中导入此工作流文件")
    print("2. 点击 'Execute Workflow' 测试")
    print("3. 检查飞书群是否收到消息")
    print()
    
except Exception as e:
    print(f"❌ 错误: {e}")
    sys.exit(1)
