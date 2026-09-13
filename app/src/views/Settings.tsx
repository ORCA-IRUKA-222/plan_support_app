import { useMemo, useRef, useState } from 'react';
import { emptyState, type PersistedState } from '../store/persist';
import { replaceAll, setSyncSettings, softDelete, useApp, selectProjects } from '../store/store';
import { resetSyncCursor, syncNow, type SyncResult } from '../store/sync';
import { download } from '../lib/export';
import { formatDate, today } from '../lib/time';
import { AutoInput, Card, Check, Empty } from '../components/ui';

export default function Settings({ onToast }: { onToast: (m: string) => void }) {
  const snapshot = useApp((s) => s);
  const projects = useMemo(() => selectProjects(snapshot), [snapshot]);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const recordCount = Object.values(snapshot.records).filter((r) => !r.deleted).length;

  const run = async () => {
    setBusy(true);
    const r = await syncNow();
    setBusy(false);
    setResult(r);
    onToast(r.message);
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
      <Card title="端末間の同期" sub="PC と Android で同じ合言葉を設定すると、内容が共有されます">
        <p className="hint">
          データはまず端末内に保存され、オフラインでも使えます。同期サーバーを設定すると、
          変更のあったぶんだけを送受信して他の端末と揃えます。同じ項目を別々の端末で編集した場合は、
          <b>あとから保存されたほうが残ります</b>。
        </p>
        <div className="grid two">
          <label className="field">
            <span className="lbl">同期サーバーの URL</span>
            <span className="tiny muted">例: http://192.168.1.10:8787 （自分で立てたサーバー）</span>
            <AutoInput
              type="url"
              value={snapshot.sync.serverUrl}
              placeholder="http://192.168.1.10:8787"
              onChange={(v) => setSyncSettings({ serverUrl: v })}
            />
          </label>
          <label className="field">
            <span className="lbl">合言葉（ワークスペースキー）</span>
            <span className="tiny muted">8文字以上。全端末で同じ文字列にします</span>
            <AutoInput
              type="password"
              value={snapshot.sync.workspaceKey}
              onChange={(v) => setSyncSettings({ workspaceKey: v })}
            />
          </label>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="accent" onClick={() => void run()} disabled={busy}>
            {busy ? '同期中…' : 'いま同期する'}
          </button>
          <Check checked={snapshot.sync.autoSync} onChange={(v) => setSyncSettings({ autoSync: v })}>
            自動で同期する（起動時・画面復帰時・変更の30秒後）
          </Check>
          <button
            className="ghost"
            onClick={() => { resetSyncCursor(); onToast('次回はすべて取り直します'); }}
          >
            同期状態をリセット
          </button>
        </div>
        {result && (
          <p className={`hint${result.ok ? '' : ' strong'}`} style={{ marginTop: 10, marginBottom: 0 }}>
            {formatDate(result.at)} — {result.message}
          </p>
        )}
      </Card>

      <Card title="バックアップ" sub={`${recordCount} 件のデータ`}>
        <p className="hint">
          同期サーバーを使わない場合も、この JSON を書き出して別の端末で読み込めば移せます。
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

      <Card title="この段階で立ち止まったら">
        <p className="hint" style={{ marginBottom: 0 }}>
          企画書は「書く作業」ではなく「収束させる作業」です。段階ごとにゲートを決めておくと手戻りが減ります。
          迷ったら削る。核が一文で言えないうちは、企画書を書き始めないでください。
        </p>
      </Card>
    </>
  );
}
