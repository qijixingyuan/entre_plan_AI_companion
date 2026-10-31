#!/usr/bin/env bash
# bp-harness 部署脚本
#
# 用法：
#   bash scripts/deploy.sh deploy              # 部署当前 commit
#   bash scripts/deploy.sh rollback <commit>   # 服务器回滚到指定 commit
#   bash scripts/deploy.sh status              # 查看线上状态与最近版本
#
# 关键约束（改本脚本前先读 DEV-GUIDE.md）：
#   1. 构建只在服务器做 —— 本机 npm run build 会被安全删除钩子拦（EPERM .next/trace）
#   2. 服务器命令前必须 export PATH=/www/server/nodejs/v20.18.0/bin:$PATH（默认 node 是 v18）
#   3. 打包必须 --exclude=./data，否则本机 db 会覆盖线上数据
#   4. 每次部署前自动备份数据库 + 保留上一个版本 commit

set -euo pipefail

SERVER="luoyu"
REMOTE_DIR="/www/wwwroot/bp-harness"
NODE_PATH="/www/server/nodejs/v20.18.0/bin"
PORT="3005"
SSH_KEY="${HOME}/.ssh/id_rsa"

cd "$(dirname "$0")/.."

blue()  { printf "\033[0;34m%s\033[0m\n" "$*"; }
green() { printf "\033[0;32m%s\033[0m\n" "$*"; }
red()   { printf "\033[0;31m%s\033[0m\n" "$*"; }

ensure_server_git() {
  # git 的 dubious ownership 检查：目录属主是 197609 而 git 以 root 运行，必须加白名单
  ssh "$SERVER" "git config --global --add safe.directory $REMOTE_DIR" 2>/dev/null || true
  if ! ssh "$SERVER" "test -d $REMOTE_DIR/.git" 2>/dev/null; then
    blue "→ 服务器首次初始化 git 仓库"
    ssh "$SERVER" "cd $REMOTE_DIR && git init -q && git config user.name 'bp-deploy' && git config user.email 'deploy@local' && \
      printf '%s\n' 'node_modules/' '.next/' 'out/' 'data/' '*.db' '*.db-wal' '*.db-shm' '.env*' 'backup/' '*.tar.gz' '*.bak.*' 'shots/' '*.log' '*-tmp.cjs' 'docs/*.docx' > .gitignore"
  fi
}

server_deploy() {
  local commit="$1"

  blue "→ 检查本地工作区"
  if ! git diff --quiet || ! git diff --cached --quiet; then
    red "✗ 本地有未提交的改动。请先 commit 再部署（版本管理的意义就在这）。"
    red "  如确认要丢弃：git checkout -- . && git clean -fd"
    exit 1
  fi

  blue "→ 打包源码（排除 data/node_modules/.next）"
  tar czf /tmp/bp-deploy.tar.gz \
    --exclude=node_modules --exclude=.next --exclude=out --exclude=nextout \
    --exclude=./data --exclude=backup --exclude=shots \
    --exclude=ck.txt --exclude=.git --exclude="*-tmp.cjs" \
    --exclude="*.tar.gz" --exclude="*.docx" .

  blue "→ 上传"
  scp /tmp/bp-deploy.tar.gz "$SERVER:/tmp/"

  blue "→ 服务器备份数据库与当前版本"
  ssh "$SERVER" "cd $REMOTE_DIR && \
    mkdir -p backup && \
    cp data/harness.db backup/harness-\$(date +\%Y\%m\%d-\%H\%M).db 2>/dev/null || true && \
    find backup -name 'harness-*.db' -mtime +30 -delete 2>/dev/null || true"

  blue "→ 解包并构建"
  ssh "$SERVER" "export PATH=$NODE_PATH:\$PATH
    cd $REMOTE_DIR
    tar xzf /tmp/bp-deploy.tar.gz
    rm -rf .next
    NODE_OPTIONS=--max-old-space-size=768 npx next build 2>&1 | tail -6"

  blue "→ 提交到服务器 git（记录版本）"
  ssh "$SERVER" "cd $REMOTE_DIR && \
    git add -A && \
    git commit -q -m 'deploy: $commit' --allow-empty && \
    git tag -f deploy-$(git rev-parse --short HEAD) -m '部署 $commit' 2>/dev/null || true"

  blue "→ 重启"
  ssh "$SERVER" "cd $REMOTE_DIR && pm2 restart bp-harness >/dev/null 2>&1 && sleep 5"

  blue "→ 冒烟测试"
  local ok=1
  for p in / /student/chat /student/archives /teacher/dashboard; do
    local code
    code=$(ssh "$SERVER" "curl -s -o /dev/null -w '%{http_code}' --connect-timeout 5 http://127.0.0.1:$PORT$p" || echo 000)
    if [ "$code" = "200" ]; then
      printf "   ✓ %s\n" "$p"
    else
      printf "   ✗ %s → HTTP %s\n" "$p" "$code"
      ok=0
    fi
  done

  if [ "$ok" = "1" ]; then
    green "✓ 部署成功 — $commit"
    echo
    echo "  线上：http://47.107.31.231:3005/"
    echo "  回滚：bash scripts/deploy.sh rollback <commit>"
  else
    red "✗ 冒烟测试未通过。线上可能不可用，请立即处理。"
    red "  服务器上可看：ssh $SERVER 'cd $REMOTE_DIR && pm2 logs bp-harness --lines 50'"
    exit 1
  fi
}

server_rollback() {
  local target="$1"
  blue "→ 服务器回滚到 $target"
  ssh "$SERVER" "export PATH=$NODE_PATH:\$PATH
    cd $REMOTE_DIR
    git checkout -q $target
    rm -rf .next
    NODE_OPTIONS=--max-old-space-size=768 npx next build 2>&1 | tail -4
    pm2 restart bp-harness >/dev/null 2>&1 && sleep 5
    echo '--- 线上版本 ---'
    git log --oneline -3"
  green "✓ 已回滚到 $target"
}

server_status() {
  ssh "$SERVER" "cd $REMOTE_DIR && \
    echo '--- pm2 ---' && pm2 list | grep bp-harness && \
    echo '--- 最近提交 ---' && git log --oneline -8 && \
    echo '--- 标签 ---' && git tag -l | tail -8 && \
    echo '--- 数据库 ---' && ls -lh data/harness.db && \
    echo '--- 备份 ---' && ls -lh backup/ 2>/dev/null | tail -5"
}

case "${1:-deploy}" in
  deploy)
    ensure_server_git
    server_deploy "$(git rev-parse --short HEAD)"
    ;;
  rollback)
    [ -n "${2:-}" ] || { red "用法：bash scripts/deploy.sh rollback <commit>"; exit 1; }
    ensure_server_git
    server_rollback "$2"
    ;;
  status)
    server_status
    ;;
  *)
    echo "用法："
    echo "  bash scripts/deploy.sh deploy              # 部署当前 commit"
    echo "  bash scripts/deploy.sh rollback <commit>   # 回滚"
    echo "  bash scripts/deploy.sh status              # 查看状态"
    exit 1
    ;;
esac
