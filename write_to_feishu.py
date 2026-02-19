#!/usr/bin/env python3
import requests
import json
import time

# 配置
APP_ID = "cli_a907365bcefbdbd2"
APP_SECRET = "UOnIdOt4xWAgLrzVJUmrQbAOu8Icetjv"
API_KEY = "JZLdc9670be1403c05c"

# 文章数据（第一天的）
ARTICLES = [
    {"title": "7*24小时全栈开发的性价比黑奴：Qwen3.5-plus + Agent Team", "time": "2026-02-16 22:18:01", "digest": "AI 自治开发系统 3.0！！！", "url": "https://mp.weixin.qq.com/s/bwQKr0Te91UONWXKo5nvSw", "original": True},
    {"title": "用Seed 2.0复刻TikTok UGC视频卖了4 万美金", "time": "2026-02-15 22:13:01", "digest": "搞钱，抄就完了", "url": "https://mp.weixin.qq.com/s/XBMPm3zwc9QSxmvor0vJzQ", "original": True},
    {"title": "首个「牛马模型」？实测Minimax M2.5搭了个特斯拉股票交易系统", "time": "2026-02-13 23:15:41", "digest": "速度即正义！！", "url": "https://mp.weixin.qq.com/s/gUxkoHyNBrwePC0nL31TRg", "original": True},
    {"title": "GLM-5「全栈长任务」实测：3小时复刻TikTok视频生成SaaS", "time": "2026-02-12 17:37:07", "digest": "AI编程可能真的进入到下一个 Level了", "url": "https://mp.weixin.qq.com/s/hCrWSighUTTp1kStHeTE5w", "original": True},
    {"title": "10个无耻用 Seedance2.0 在Tiktok卖货的最佳实践玩法", "time": "2026-02-10 09:59:12", "digest": "效果最好的还是最后一个。", "url": "https://mp.weixin.qq.com/s/jTWvtkM790JuPHMBTMADQA", "original": True},
    {"title": "我用秒哒做了4个极其抽象的APP，能救回过年的年味吗？", "time": "2026-02-09 17:16:09", "digest": "10个一定能爆的春节APP，", "url": "https://mp.weixin.qq.com/s/BgoLZCxI1C6LrOpstKxX4Q", "original": True},
    {"title": "洗牌TikTok视频！字节全新Seedance2.0击败Sora，成UGC首选！！", "time": "2026-02-07 23:48:10", "digest": "真的睡不着啊！！！", "url": "https://mp.weixin.qq.com/s/DoLdtfjJ7UAFxrrIGQ4x9w", "original": True},
    {"title": "AI编程又要洗牌了！！凌晨两点 GPT-5.3与Claude 4.6同时突袭", "time": "2026-02-06 11:16:25", "digest": "地表最强模型易主了。", "url": "https://mp.weixin.qq.com/s/Z7LDU8PFIIa4f0J3CQ0-oQ", "original": True},
    {"title": "不是 Claude Cowork & Clawdbot玩不起，而是国产 Qoder 更具性价比", "time": "2026-01-31 13:32:10", "digest": "10个cowork高阶玩法", "url": "https://mp.weixin.qq.com/s/-wHWmwTgel6QMD4Kp9Y7YA", "original": True},
    {"title": "5w的独立站开发需求，我用Kimi K2.5 一键就生成好了", "time": "2026-01-28 19:54:33", "digest": "真的指指点点就把需求做完了。", "url": "https://mp.weixin.qq.com/s/-6jIrPbhmWWXmPA8ygzwUQ", "original": True},
    {"title": "用Kimi2.5 Agent Swarm，解读DeepSeek v4前最新模型，效果意外地好！！", "time": "2026-01-27 15:57:52", "digest": "一键生成图文并茂的word，免排版导入公众号。", "url": "https://mp.weixin.qq.com/s/eTP8UutK-SQtBv2pEippFQ", "original": True},
    {"title": "2026年是 AI落地大年，但会淘汰一批AI PPT工具", "time": "2026-01-26 09:56:03", "digest": "一口气测评7个AI PPT，含最佳实践", "url": "https://mp.weixin.qq.com/s/gDwl6Bf-OiHO9pu_FSg1TA", "original": True},
    {"title": "搭建一个云端Skills系统，随时随地记录TikTok爆款", "time": "2026-01-23 20:32:35", "digest": "多个Claude skills 的高级玩法！！", "url": "https://mp.weixin.qq.com/s/iDVpgy_ynzudgddR9NHcBA", "original": True},
    {"title": "我用n8n+AI记忆系统 MemOS，给SHEIN 搭了个销售Agent", "time": "2026-01-20 17:59:53", "digest": "1 个2026年跨境电商会爆发的AI玩法。", "url": "https://mp.weixin.qq.com/s/qm4Av7KiLudaKfxNTC3Eng", "original": True},
    {"title": "我宣布，千问是ESTJ的最佳AI伴侣", "time": "2026-01-15 11:17:56", "digest": "这下真的有种请了助理的掌控感。", "url": "https://mp.weixin.qq.com/s/87yJ9LUgDX2XWQpljF2GWg", "original": True}
]

