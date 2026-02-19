#!/bin/bash
# OpenClaw 本地节点重连一键修复脚本
# 用法: ./local-fix.sh

set -e

SERVER="47.254.150.142"
PORT="16228"
SSH_KEY="/Users/Zhuanz/.ssh/openclaw-ssh-20260211.pem"
SSH_USER="admin"

echo "=== Step 1: 获取服务器 Token ==="
SERVER_TOKEN=$(ssh -i "$SSH_KEY" "$SSH_USER@$SERVER" "/opt/.swas/run-cmd.sh get-token" 2>/dev/null | tail -1)
echo "Token 长度: ${#SERVER_TOKEN}"

echo "=== Step 2: 检查并批准 Pending 设备 ==="
PENDING_REQ=$(ssh -i "$SSH_KEY" "$SSH_USER@$SERVER" "openclaw devices list 2>/dev/null" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)
if [ -n "$PENDING_REQ" ]; then
    echo "批准请求: $PENDING_REQ"
    ssh -i "$SSH_KEY" "$SSH_USER@$SERVER" "openclaw devices approve $PENDING_REQ" 2>/dev/null
else
    echo "无 pending 请求"
fi

echo "=== Step 3: 重启本地节点 ==="
openclaw node restart
sleep 5

echo "=== Step 4: 验证连接 ==="
openclaw nodes status --url ws://$SERVER:$PORT --token "$SERVER_TOKEN"
echo "=== 完成 ==="
