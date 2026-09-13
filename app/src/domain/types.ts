/** 同期単位となるレコードの共通形。updatedAt の大きい方が勝つ (LWW)。 */
export interface RecordBase {
  id: string;
  kind: RecordKind;
  updatedAt: number;
  deleted?: boolean;
}

export type RecordKind = 'project' | 'note' | 'seed' | 'tool';

/** 企画書ができるまでの5段階 (0=素材ストック 〜 4=書面化)。 */
export type Phase = 0 | 1 | 2 | 3 | 4;

/** 種の出所7分類。 */
export type SourceId =
  | 'passion'    // 自分の偏愛と違和感
  | 'gap'        // 既存作の欠けている体験
  | 'transplant' // 異業種の体験構造の移植
  | 'change'     // 技術・制度・社会の変化
  | 'company'    // 企業側の文脈
  | 'idletime'   // ターゲットの空き時間
  | 'constraint';// 制約の逆用

/** 良い種かどうかの4判定。0=未評価 1=あやしい 2=弱い 3=普通 4=強い */
export type Score = 0 | 1 | 2 | 3 | 4;

export interface Judge {
  oneLine: Score;   // 一行性
  novelty: Score;   // 未既視感
  reaction: Score;  // 反応の質
  necessity: Score; // 自分の必然性
}

export interface Project extends RecordBase {
  kind: 'project';
  title: string;
  /** 核の一行。段階2の成果物。 */
  oneLiner: string;
  phase: Phase;
  /** ゲートID -> 通過したか。 */
  gates: Record<string, boolean>;
  /** 提出先 (企業・コンペ名)。収益構造やIPの前提になる。 */
  audience: string;
  deadline: string;
  archived: boolean;
}

export interface Note extends RecordBase {
  kind: 'note';
  /** null なら全企画共通のネタ帳。 */
  projectId: string | null;
  body: string;
  tags: string[];
  source: SourceId | null;
}

export interface Seed extends RecordBase {
  kind: 'seed';
  projectId: string;
  text: string;
  source: SourceId | null;
  judge: Judge;
  starred: boolean;
  /** KJ法のグループ名。先に枠を作らず、集めてから名前を付ける。 */
  group: string;
}

/** 思考ツール・フレームワーク・企画書などの構造化データ。1企画1ツール1レコード。 */
export interface Tool<T = unknown> extends RecordBase {
  kind: 'tool';
  projectId: string;
  toolId: ToolId;
  data: T;
}

export type ToolId =
  | 'core'        // 核 (3層モデル)
  | 'mindmap'     // マインドマップ (第1階層8軸固定)
  | 'mandala'     // マンダラート
  | 'scamper'     // SCAMPER
  | 'reversal'    // 逆転発想 / 問題逆転
  | 'trimemo'     // 三角メモ
  | 'journey'     // 体験の時間割
  | 'analogy'     // アナロジー移植
  | 'skeleton'    // 骨格検証
  | 'fiveq'       // 書く前に潰す5つの質問
  | 'threec'      // 3C分析
  | 'swot'        // SWOT分析
  | 'sixw2h'      // 6W2H
  | 'ctpt'        // CTPT
  | 'proposal'    // 企画書
  | 'talk';       // 発表

export type AnyRecord = Project | Note | Seed | Tool;

// ---- 各ツールのデータ形 ----------------------------------------------------

/** 3層モデル: 核 / 骨格 / 演出。 */
export interface CoreData {
  oneLiner: string;
  core: string;
  structure: string;
  staging: string;
  judge: Judge;
  /** 人に話したときの反応メモ。 */
  reactions: string[];
}

export interface MindNode {
  id: string;
  text: string;
  /** 他の枝へのリンク先ノードID。「操作」と「収益」が繋がると強い。 */
  links: string[];
  children: { id: string; text: string }[];
}

export interface MindMapData {
  seed: string;
  /** 軸ID -> その軸にぶら下がる第2階層ノード。 */
  axes: Record<string, MindNode[]>;
}

export interface MandalaData {
  center: string;
  /** 周囲8マス。 */
  cells: string[];
  /** cells[i] を中心にした3×3の周囲8マス。 */
  sub: string[][];
}

export interface ScamperData {
  subject: string;
  items: Record<string, string>;
}

export interface ReversalItem {
  id: string;
  common: string;    // 全員がやっていること
  reversed: string;  // 逆にしたら
  condition: string; // 成立条件
  adopted: boolean;
}

export interface ReversalData {
  items: ReversalItem[];
  /** 問題逆転5ステップ (『アイデア大全』)。 */
  problem: { stated: string; reversed: string; solutions: string; backport: string; verified: string };
}

export interface TriMemoData {
  theme: string;
  a: string[]; // テーマに関連したキーワード
  b: string[]; // ターゲットの好きなこと
  combos: { id: string; a: string; b: string; idea: string }[];
}

export interface JourneyPoint {
  id: string;
  at: string;      // 0分 / 3分 / 1週間後 など
  event: string;
  emotion: number; // -3..3
}

export interface JourneyData {
  session: JourneyPoint[];
  month: JourneyPoint[];
}

export interface AnalogyData {
  items: { id: string; origin: string; surface: string; structure: string; transplant: string }[];
}

export interface SkeletonData {
  loop: { input: string; change: string; reward: string; next: string; seconds: number };
  target: { behavior: string; when: string; why: string };
  revenue: { model: string; detail: string; link: string };
  feasibility: { team: string; period: string; tech: string; prototype: string };
  subtraction: string;    // 引き算テスト
  generalization: string; // 一般化テスト
  weakness: string;       // 残す弱点1つ
  anyway: string;         // それでもやる理由
}

export interface FiveQData {
  what: string;
  feel: string;
  who: string;
  money: string;
  build: string;
}

export interface ThreeCData { customer: string; competitor: string; company: string; issue: string }

export interface SwotData { s: string; w: string; o: string; t: string }

export interface SixW2HData { why: string; what: string; where: string; whom: string; when: string; who: string; how: string; howMuch: string }

export interface CtptData { concept: string; target: string; process: string; tool: string }

export interface ProposalSection {
  id: string;
  title: string;
  body: string;
  enabled: boolean;
}

export interface ProposalData {
  title: string;
  subtitle: string;
  author: string;
  date: string;
  sections: ProposalSection[];
  /** 見やすく整える3つの法則のセルフチェック。 */
  design: { font: string; base: string; main: string; accent: string; checks: Record<string, boolean> };
}

export interface TalkData {
  hook: string;        // 冒頭30秒
  minutes: number;
  notes: string;
  qa: { id: string; q: string; a: string }[];
}
