import { MIND_AXES, PROPOSAL_SECTIONS, SCAMPER } from './knowledge';
import { today } from '../lib/time';
import type {
  AnalogyData, CoreData, CtptData, FiveQData, JourneyData, MandalaData, MindMapData,
  ProposalData, ReversalData, ScamperData, SixW2HData, SkeletonData, SwotData,
  ThreeCData, TalkData, ToolId, TriMemoData,
} from './types';

const emptyJudge = () => ({ oneLine: 0, novelty: 0, reaction: 0, necessity: 0 }) as const;

export const defaults = {
  core: (): CoreData => ({
    oneLiner: '',
    core: '',
    structure: '',
    staging: '',
    judge: { ...emptyJudge() },
    reactions: [],
  }),
  mindmap: (): MindMapData => ({
    seed: '',
    axes: Object.fromEntries(MIND_AXES.map((a) => [a.id, []])),
  }),
  mandala: (): MandalaData => ({
    center: '',
    cells: Array<string>(8).fill(''),
    sub: Array.from({ length: 8 }, () => Array<string>(8).fill('')),
  }),
  scamper: (): ScamperData => ({
    subject: '',
    items: Object.fromEntries(SCAMPER.map((s) => [s.key, ''])),
  }),
  reversal: (): ReversalData => ({
    items: [],
    problem: { stated: '', reversed: '', solutions: '', backport: '', verified: '' },
  }),
  trimemo: (): TriMemoData => ({ theme: '', a: [], b: [], combos: [] }),
  journey: (): JourneyData => ({ session: [], month: [] }),
  analogy: (): AnalogyData => ({ items: [] }),
  skeleton: (): SkeletonData => ({
    loop: { input: '', change: '', reward: '', next: '', seconds: 30 },
    target: { behavior: '', when: '', why: '' },
    revenue: { model: '', detail: '', link: '' },
    feasibility: { team: '', period: '', tech: '', prototype: '' },
    subtraction: '',
    generalization: '',
    weakness: '',
    anyway: '',
  }),
  fiveq: (): FiveQData => ({ what: '', feel: '', who: '', money: '', build: '' }),
  threec: (): ThreeCData => ({ customer: '', competitor: '', company: '', issue: '' }),
  swot: (): SwotData => ({ s: '', w: '', o: '', t: '' }),
  sixw2h: (): SixW2HData => ({
    why: '', what: '', where: '', whom: '', when: '', who: '', how: '', howMuch: '',
  }),
  ctpt: (): CtptData => ({ concept: '', target: '', process: '', tool: '' }),
  proposal: (): ProposalData => ({
    title: '',
    subtitle: '',
    author: '',
    date: today(),
    sections: PROPOSAL_SECTIONS.map((s) => ({
      id: s.id,
      title: s.title,
      body: '',
      enabled: s.required,
    })),
    design: {
      font: '游ゴシック',
      base: '#f7f5f1',
      main: '#1c2b3a',
      accent: '#e8622c',
      checks: {},
    },
  }),
  talk: (): TalkData => ({ hook: '', minutes: 5, notes: '', qa: [] }),
} satisfies Record<ToolId, () => unknown>;

export function defaultToolData(toolId: ToolId): unknown {
  return defaults[toolId]();
}
