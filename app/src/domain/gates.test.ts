import { describe, expect, it } from 'vitest';
import { gateStates, nextAction, phaseProgress, type GateContext } from './gates';
import { defaults } from './defaults';
import type { Note, Project, Seed, SourceId } from './types';

const project = (over: Partial<Project> = {}): Project => ({
  id: 'p1', kind: 'project', updatedAt: 1, title: 'テスト企画', oneLiner: '',
  phase: 0, gates: {}, audience: '', deadline: '', archived: false, ...over,
});

const note = (i: number, age = 0): Note => ({
  id: `n${i}`, kind: 'note', updatedAt: Date.now() - age, projectId: 'p1', body: `メモ${i}`, tags: [], source: null,
});

const seed = (i: number, over: Partial<Seed> = {}): Seed => ({
  id: `s${i}`, kind: 'seed', updatedAt: 1, projectId: 'p1', text: `種${i}`,
  source: null, judge: { oneLine: 0, novelty: 0, reaction: 0, necessity: 0 },
  starred: false, group: '', ...over,
});

const ctx = (over: Partial<GateContext> = {}): GateContext => ({
  project: project(),
  notes: [],
  seeds: [],
  core: defaults.core(),
  skeleton: defaults.skeleton(),
  fiveq: defaults.fiveq(),
  proposal: defaults.proposal(),
  ...over,
});

const gate = (phase: 0 | 1 | 2 | 3 | 4, id: string, c: GateContext) =>
  gateStates(phase, c).find((g) => g.id === id);

describe('段階0 のゲート', () => {
  it('メモが10件に満たなければ通過しない', () => {
    const g = gate(0, 'p0-stock', ctx({ notes: [note(1), note(2)] }));
    expect(g?.passed).toBe(false);
    expect(g?.detail).toBe('2 / 10 件');
  });

  it('10件そろえば通過する', () => {
    const notes = Array.from({ length: 10 }, (_, i) => note(i));
    expect(gate(0, 'p0-stock', ctx({ notes }))?.passed).toBe(true);
  });

  it('直近7日のメモがなければ「枯れている」と判定する', () => {
    const old = note(1, 30 * 24 * 60 * 60 * 1000);
    expect(gate(0, 'p0-fresh', ctx({ notes: [old] }))?.passed).toBe(false);
    expect(gate(0, 'p0-fresh', ctx({ notes: [note(2)] }))?.passed).toBe(true);
  });
});

describe('段階1 のゲート', () => {
  it('種30個で量のゲートを通過する', () => {
    const seeds = Array.from({ length: 30 }, (_, i) => seed(i));
    expect(gate(1, 'p1-volume', ctx({ seeds }))?.passed).toBe(true);
  });

  it('★が3つ必要', () => {
    const two = [seed(1, { starred: true }), seed(2, { starred: true }), seed(3)];
    expect(gate(1, 'p1-star', ctx({ seeds: two }))?.passed).toBe(false);
    const three = [...two, seed(4, { starred: true })];
    expect(gate(1, 'p1-star', ctx({ seeds: three }))?.passed).toBe(true);
  });

  it('出所4分類以上から出したかを数える', () => {
    const sources: SourceId[] = ['passion', 'gap', 'change'];
    const seeds = sources.map((s, i) => seed(i, { source: s }));
    expect(gate(1, 'p1-sources', ctx({ seeds }))?.detail).toBe('3 / 4 分類');
    seeds.push(seed(9, { source: 'company' }));
    expect(gate(1, 'p1-sources', ctx({ seeds }))?.passed).toBe(true);
  });

  it('出所なしの種は分類数に数えない', () => {
    const seeds = [seed(1), seed(2), seed(3), seed(4)];
    expect(gate(1, 'p1-sources', ctx({ seeds }))?.detail).toBe('0 / 4 分類');
  });
});

describe('段階2 のゲート', () => {
  it('60字を超える一行は通過しない', () => {
    const core = { ...defaults.core(), oneLiner: 'あ'.repeat(61) };
    const g = gate(2, 'p2-oneline', ctx({ core }));
    expect(g?.passed).toBe(false);
    expect(g?.detail).toContain('長すぎ');
  });

  it('4判定すべて3以上で通過する', () => {
    const core = { ...defaults.core(), judge: { oneLine: 3, novelty: 3, reaction: 4, necessity: 2 } as const };
    expect(gate(2, 'p2-judge', ctx({ core }))?.passed).toBe(false);
    const ok = { ...core, judge: { ...core.judge, necessity: 3 } as const };
    expect(gate(2, 'p2-judge', ctx({ core: ok }))?.passed).toBe(true);
  });

  it('自動判定できないゲートは企画のチェック状態を読む', () => {
    const g = gate(2, 'p2-reaction', ctx({ project: project({ gates: { 'p2-reaction': true } }) }));
    expect(g?.auto).toBe(false);
    expect(g?.passed).toBe(true);
  });
});

describe('段階4 のゲート', () => {
  it('目的に数字がなければ通過しない', () => {
    const proposal = defaults.proposal();
    const withText = {
      ...proposal,
      sections: proposal.sections.map((s) => (s.id === 'purpose' ? { ...s, body: '売上を大きく伸ばす' } : s)),
    };
    expect(gate(4, 'p4-numbers', ctx({ proposal: withText }))?.passed).toBe(false);

    const withNumber = {
      ...proposal,
      sections: proposal.sections.map((s) => (s.id === 'purpose' ? { ...s, body: '売上を20%伸ばす' } : s)),
    };
    expect(gate(4, 'p4-numbers', ctx({ proposal: withNumber }))?.passed).toBe(true);
  });

  it('全角数字も数字として認める', () => {
    const proposal = defaults.proposal();
    const doc = {
      ...proposal,
      sections: proposal.sections.map((s) => (s.id === 'purpose' ? { ...s, body: '売上を２０％伸ばす' } : s)),
    };
    expect(gate(4, 'p4-numbers', ctx({ proposal: doc }))?.passed).toBe(true);
  });
});

describe('進捗と次の一手', () => {
  it('5段階すべての進捗を返す', () => {
    const p = phaseProgress(ctx());
    expect(p).toHaveLength(5);
    expect(p.every((x) => x.passed === 0)).toBe(true);
  });

  it('最初の未通過ゲートを次の一手として返す', () => {
    const next = nextAction(ctx());
    expect(next?.phase).toBe(0);
    expect(next?.gate.id).toBe('p0-stock');
  });

  it('段階0を満たすと次の段階へ進む', () => {
    const notes = Array.from({ length: 10 }, (_, i) => note(i));
    expect(nextAction(ctx({ notes }))?.phase).toBe(1);
  });
});
