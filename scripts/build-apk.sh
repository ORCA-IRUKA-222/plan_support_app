#!/usr/bin/env bash
# Android APK をビルドする。
#   前提: JDK 21 と Android SDK (ANDROID_HOME または ANDROID_SDK_ROOT)。
#   使い方: ./scripts/build-apk.sh [debug|release]
set -euo pipefail

VARIANT="${1:-debug}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/app"

if [[ -z "${ANDROID_HOME:-}${ANDROID_SDK_ROOT:-}" ]]; then
  echo "エラー: ANDROID_HOME または ANDROID_SDK_ROOT が設定されていません。" >&2
  echo "  Android Studio を入れるか、commandline-tools から SDK を導入してください。" >&2
  exit 1
fi

echo "==> フロントエンドをビルド"
npm run build

# android/ は capacitor.config.ts から再生成できるのでリポジトリには含めていない。
if [[ ! -d android ]]; then
  echo "==> Android プロジェクトを生成"
  npx cap add android
fi

echo "==> ビルド結果を Android プロジェクトへ同期"
npx cap sync android

echo "==> Gradle で APK をビルド ($VARIANT)"
cd android
chmod +x ./gradlew
case "$VARIANT" in
  debug)   ./gradlew --no-daemon assembleDebug ;;
  release) ./gradlew --no-daemon assembleRelease ;;
  *) echo "不明なバリアント: $VARIANT (debug か release)" >&2; exit 1 ;;
esac

APK="$(find app/build/outputs/apk -name '*.apk' -print -quit)"
echo
echo "完成: $ROOT/app/android/$APK"
echo "端末に転送してインストールするか、adb install \"$APK\" を実行してください。"