def get_token():
    """获取飞书token"""
    resp = requests.post(
        "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
        json={"app_id": APP_ID, "app_secret": APP_SECRET}
    )
    return resp.json()["tenant_access_token"]

def create_document(token):
    """创建文档"""
    resp = requests.post(
        "https://open.feishu.cn/open-apis/docx/v1/documents",
        headers={"Authorization": f"Bearer {token}"},
        json={"title": "饼干哥哥AGI-文章汇总-第1天"}
    )
    return resp.json()["data"]["document"]["document_id"]

def get_first_block(token, doc_id):
    """获取第一个block ID"""
    resp = requests.get(
        f"https://open.feishu.cn/open-apis/docx/v1/documents/{doc_id}/blocks",
        headers={"Authorization": f"Bearer {token}"}
    )
    data = resp.json()
    if data.get("code") == 0:
        items = data["data"]["items"]
        return items[0]["block_id"] if items else None
    return None

def add_content(token, doc_id, block_id):
    """添加内容"""
    children = []
    
    # 标题
    children.append({
        "block_type": 1,
        "heading1": {
            "elements": [{"text_run": {"content": "📰 饼干哥哥AGI - 文章汇总"}}]
        }
    })
    
    # 统计信息
    children.append({
        "block_type": 2,
        "text": {
            "elements": [{"text_run": {"content": "📊 第1天抓取报告"}}]
        }
    })
    
    children.append({
        "block_type": 2,
        "text": {
            "elements": [{"text_run": {"content": f"⏰ 抓取时间: {time.strftime('%Y-%m-%d %H:%M:%S')}"}}]
        }
    })
    
    children.append({
        "block_type": 2,
        "text": {
            "elements": [{"text_run": {"content": f"📰 文章总数: {len(ARTICLES)} 篇"}}]
        }
    })
    
    # 分隔线
    children.append({"block_type": 14, "divider": {}})
    
    # 文章列表
    for i, article in enumerate(ARTICLES, 1):
        # 标题
        children.append({
            "block_type": 3,
            "heading3": {
                "elements": [{"text_run": {"content": f"{i}. {article['title']}"}}]
            }
        })
        
        # 时间
        children.append({
            "block_type": 2,
            "text": {
                "elements": [{"text_run": {"content": f"📅 {article['time']}"}}]
            }
        })
        
        # 摘要
        children.append({
            "block_type": 2,
            "text": {
                "elements": [{"text_run": {"content": f"📝 {article['digest']}"}}]
            }
        })
        
        # 链接
        children.append({
            "block_type": 2,
            "text": {
                "elements": [
                    {"text_run": {"content": "🔗 "}},
                    {"text_run": {"content": "阅读原文", "text_element_style": {"link": {"url": article['url']}}}}
                ]
            }
        })
        
        # 原创标记
        original_text = "✅ 原创" if article['original'] else "🔄 转载"
        children.append({
            "block_type": 2,
            "text": {
                "elements": [{"text_run": {"content": original_text}}]
            }
        })
        
        # 空行
        children.append({
            "block_type": 2,
            "text": {
                "elements": [{"text_run": {"content": ""}}]
            }
        })
    
    # 发送请求
    resp = requests.post(
        f"https://open.feishu.cn/open-apis/docx/v1/documents/{doc_id}/blocks/{block_id}/children",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json={"children": children}
    )
    
    return resp.json()

def main():
    print("🚀 开始写入飞书文档...")
    
    # 获取token
    print("📄 获取Token...")
    token = get_token()
    print(f"✅ Token获取成功")
    
    # 创建文档
    print("📄 创建文档...")
    doc_id = create_document(token)
    print(f"✅ 文档创建成功: {doc_id}")
    
    # 获取第一个block
    print("🔍 获取文档结构...")
    block_id = get_first_block(token, doc_id)
    print(f"✅ Block ID: {block_id}")
    
    # 添加内容
    print("📝 写入文章内容...")
    result = add_content(token, doc_id, block_id)
    
    if result.get("code") == 0:
        print("✅ 内容写入成功！")
        print(f"📎 文档链接: https://www.feishu.cn/docx/{doc_id}")
        return doc_id
    else:
        print(f"❌ 写入失败: {result}")
        return None

if __name__ == "__main__":
    doc_id = main()
    if doc_id:
        print(f"\n🎉 完成！文档ID: {doc_id}")
    else:
        print("\n❌ 失败")
