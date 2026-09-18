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
  { id: 'mindmap', name: 'マインドマップ', sub: '中心から8軸に放射。枝どうしを線でつなげる' },
  { id: 'mandala', name: 'マンダラート', sub: '9×9＝81マスを埋めて漏れを潰す' },
  { id: 'scamper', name: 'SCAMPER', sub: '対象を中心に7操作を輪で当てる' },
  { id: 'reversal', name: '逆転発想 / 問題逆転', sub: '常識と逆転を向かい合わせ、成立条件を詰める' },
  { id: 'trimemo', name: '三角メモ', sub: '2つの三角に言葉を置いて掛け合わせる' },
  { id: 'journey', name: '体験の時間割', sub: '感情の折れ線を描いて山を探す' },
  { id: 'analogy', name: 'アナロジー移植', sub: '表層を捨て、構造だけを別ジャンルへ移す' },
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
