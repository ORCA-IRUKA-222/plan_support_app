import { useMemo, useRef, useState } from 'react';
import { emptyState, type PersistedState } from '../store/persist';
import { replaceAll, setSyncSettings, softDelete, useApp, selectProjects } from '../store/store';
import { resetSyncCursor, syncNow, type SyncResult } from '../store/sync';
import { diagnose, type Diagnosis } from '../store/gist';
import { download } from '../lib/export';
import { offlineCapability } from '../lib/offline';
import { formatDate, today } from '../lib/time';
import { AutoInput, Card, Check, Empty } from '../components/ui';

/** ビルド日時を読みやすく整える。壊れていたらそのまま出す。 */
function formatBuildTime(iso: string): string {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? iso : formatDate(t);
}

export default function Settings({ onToast }: { onToast: (m: string) => void }) {
  const snapshot = useApp((s) => s);
  const projects = useMemo(() => selectProjects(snapshot), [snapshot]);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const recordCount = Object.values(snapshot.records).filter((r) => !r.deleted).length;
  const offline = useMemo(() => offlineCapability(), []);

  const run = async () => {
    setBusy(true);
    setDiagnosis(null);
    const r = await syncNow({ allowCreate: true });
    // Gist を新しく作った場合は、その ID を設定に書き戻す。
    if (r.createdGistId) setSyncSettings({ gistId: r.createdGistId });
    setBusy(false);
    setResult(r);
    onToast(r.message);
  };

  const test = async () => {
    setBusy(true);
    setResult(null);
    const d = await diagnose(snapshot.sync.token);
    setBusy(false);
    setDiagnosis(d);
    onToast(d.ok ? '接続できました' : '接続できませんでした');
  };

  const importFile = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as PersistedState;
      if (parsed.version !== 1 || typeof parsed.records !== 'object') throw new Error('形式が違います');
      if (!confirm(`いまの ${recordCount} 件を、ファイルの内容で置き換えます。よろしいですか?`)) return;
      replaceAll({ ...emptyState(), ...parsed, sync: snapshot.sync });
      resetSyncCursor();
      onToast('復元しました');
    } catch (err) {
      onToast(`読み込めません: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <>
      <Card title="オフラインで起動できるか" sub={offline.available ? '使えます' : '使えません'}>
        <p className={`hint${offline.available ? '' : ' strong'}`} style={{ marginBottom: 0 }}>
          {offline.reason}
        </p>
      </Card>

      <Card title="端末間の同期（GitHub Gist）" sub="自前のサーバーは不要。外出先からでも揃います">
        <p className="hint">
          非公開の Gist を1つ作り、そこに読み書きして PC とスマホを揃えます。
          <b>トークンはこの端末の中だけに保存され、GitHub 以外には送信されません。</b>
          Gist に書き込むデータにもトークンは含まれません。
        </p>

        <div className="grid two">
          <label className="field">
            <span className="lbl">アクセストークン（gist 権限）</span>
            <span className="tiny muted">
              <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer">
                github.com/settings/tokens
              </a>
              {' '}→ Generate new token <b>(classic)</b> → <b>gist</b> だけにチェック
            </span>
            <AutoInput
              type="password"
              value={snapshot.sync.token}
              placeholder="ghp_..."
              onChange={(v) => setSyncSettings({ token: v.trim() })}
            />
          </label>

          <label className="field">
            <span className="lbl">Gist ID</span>
            <span className="tiny muted">
              1台目は<b>空のまま</b>「いま同期する」を押すと自動で作られます。2台目はその ID を入れてください
            </span>
            <AutoInput
              value={snapshot.sync.gistId}
              placeholder="（空のままで自動作成）"
              onChange={(v) => setSyncSettings({ gistId: v.trim() })}
            />
          </label>
        </div>

        <div className="row" style={{ marginTop: 10 }}>
          <button className="accent" onClick={() => void run()} disabled={busy}>
            {busy ? '同期中…' : 'いま同期する'}
          </button>
          <button onClick={() => void test()} disabled={busy}>接続をテスト</button>
          <Check checked={snapshot.sync.auto} onChange={(v) => setSyncSettings({ auto: v })}>
            自動で同期する（起動時・画面復帰時・変更の30秒後・表示中は60秒ごと）
          </Check>
        </div>

        {snapshot.sync.gistId && (
          <p className="tiny muted" style={{ marginTop: 8, marginBottom: 0 }}>
            この Gist:{' '}
            <a href={`https://gist.github.com/${snapshot.sync.gistId}`} target="_blank" rel="noreferrer">
              gist.github.com/{snapshot.sync.gistId}
            </a>
          </p>
        )}

        {result && (
          <p className={`hint${result.ok ? '' : ' strong'}`} style={{ marginTop: 10, marginBottom: 0, whiteSpace: 'pre-wrap' }}>
            {formatDate(result.at)} — {result.message}
          </p>
        )}
        {diagnosis && (
          <p className={`hint${diagnosis.ok ? '' : ' strong'}`} style={{ marginTop: 10, marginBottom: 0, whiteSpace: 'pre-wrap' }}>
            {diagnosis.message}
          </p>
        )}

        <details style={{ marginTop: 12 }}>
          <summary className="tiny muted" style={{ cursor: 'pointer' }}>2台目の設定と注意点</summary>
          <table className="data" style={{ marginTop: 8 }}>
            <thead><tr><th>端末</th><th>アクセストークン</th><th>Gist ID</th></tr></thead>
            <tbody>
              <tr><td>1台目</td><td>作ったトークン</td><td>空のまま（自動で入る）</td></tr>
              <tr><td>2台目</td><td>1台目と同じトークン</td><td>1台目に表示された ID</td></tr>
            </tbody>
          </table>
          <ul className="tiny muted" style={{ marginTop: 8, paddingLeft: 18 }}>
            <li>Fine-grained token は Gist に対応していません。必ず <b>classic</b> で作ってください</li>
            <li>権限は <b>gist だけ</b>に絞ってください。共用の PC では設定しないことをおすすめします</li>
            <li>作られる Gist は secret（非公開）ですが、URL を知っている人は閲覧できます</li>
            <li>同じ項目を2台で同時に直した場合は、あとから保存した方が残ります</li>
          </ul>
        </details>
      </Card>

      <Card title="バックアップ" sub={`${recordCount} 件のデータ`}>
        <p className="hint">
          GitHub を使わない場合も、この JSON を書き出して別の端末で読み込めば移せます。
        </p>
        <div className="row">
          <button
            onClick={() => {
              const { storageError: _drop, ...data } = snapshot;
              void _drop;
              download(`企画伴走_バックアップ_${today()}.json`, JSON.stringify(data, null, 2), 'application/json');
            }}
          >
            書き出す（JSON）
          </button>
          <button onClick={() => fileRef.current?.click()}>読み込む（置き換え）</button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importFile(f);
              e.target.value = '';
            }}
          />
        </div>
      </Card>

      <Card title="企画の管理">
        {projects.length === 0 ? (
          <Empty>企画がありません。</Empty>
        ) : (
          <div className="list">
            {projects.map((p) => (
              <div key={p.id} className="item">
                <div className="body">
                  <b style={{ fontSize: 13.5 }}>{p.title}</b>
                  {p.archived && <span className="pill" style={{ marginLeft: 6 }}>アーカイブ済み</span>}
                  <div className="tiny muted">{p.oneLiner || '核の一行なし'} — 更新 {formatDate(p.updatedAt)}</div>
                </div>
                <button
                  className="ghost sm danger"
                  onClick={() => {
                    if (confirm(`「${p.title}」を削除します。よろしいですか?`)) softDelete(p.id);
                  }}
                >
                  削除
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="いま動かしている版" sub="「直したはずなのに変わらない」ときの確認用">
        <table className="data">
          <tbody>
            <tr>
              <th style={{ width: 130 }}>コミット</th>
              <td style={{ fontFamily: 'ui-monospace, monospace' }}>{__BUILD_INFO__.commit}</td>
            </tr>
            <tr>
              <th>ビルド日時</th>
              <td>{formatBuildTime(__BUILD_INFO__.builtAt)}</td>
            </tr>
          </tbody>
        </table>
        <p className="hint" style={{ marginTop: 10, marginBottom: 0 }}>
          ここが古いままなら、PC 側でまだ新しいコードを取り込んでいません。
          リポジトリのフォルダで <code>git pull</code> → <code>npm install</code> →{' '}
          <code>npm run build</code> を実行し、サーバーを起動し直してください。
          それでも画面が変わらないときは、ブラウザで <b>Ctrl + Shift + R</b>（強制再読み込み）を押してください。
        </p>
      </Card>

      <Card title="この段階で立ち止まったら">
        <p className="hint" style={{ marginBottom: 0 }}>
          企画書は「書く作業」ではなく「収束させる作業」です。段階ごとにゲートを決めておくと手戻りが減ります。
          迷ったら削る。核が一文で言えないうちは、企画書を書き始めないでください。
        </p>
      </Card>
    </>
  );
}
