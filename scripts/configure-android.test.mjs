import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ensureCleartextTraffic } from './configure-android.mjs';

const manifest = (extra = '') => `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <application
        android:allowBackup="true"${extra}
        android:label="@string/app_name">
    </application>

    <uses-permission android:name="android.permission.INTERNET" />
</manifest>
`;

describe('ensureCleartextTraffic', () => {
  test('未設定なら平文HTTPを許可する属性を足す', () => {
    const { xml, changed } = ensureCleartextTraffic(manifest());
    assert.equal(changed, true);
    assert.match(xml, /android:usesCleartextTraffic="true"/);
  });

  test('既存の属性は壊さない', () => {
    const { xml } = ensureCleartextTraffic(manifest());
    assert.match(xml, /android:allowBackup="true"/);
    assert.match(xml, /android:label="@string\/app_name"/);
    assert.match(xml, /android\.permission\.INTERNET/);
  });

  test('2回実行しても増えない', () => {
    const once = ensureCleartextTraffic(manifest()).xml;
    const twice = ensureCleartextTraffic(once);
    assert.equal(twice.changed, false);
    assert.equal(twice.xml, once);
    assert.equal(once.match(/usesCleartextTraffic/g).length, 1);
  });

  test('すでに false で入っていても書き換えない (利用者の意思を尊重)', () => {
    const src = manifest('\n        android:usesCleartextTraffic="false"');
    const { xml, changed } = ensureCleartextTraffic(src);
    assert.equal(changed, false);
    assert.equal(xml, src);
  });

  test('application タグが無ければエラーにする', () => {
    assert.throws(() => ensureCleartextTraffic('<manifest></manifest>'), /application/);
  });
});
