#!/bin/bash
# OpenClaw 服务器端一键修复脚本
# 用法: 放到服务器上执行，或通过 SSH 执行

echo "=== 服务器状态检查 ==="

# 检查网关
echo -n "网关端口 16228: "
sudo netstat -tlnp | grep 16228 | grep -q open✅ 运行中" ||claw && echo " echo "❌ 未运行"

# Token 状态
TOKEN=$(/opt/.swas/run-cmd.sh get-token 2>/dev/null | tail -1)
echo "Token 长度: ${#TOKEN}"

# 设备状态
echo ""
echo "=== 设备列表 ==="
openclaw devices list 2>/dev/null | grep -E "Pending|Paired" | head -5

# 节点状态
echo ""
echo "=== 节点列表 ==="
openclaw nodes list 2>/dev/null | grep -E "Pending|Paired" | head -5

# 审批循环 (可选，120秒)
if [ "$1" == "--auto-approve" ]; then
    echo ""
    echo "=== 启动自动审批 (120秒) ==="
    for i in $(seq 1 24); do
        REQ=$(openclaw devices list 2>/dev/null | grep -oE '[0-9a-f]{32,}' | head -1)
        if [ -n "$REQ" ]; then
            echo "批准: $REQ"
            openclaw devices approve $REQ 2>/dev/null || true
        fi
        sleep 5
    done
fi
