#!/bin/bash
# OpenClaw 企业微信回调健康检查脚本
# 用法: ./wecom-health-check.sh

set -e

SERVER="47.254.150.142"
PORT="16228"
PATH="/wecom/app"
SSH_KEY="/Users/Zhuanz/.ssh/openclaw-ssh-20260211.pem"
SSH_USER="admin"

echo "=== 企业微信回调健康检查 ==="
echo ""

# 1. 服务器端口监听
echo "1. 端口监听状态:"
ssh -i "$SSH_KEY" "$SSH_USER@$SERVER" "ss -lntp | grep $PORT" | grep -q openclaw && echo "   ✅ 端口 $PORT 正在监听" || echo "   ❌ 端口 $PORT 未监听"

# 2. 本机探测
echo ""
echo "2. 本机探测 (127.0.0.1):"
LOCAL_RESULT=$(ssh -i "$SSH_KEY" "$SSH_USER@$SERVER" "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:$PORT$PATH 2>/dev/null" || echo "ERR")
if [ "$LOCAL_RESULT" = "403" ]; then
    echo "   ✅ 本机返回 403 (路由生效，需验证参数)"
elif [ "$LOCAL_RESULT" = "404" ]; then
    echo "   ❌ 返回 404 (路由未注册)"
else
    echo "   ⚠️  返回 $LOCAL_RESULT"
fi

# 3. 公网探测
echo ""
echo "3. 公网探测 ($SERVER):"
PUBLIC_RESULT=$(curl -s -o /dev/null -w '%{http_code}' "http://$SERVER:$PORT$PATH" 2>/dev/null || echo "ERR")
if [ "$PUBLIC_RESULT" = "403" ]; then
    echo "   ✅ 公网返回 403 (外网可达)"
elif [ "$PUBLIC_RESULT" = "000" ]; then
    echo "   ❌ 无法连接 (检查安全组)"
else
    echo "   ⚠️  返回 $PUBLIC_RESULT"
fi

# 4. 配置检查
echo ""
echo "4. 配置状态:"
TOKEN_LEN=$(ssh -i "$SSH_KEY" "$SSH_USER@$SERVER" "python3 -c \"import json; print(len(json.load(open('/home/admin/.openclaw/openclaw.json'))['channels']['wecom'].get('token','')))\"")
if [ "$TOKEN_LEN" -gt "10" ]; then
    echo "   ✅ Token 已配置 (长度: $TOKEN_LEN)"
else
    echo "   ❌ Token 未配置"
fi

echo ""
echo "=== 检查完成 ==="
echo ""
echo "企业微信后台填写:"
echo "  URL: http://$SERVER:$PORT$PATH"
