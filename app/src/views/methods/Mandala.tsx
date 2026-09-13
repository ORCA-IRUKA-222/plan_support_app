import { useState } from 'react';
import type { MandalaData } from '../../domain/types';
import type { AppSnapshot } from '../../store/store';
import { saveTool, selectTool } from '../../store/store';
import { AutoText, Card } from '../../components/ui';

/**
 * マンダラート。枠が固定されているため強制的に埋めさせる力がある。
 * 「8個埋めないといけない」制約が、7個目・8個目で予想外のアイデアを出させる。
 */
export default function Mandala({ projectId, snapshot }: { projectId: string; snapshot: AppSnapshot }) {
  const data = selectTool<MandalaData>(snapshot, projectId, 'mandala');
  const save = (d: MandalaData) => saveTool(projectId, 'mandala', d);
  const [open, setOpen] = useState<number | null>(null);

  const filled = data.cells.filter((c) => c.trim()).length;
  const subFilled = (i: number) => (data.sub[i] ?? []).filter((c) => c.trim()).length;

  const setCell = (i: number, v: string) => {
    const cells = data.cells.slice();
    cells[i] = v;
    save({ ...data, cells });
  };

  const setSub = (i: number, j: number, v: string) => {
    const sub = data.sub.map((row) => row.slice());
    const row = sub[i] ?? Array<string>(8).fill('');
    row[j] = v;
    sub[i] = row;
    save({ ...data, sub });
  };

  // 3×3 のうち中央 (index 4) が親、それ以外に 8 マスを配置する。
  const layout = (cells: string[], onChange: (idx: number, v: string) => void, center: React.ReactNode) =>
    Array.from({ length: 9 }, (_, pos) => {
      if (pos === 4) return <div key="c" className="center">{center}</div>;
      const idx = pos < 4 ? pos : pos - 1;
      return (
        <AutoText
          key={idx}
          rows={2}
          value={cells[idx] ?? ''}
          placeholder={`${idx + 1}`}
          onChange={(v) => onChange(idx, v)}
        />
      );
    });

  return (
    <>
      <Card title="マンダラート" sub={`中央の核 + 周囲8マス（${filled} / 8 埋まっています）`}>
        <p className="hint">
          マインドマップが発散向きなのに対し、こちらは枠が固定されているため強制的に埋めさせる力があります。
          7個目・8個目で予想外のアイデアが出ます。マスをクリックすると、そのマスをさらに3×3へ展開できます。
        </p>
        <div className="mandala" style={{ maxWidth: 560 }}>
          {layout(data.cells, setCell,
            <AutoText rows={2} value={data.center} placeholder="核" onChange={(v) => save({ ...data, center: v })} />,
          )}
        </div>
        <div className="row tight" style={{ marginTop: 10 }}>
          {data.cells.map((c, i) => (
            <button
              key={i}
              className="chip"
              aria-pressed={open === i}
              disabled={!c.trim()}
              onClick={() => setOpen(open === i ? null : i)}
            >
              {c.trim() ? `${i + 1}. ${c.slice(0, 10)}` : `${i + 1}. （空）`}
              <span className="muted">{subFilled(i)}/8</span>
            </button>
          ))}
        </div>
      </Card>

      {open !== null && (
        <Card
          title={`展開: ${data.cells[open] || `マス ${open + 1}`}`}
          sub={`${subFilled(open)} / 8`}
          actions={<button className="sm ghost" onClick={() => setOpen(null)}>閉じる</button>}
        >
          <div className="mandala" style={{ maxWidth: 560 }}>
            {layout(data.sub[open] ?? [], (j, v) => setSub(open, j, v),
              <AutoText rows={2} value={data.cells[open] ?? ''} onChange={(v) => setCell(open, v)} />,
            )}
          </div>
        </Card>
      )}
    </>
  );
}
