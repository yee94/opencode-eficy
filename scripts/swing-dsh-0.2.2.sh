#!/bin/bash
# 等待 DeepSeek Harness 退出后，把 0.2.2-rc.1 的 app 换进 /Applications，并重新打开。
set -euo pipefail
APP="/Applications/DeepSeek Harness.app"
NEW="/tmp/dsh-upgrade/unpacked/DeepSeek Harness.app"
BACKUP="/tmp/dsh-upgrade/backup/DeepSeek Harness.app"
LOG="/tmp/dsh-upgrade/swap.log"
exec >>"$LOG" 2>&1

echo "[$(date)] waiting for DeepSeek Harness to quit (timeout ${TIMEOUT:-900}s)"
deadline=$((SECONDS + ${TIMEOUT:-900}))
while pgrep -f "/Applications/DeepSeek Harness.app/Contents/" >/dev/null 2>&1; do
  if [ "$SECONDS" -ge "$deadline" ]; then
    echo "[$(date)] timeout; nothing changed"
    exit 1
  fi
  sleep 2
done

echo "[$(date)] app exited; swapping"
[ -d "$NEW" ] || { echo "missing new app: $NEW"; exit 1; }
mkdir -p "$(dirname "$BACKUP")"
rm -rf "$BACKUP"
mv "$APP" "$BACKUP"
if ! mv "$NEW" "$APP"; then
  echo "[$(date)] move failed; restoring old app"
  mv "$BACKUP" "$APP"
  exit 1
fi
xattr -dr com.apple.quarantine "$APP" 2>/dev/null || true
if codesign --verify --deep --strict "$APP"; then
  echo "[$(date)] signature ok"
else
  echo "[$(date)] WARNING signature check failed"
fi
echo "[$(date)] old app backed up at $BACKUP"

echo "[$(date)] installing @eficy/dsh-plugin into profile desktop"
if "$APP/Contents/Resources/runtime/cli/bin/dsh" plugin --profile desktop add "/Users/yee.wang/Code/selfs/opencode-eficy/packages/dsh-plugin" > /tmp/dsh-upgrade/install.log 2>&1; then
  echo "[$(date)] plugin install succeeded"
else
  echo "[$(date)] plugin install FAILED - see /tmp/dsh-upgrade/install.log"
fi

open "$APP"
echo "[$(date)] relaunched"
