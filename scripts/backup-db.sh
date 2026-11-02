#!/usr/bin/env bash
# bp-harness 数据库每日自动备份
#
# 背景（2026-11-02 落地，架构文档 §6 P1-6）：
#   学生一填数据就有价值。数据库挂了，这学期的过程分全丢，没有第二次机会重来。
#   原先只在 deploy.sh 部署时手动备份一次 —— 平时完全不备份。
#
# 做法：
#   1. 用 sqlite3 的 .backup（不是 cp）—— cp 一个正在写入的 WAL 数据库可能拿到损坏快照
#   2. 文件名带时间戳，永远不覆盖旧备份
#   3. 保留 30 天，超期自动清理
#   4. 每次备份后校验完整性，损坏则报警（写到日志）
#
# 用法：
#   bash scripts/backup-db.sh              # 手动跑一次
#   crontab: 17 3 * * * /www/wwwroot/bp-harness/scripts/backup-db.sh
#
# 退出码：0 = 成功；非 0 = 失败（crontab 会把输出写进日志）

set -uo pipefail

REMOTE_DIR="/www/wwwroot/bp-harness"
DB_PATH="$REMOTE_DIR/data/harness.db"
BACKUP_DIR="$REMOTE_DIR/backup"
KEEP_DAYS=30
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_FILE="$BACKUP_DIR/harness-$STAMP.db"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

if [ ! -f "$DB_PATH" ]; then
  log "✗ 数据库不存在：$DB_PATH"
  exit 1
fi

mkdir -p "$BACKUP_DIR"

# sqlite3 .backup 做一致性快照；若系统无 sqlite3 命令，退回 cp（见下方说明）
if command -v sqlite3 >/dev/null 2>&1; then
  if sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'" 2>/dev/null && [ -s "$BACKUP_FILE" ]; then
    log "✓ 一致性快照完成（sqlite3 .backup）：$BACKUP_FILE"
  else
    log "✗ sqlite3 .backup 失败，尝试 cp 兜底"
    cp "$DB_PATH" "$BACKUP_FILE" 2>/dev/null || { log "✗ 备份失败：cp 也失败了"; exit 1; }
    log "✓ cp 兜底完成：$BACKUP_FILE"
  fi
else
  # 没有 sqlite3 时，WAL 模式下 cp 需连同 -wal 一起拷，否则可能拿到不完整快照
  cp "$DB_PATH" "$BACKUP_FILE" 2>/dev/null || { log "✗ 备份失败"; exit 1; }
  [ -f "$DB_PATH-wal" ] && cp "$DB_PATH-wal" "$BACKUP_FILE-wal" 2>/dev/null
  log "✓ 备份完成（cp 模式，含 WAL）：$BACKUP_FILE"
fi

# 校验：备份文件必须能作为数据库打开
if command -v sqlite3 >/dev/null 2>&1; then
  if sqlite3 "$BACKUP_FILE" "PRAGMA integrity_check;" 2>/dev/null | grep -q "ok"; then
    log "✓ 完整性校验通过"
  else
    log "✗ 完整性校验失败！备份可能损坏，请立即人工检查：$BACKUP_FILE"
    exit 2
  fi
fi

SIZE="$(du -h "$BACKUP_FILE" 2>/dev/null | cut -f1)"
log "备份大小：${SIZE:-未知}"

# 清理超期备份（只删本脚本产生的 harness-*.db，保留 30 天）
DELETED="$(find "$BACKUP_DIR" -name 'harness-*.db' -mtime +$KEEP_DAYS -delete 2>/dev/null; find "$BACKUP_DIR" -name 'harness-*-wal' -mtime +$KEEP_DAYS -delete 2>/dev/null; echo ok)"
REMAIN="$(find "$BACKUP_DIR" -name 'harness-*.db' 2>/dev/null | wc -l)"
log "✓ 清理完成（保留 $KEEP_DAYS 天），当前备份数：$REMAIN"

log "备份任务结束"
exit 0
