#!/usr/bin/env bash
# Android APK をビルドする。
#   前提: JDK 21 と Android SDK (ANDROID_HOME または ANDROID_SDK_ROOT)。
#   使い方: ./scripts/build-apk.sh [debug|release]
set -euo pipefail

VARIANT="${1:-debug}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# 時間のかかる処理に入る前に引数を検証する。
case "$VARIANT" in
  debug|release) ;;
  *) echo "不明なバリアント: $VARIANT (debug か release を指定してください)" >&2; exit 1 ;;
esac

if [[ -z "${ANDROID_HOME:-}" && -z "${ANDROID_SDK_ROOT:-}" ]]; then
  echo "エラー: ANDROID_HOME または ANDROID_SDK_ROOT が設定されていません。" >&2
  echo "  Android Studio を入れるか、commandline-tools から SDK を導入してください。" >&2
  echo "  手元に SDK がない場合は GitHub Actions の Android APK ワークフローを使えます。" >&2
  exit 1
fi

cd "$ROOT/app"

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
if [[ "$VARIANT" == "debug" ]]; then
  ./gradlew --no-daemon assembleDebug
else
  ./gradlew --no-daemon assembleRelease
fi

APK="$(find "app/build/outputs/apk/$VARIANT" -name '*.apk' -print -quit 2>/dev/null || true)"
if [[ -z "$APK" ]]; then
  echo "エラー: APK が見つかりません。Gradle の出力を確認してください。" >&2
  exit 1
fi

echo
echo "完成: $PWD/$APK"
ls -lh "$APK"
if [[ "$VARIANT" == "release" ]]; then
  echo
  echo "注意: release は未署名です。そのままではインストールできません。"
  echo "      apksigner で署名するか、動作確認だけなら debug を使ってください。"
else
  echo "端末に転送してタップするか、adb install \"$APK\" を実行してください。"
fi
