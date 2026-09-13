import { useMemo, useState } from 'react';
import type { Note, SourceId } from '../domain/types';
import { MEMO_TIPS, SOURCES, SOURCE_MAP } from '../domain/knowledge';
import { addNote, addSeed, softDelete, updateNote } from '../store/store';
import { formatDate } from '../lib/time';
import { AutoText, Card, Empty, QuickAdd } from '../components/ui';

/**
 * 段階0「素材ストック」。
 * 思いついた瞬間に書けることを最優先にして、入力欄を画面のいちばん上に置く。
 */
export default function Notes({ projectId, notes, onToast }: {
  projectId: string; notes: Note[]; onToast: (m: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [filterSource, setFilterSource] = useState<SourceId | null>(null);
  const [scope, setScope] = useState<'project' | 'shared'>('project');
  const [editing, setEditing] = useState<string | null>(null);

  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of notes) for (const t of n.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14);
  }, [notes]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes.filter((n) => {
      if (filterSource && n.source !== filterSource) return false;
      if (!q) return true;
      return n.body.toLowerCase().includes(q) || n.tags.some((t) => t.toLowerCase().includes(q));
    });
  }, [notes, query, filterSource]);

  const week = notes.filter((n) => Date.now() - n.updatedAt < 7 * 24 * 60 * 60 * 1000).length;

  return (
    <>
      <Card title="いま思いついたことを書く" sub={`全 ${notes.length} 件 / 直近7日 ${week} 件`}>
        <QuickAdd
          multiline
          placeholder="遊んだもの・違和感・数字。1行でいい。#タグ も書ける（⌘/Ctrl+Enter で追加）"
          cta="メモする"
          onAdd={(text) => {
            const { body, tags } = extractTags(text);
            addNote({ body, tags, projectId: scope === 'shared' ? null : projectId, source: filterSource });
            onToast('メモしました');
          }}
        />
        <div className="row tight" style={{ marginTop: 8 }}>
          <button
            className="chip"
            aria-pressed={scope === 'project'}
            onClick={() => setScope('project')}
          >
            この企画
          </button>
          <button
            className="chip"
            aria-pressed={scope === 'shared'}
            onClick={() => setScope('shared')}
          >
            共通ネタ帳
          </button>
          <span className="tiny muted" style={{ marginLeft: 6 }}>
            {filterSource ? `出所: ${SOURCE_MAP[filterSource].name} を付けて保存` : '出所は下のフィルタで選ぶと付きます'}
          </span>
        </div>
        <ul className="tiny muted" style={{ margin: '10px 0 0', paddingLeft: 18 }}>
          {MEMO_TIPS.map((t) => <li key={t}>{t}</li>)}
        </ul>
      </Card>

      <Card title="探す">
        <input
          type="text"
          placeholder="本文・タグで検索"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="row tight" style={{ marginTop: 9 }}>
          <button className="chip" aria-pressed={filterSource === null} onClick={() => setFilterSource(null)}>
            すべて
          </button>
          {SOURCES.map((s) => (
            <button
              key={s.id}
              className="chip"
              aria-pressed={filterSource === s.id}
              onClick={() => setFilterSource(filterSource === s.id ? null : s.id)}
              title={s.hint}
            >
              {s.name}
            </button>
          ))}
        </div>
        {tags.length > 0 && (
          <div className="row tight" style={{ marginTop: 8 }}>
            {tags.map(([t, n]) => (
              <button key={t} className="chip" onClick={() => setQuery(t)}>#{t} <span className="muted">{n}</span></button>
            ))}
          </div>
        )}
      </Card>

      <Card title={`メモ ${shown.length} 件`}>
        {shown.length === 0 ? (
          <Empty>まだありません。ネタ帳が枯れていると、種出しで同じ出所ばかり掘ることになります。</Empty>
        ) : (
          <div className="list">
            {shown.map((n) => (
              <div key={n.id} className="item">
                <div className="body">
                  {editing === n.id ? (
                    <AutoText
                      value={n.body}
                      rows={4}
                      onChange={(v) => updateNote(n.id, { body: v })}
                    />
                  ) : (
                    <div onDoubleClick={() => setEditing(n.id)}>{n.body}</div>
                  )}
                  <div className="row tight" style={{ marginTop: 6 }}>
                    <span className="tiny muted">{formatDate(n.updatedAt)}</span>
                    {n.projectId === null && <span className="pill">共通</span>}
                    {n.source && <span className="pill">{SOURCE_MAP[n.source].name}</span>}
                    {n.tags.map((t) => <span key={t} className="pill">#{t}</span>)}
                  </div>
                </div>
                <div className="col" style={{ gap: 4 }}>
                  <button
                    className="sm ghost"
                    onClick={() => setEditing(editing === n.id ? null : n.id)}
                  >
                    {editing === n.id ? '完了' : '編集'}
                  </button>
                  <button
                    className="sm ghost"
                    title="このメモを種として段階1へ送る"
                    onClick={() => { addSeed(projectId, n.body, n.source); onToast('種に送りました'); }}
                  >
                    種へ
                  </button>
                  <button className="sm ghost danger" onClick={() => softDelete(n.id)}>削除</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

/** 本文中の #タグ を抜き出す。本文からは取り除かない（文脈が壊れるため）。 */
export function extractTags(text: string): { body: string; tags: string[] } {
  const tags = [...text.matchAll(/#([^\s#]+)/g)].map((m) => m[1] as string);
  return { body: text.trim(), tags: [...new Set(tags)] };
}
