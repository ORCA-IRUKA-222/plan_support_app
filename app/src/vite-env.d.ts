/// <reference types="vite/client" />

/** ビルド時に vite.config.ts が埋め込む版情報。 */
declare const __BUILD_INFO__: {
  /** ビルドした時点の git コミット (短縮)。取得できなければ 'unknown'。 */
  commit: string;
  /** ビルド日時 (ISO 8601)。 */
  builtAt: string;
};
