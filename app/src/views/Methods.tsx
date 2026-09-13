import { useState } from 'react';
import { METHOD_ROUTING } from '../domain/knowledge';
import type { AppSnapshot } from '../store/store';
import MindMap from './methods/MindMap';
import Mandala from './methods/Mandala';
import Scamper from './methods/Scamper';
import Reversal from './methods/Reversal';
import TriMemo from './methods/TriMemo';
import Journey from './methods/Journey';
import Analogy from './methods/Analogy';
import { Card } from '../components/ui';

const TOOLS = [
  { id: 'mindmap', name: 'マインドマップ', sub: '発散と構造化。第1階層は8軸固定', when: 'ゼロから発想したい' },
  { id: 'mandala', name: 'マンダラート', sub: '3×3で漏れを潰す', when: '抜け漏れが不安' },
  { id: 'scamper', name: 'SCAMPER', sub: '既存物を7操作で改造', when: '既存タイトルの改善案' },
  { id: 'reversal', name: '逆転発想 / 問題逆転', sub: '常識の反転から成立条件を探す', when: '企画が平凡に感じる' },
  { id: 'trimemo', name: '三角メモ', sub: 'AとBの掛け合わせ', when: '組み合わせで飛ばしたい' },
  { id: 'journey', name: '体験の時間割', sub: '感情の折れ線を描く', when: '面白さを他人に説明できない' },
  { id: 'analogy', name: 'アナロジー移植', sub: '構造だけ抜いて別ジャンルへ', when: '既視感を避けたい' },
] as const;

type ToolKey = (typeof TOOLS)[number]['id'];

export default function Methods({ projectId, snapshot }: { projectId: string; snapshot: AppSnapshot }) {
  const [tool, setTool] = useState<ToolKey>('mindmap');

  return (
    <>
      <Card title="思考ツール" sub="発散したら必ず収束させる。KJ法は「種出し」画面にあります">
        <div className="row tight">
          {TOOLS.map((t) => (
            <button key={t.id} className="chip" aria-pressed={tool === t.id} onClick={() => setTool(t.id)} title={t.sub}>
              {t.name}
            </button>
          ))}
        </div>
        <table className="data" style={{ marginTop: 12 }}>
          <thead><tr><th>状況</th><th>使う手法</th></tr></thead>
          <tbody>
            {METHOD_ROUTING.map((r) => (
              <tr key={r.situation}><td>{r.situation}</td><td>{r.methods}</td></tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div style={{ marginTop: 14 }}>
        {tool === 'mindmap' && <MindMap projectId={projectId} snapshot={snapshot} />}
        {tool === 'mandala' && <Mandala projectId={projectId} snapshot={snapshot} />}
        {tool === 'scamper' && <Scamper projectId={projectId} snapshot={snapshot} />}
        {tool === 'reversal' && <Reversal projectId={projectId} snapshot={snapshot} />}
        {tool === 'trimemo' && <TriMemo projectId={projectId} snapshot={snapshot} />}
        {tool === 'journey' && <Journey projectId={projectId} snapshot={snapshot} />}
        {tool === 'analogy' && <Analogy projectId={projectId} snapshot={snapshot} />}
      </div>
    </>
  );
}
