#!/bin/zsh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"
ANDROID_SDK_ROOT_DEFAULT="$HOME/Library/Android/sdk"
ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_SDK_ROOT_DEFAULT}"
ANDROID_HOME="${ANDROID_HOME:-$ANDROID_SDK_ROOT}"
JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home}"
AVD_NAME="${AVD_NAME:-BeihuMama_API_34}"
METRO_PORT="${METRO_PORT:-8081}"
PATH="$JAVA_HOME/bin:$ANDROID_SDK_ROOT/platform-tools:$PATH"

EMULATOR_BIN="$ANDROID_SDK_ROOT/emulator/emulator"
ADB_BIN="$ANDROID_SDK_ROOT/platform-tools/adb"
METRO_LOG="$PROJECT_DIR/.metro-android.log"
EMULATOR_LOG="$PROJECT_DIR/.emulator-android.log"

if [[ ! -x "$EMULATOR_BIN" ]]; then
  echo "未找到 emulator: $EMULATOR_BIN"
  exit 1
fi

if [[ ! -x "$ADB_BIN" ]]; then
  echo "未找到 adb: $ADB_BIN"
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "未找到 npm，请先安装 Node.js"
  exit 1
fi

start_emulator() {
  if "$ADB_BIN" devices | grep -q '^emulator-[0-9]\+[[:space:]]\+device$'; then
    echo "模拟器已在线，跳过启动"
    return
  fi

  echo "启动模拟器 $AVD_NAME ..."
  nohup "$EMULATOR_BIN" "@$AVD_NAME" -netdelay none -netspeed full >"$EMULATOR_LOG" 2>&1 &

  echo "等待模拟器接入 adb ..."
  "$ADB_BIN" wait-for-device >/dev/null 2>&1

  local boot=""
  for _ in {1..90}; do
    boot="$("$ADB_BIN" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')"
    if [[ "$boot" == "1" ]]; then
      echo "模拟器已完成启动"
      return
    fi
    sleep 2
  done

  echo "模拟器未在预期时间内完成启动，请查看 $EMULATOR_LOG"
  exit 1
}

start_metro() {
  if curl -fsS "http://127.0.0.1:${METRO_PORT}/status" >/dev/null 2>&1; then
    echo "Metro 已在 ${METRO_PORT} 端口运行"
    return
  fi

  echo "启动 Metro ..."
  (
    cd "$PROJECT_DIR"
    nohup env \
      JAVA_HOME="$JAVA_HOME" \
      ANDROID_HOME="$ANDROID_HOME" \
      ANDROID_SDK_ROOT="$ANDROID_SDK_ROOT" \
      PATH="$PATH" \
      npm run start -- --reset-cache >"$METRO_LOG" 2>&1 &
  )

  for _ in {1..60}; do
    if curl -fsS "http://127.0.0.1:${METRO_PORT}/status" >/dev/null 2>&1; then
      echo "Metro 已就绪"
      return
    fi
    sleep 1
  done

  echo "Metro 启动失败，请查看 $METRO_LOG"
  exit 1
}

install_app() {
  echo "安装并启动 Android App ..."
  cd "$PROJECT_DIR"
  env \
    JAVA_HOME="$JAVA_HOME" \
    ANDROID_HOME="$ANDROID_HOME" \
    ANDROID_SDK_ROOT="$ANDROID_SDK_ROOT" \
    PATH="$PATH" \
    npm run android
}

start_emulator
start_metro
install_app
