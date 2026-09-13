import { FIVE_QUESTIONS, FIVE_Q_CAUTION, SCAMPER_TIP } from '../domain/knowledge';
import type { FiveQData, SkeletonData } from '../domain/types';
import type { GateContext } from '../domain/gates';
import { saveTool } from '../store/store';
import { AutoText, Card, Field } from '../components/ui';

/** 段階3「骨格を検証」。コアループ・ターゲット・収益・実現性 + 2つのテスト。 */
export default function Skeleton({ ctx }: { ctx: GateContext }) {
  const { project, skeleton, fiveq } = ctx;
  const patch = (p: Partial<SkeletonData>) => saveTool(project.id, 'skeleton', { ...skeleton, ...p });
  const patchQ = (p: Partial<FiveQData>) => saveTool(project.id, 'fiveq', { ...fiveq, ...p });

  return (
    <>
      <Card title="コアループ" sub="入力 → 変化 → 報酬 → 次の入力。30秒単位で書けるか">
        <div className="grid four">
          <Field label="① 入力" hint="プレイヤーが何をするか">
            <AutoText value={skeleton.loop.input} rows={3} onChange={(v) => patch({ loop: { ...skeleton.loop, input: v } })} />
          </Field>
          <Field label="② 変化" hint="世界がどう応えるか">
            <AutoText value={skeleton.loop.change} rows={3} onChange={(v) => patch({ loop: { ...skeleton.loop, change: v } })} />
          </Field>
          <Field label="③ 報酬" hint="何が気持ちいいか">
            <AutoText value={skeleton.loop.reward} rows={3} onChange={(v) => patch({ loop: { ...skeleton.loop, reward: v } })} />
          </Field>
          <Field label="④ 次の入力" hint="なぜもう一度やるのか">
            <AutoText value={skeleton.loop.next} rows={3} onChange={(v) => patch({ loop: { ...skeleton.loop, next: v } })} />
          </Field>
        </div>
        <label className="field" style={{ maxWidth: 240, marginTop: 10 }}>
          <span className="lbl">1周にかかる秒数</span>
          <input
            type="number"
            min={1}
            value={skeleton.loop.seconds}
            onChange={(e) => patch({ loop: { ...skeleton.loop, seconds: Number(e.target.value) || 0 } })}
          />
        </label>
      </Card>

      <div className="grid two">
        <Card title="ターゲット" sub="属性ではなく行動で書く">
          <Field label="誰が（行動で）" hint="「中高生」ではなく「授業でPythonを触ったが退屈している中高生」">
            <AutoText value={skeleton.target.behavior} rows={3} onChange={(v) => patch({ target: { ...skeleton.target, behavior: v } })} />
          </Field>
          <Field label="いつ・どこで" hint="通学中 / 風呂上がり / 待ち合わせ。誰のどの時間を奪うのか">
            <AutoText value={skeleton.target.when} rows={2} onChange={(v) => patch({ target: { ...skeleton.target, when: v } })} />
          </Field>
          <Field label="なぜ遊ぶのか" hint="いま何を使っている時間を、なぜ手放すのか">
            <AutoText value={skeleton.target.why} rows={2} onChange={(v) => patch({ target: { ...skeleton.target, why: v } })} />
          </Field>
        </Card>

        <Card title="収益" sub={project.audience ? `提出先: ${project.audience}` : '提出先を設定すると前提が固まります'}>
          <Field label="収益モデル">
            <select
              value={skeleton.revenue.model}
              onChange={(e) => patch({ revenue: { ...skeleton.revenue, model: e.target.value } })}
            >
              <option value="">選ぶ…</option>
              {['売り切り', 'F2P（ガチャ）', 'F2P（イベント課金）', 'サブスクリプション', 'アーケード／筐体収入', 'ライセンス／IP許諾', '広告', '受託・BtoB', 'その他'].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </Field>
          <Field label="内訳・想定単価">
            <AutoText value={skeleton.revenue.detail} rows={3} onChange={(v) => patch({ revenue: { ...skeleton.revenue, detail: v } })} />
          </Field>
          <Field label="操作の快感と課金動機のつながり" hint="「操作」と「収益」がつながると強い企画になります">
            <AutoText value={skeleton.revenue.link} rows={3} onChange={(v) => patch({ revenue: { ...skeleton.revenue, link: v } })} />
          </Field>
        </Card>
      </div>

      <Card title="実現性" sub="プロトタイプがあるなら最強の回答になります">
        <div className="grid four">
          <Field label="チーム規模"><AutoText value={skeleton.feasibility.team} rows={2} onChange={(v) => patch({ feasibility: { ...skeleton.feasibility, team: v } })} /></Field>
          <Field label="期間"><AutoText value={skeleton.feasibility.period} rows={2} onChange={(v) => patch({ feasibility: { ...skeleton.feasibility, period: v } })} /></Field>
          <Field label="既存技術で足りるか"><AutoText value={skeleton.feasibility.tech} rows={2} onChange={(v) => patch({ feasibility: { ...skeleton.feasibility, tech: v } })} /></Field>
          <Field label="プロトタイプ"><AutoText value={skeleton.feasibility.prototype} rows={2} onChange={(v) => patch({ feasibility: { ...skeleton.feasibility, prototype: v } })} /></Field>
        </div>
      </Card>

      <Card title="2つのテスト" sub="この2つを通過してはじめて書面化へ進めます">
        <p className="hint">{SCAMPER_TIP}</p>
        <Field
          label="引き算テスト"
          hint="要素をひとつずつ消す。消しても成立するものは核ではありません。何を消して、なぜ核が残ったか"
        >
          <AutoText value={skeleton.subtraction} rows={4} onChange={(v) => patch({ subtraction: v })} />
        </Field>
        <Field
          label="一般化テスト"
          hint="題材を別のものに差し替えても成立してしまうなら、それは演出であって核ではありません"
        >
          <AutoText value={skeleton.generalization} rows={4} onChange={(v) => patch({ generalization: v })} />
        </Field>
      </Card>

      <Card title="残す弱点はひとつ" sub="反論を全部潰した企画書は安全ですが面白くありません">
        <p className="hint strong">{FIVE_Q_CAUTION}</p>
        <div className="grid two">
          <Field label="認める弱点（1つだけ）">
            <AutoText value={skeleton.weakness} rows={3} onChange={(v) => patch({ weakness: v })} />
          </Field>
          <Field label="それでもやる理由">
            <AutoText value={skeleton.anyway} rows={3} onChange={(v) => patch({ anyway: v })} />
          </Field>
        </div>
      </Card>

      <Card title="書く前に自分で潰しておく5つの質問" sub="審査側が最初に見る順番でもあります">
        {FIVE_QUESTIONS.map((q, i) => (
          <Field key={q.key} label={`${i + 1}. ${q.q}`} hint={q.hint}>
            <AutoText value={fiveq[q.key]} rows={3} onChange={(v) => patchQ({ [q.key]: v } as Partial<FiveQData>)} />
          </Field>
        ))}
      </Card>
    </>
  );
}
