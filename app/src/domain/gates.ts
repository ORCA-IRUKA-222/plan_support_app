import type { Note, Phase, Project, Seed } from './types';
import type { FiveQData, ProposalData, SkeletonData, CoreData } from './types';
import { PHASES, PROPOSAL_SECTIONS, DESIGN_CHECKS } from './knowledge';

export interface GateContext {
  project: Project;
  notes: Note[];
  seeds: Seed[];
  core: CoreData;
  skeleton: SkeletonData;
  fiveq: FiveQData;
  proposal: ProposalData;
}

export interface GateState {
  id: string;
  label: string;
  passed: boolean;
  /** 自動判定できたか。false なら利用者のチェック待ち。 */
  auto: boolean;
  detail: string;
}

const filled = (s: string) => s.trim().length > 0;
const WEEK = 7 * 24 * 60 * 60 * 1000;

/** 自動判定できるゲートの評価。null を返したら利用者の手動チェックに委ねる。 */
function evaluate(id: string, c: GateContext): { passed: boolean; detail: string } | null {
  const seeds = c.seeds;
  switch (id) {
    case 'p0-stock': {
      const n = c.notes.length;
      return { passed: n >= 10, detail: `${n} / 10 件` };
    }
    case 'p0-fresh': {
      const fresh = c.notes.filter((x) => Date.now() - x.updatedAt < WEEK).length;
      return { passed: fresh > 0, detail: `直近7日: ${fresh} 件` };
    }
    case 'p1-volume':
      return { passed: seeds.length >= 30, detail: `${seeds.length} / 30 個` };
    case 'p1-star': {
      const n = seeds.filter((s) => s.starred).length;
      return { passed: n >= 3, detail: `★ ${n} / 3 個` };
    }
    case 'p1-sources': {
      const n = new Set(seeds.map((s) => s.source).filter(Boolean)).size;
      return { passed: n >= 4, detail: `${n} / 4 分類` };
    }
    case 'p2-oneline': {
      const t = c.core.oneLiner.trim();
      return {
        passed: t.length > 0 && t.length <= 60,
        detail: t.length === 0 ? '未記入' : `${t.length} 字${t.length > 60 ? ' (長すぎ)' : ''}`,
      };
    }
    case 'p2-judge': {
      const v = Object.values(c.core.judge);
      const n = v.filter((x) => x >= 3).length;
      return { passed: n === 4, detail: `3以上: ${n} / 4 項目` };
    }
    case 'p3-loop': {
      const l = c.skeleton.loop;
      const n = [l.input, l.change, l.reward, l.next].filter(filled).length;
      return { passed: n === 4, detail: `${n} / 4 段` };
    }
    case 'p3-target':
      return { passed: filled(c.skeleton.target.behavior) && filled(c.skeleton.target.when), detail: '' };
    case 'p3-money':
      return { passed: filled(c.skeleton.revenue.model) && filled(c.skeleton.revenue.link), detail: '' };
    case 'p3-sub':
      return { passed: filled(c.skeleton.subtraction), detail: '' };
    case 'p3-gen':
      return { passed: filled(c.skeleton.generalization), detail: '' };
    case 'p3-weak':
      return { passed: filled(c.skeleton.weakness) && filled(c.skeleton.anyway), detail: '' };
    case 'p4-sections': {
      const required = PROPOSAL_SECTIONS.filter((s) => s.required).map((s) => s.id);
      const done = c.proposal.sections.filter((s) => required.includes(s.id) && filled(s.body)).length;
      return { passed: done === required.length, detail: `${done} / ${required.length} セクション` };
    }
    case 'p4-numbers': {
      const purpose = c.proposal.sections.find((s) => s.id === 'purpose')?.body ?? '';
      return { passed: /[0-9０-９]/.test(purpose), detail: purpose ? '' : '未記入' };
    }
    case 'p4-design': {
      const n = DESIGN_CHECKS.filter((d) => c.proposal.design.checks[d.id]).length;
      return { passed: n === DESIGN_CHECKS.length, detail: `${n} / ${DESIGN_CHECKS.length} 項目` };
    }
    default:
      return null;
  }
}

export function gateStates(phase: Phase, c: GateContext): GateState[] {
  const def = PHASES[phase];
  if (!def) return [];
  return def.gates.map((g) => {
    const auto = evaluate(g.id, c);
    return auto === null
      ? { id: g.id, label: g.label, passed: Boolean(c.project.gates[g.id]), auto: false, detail: '' }
      : { id: g.id, label: g.label, passed: auto.passed, auto: true, detail: auto.detail };
  });
}

export function phaseProgress(c: GateContext): { phase: Phase; passed: number; total: number }[] {
  return PHASES.map((def) => {
    const states = gateStates(def.phase, c);
    return { phase: def.phase, passed: states.filter((s) => s.passed).length, total: states.length };
  });
}

/** 次にやるべきこと: 未通過のゲートが最初に現れる段階。 */
export function nextAction(c: GateContext): { phase: Phase; gate: GateState } | null {
  for (const def of PHASES) {
    const pending = gateStates(def.phase, c).find((s) => !s.passed);
    if (pending) return { phase: def.phase, gate: pending };
  }
  return null;
}
