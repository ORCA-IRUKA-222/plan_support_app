/**
 * アプリ内に埋め込む知識ベース。
 * 出典: 利用者の企画メソッド (5段階・出所7分類・4判定・5つの質問・思考法)、
 *       Adobe「企画書が通りやすくなる書き方・構成のポイント」、
 *       マネーフォワード クラウド「企画書の書き方は?」、
 *       業務効率化ガイド「アイデアを生み出す仕事用メモ術」。
 */
import type { Phase, SourceId, ToolId } from './types';

export interface PhaseDef {
  phase: Phase;
  name: string;
  todo: string;
  gate: string;
  /** 通過条件を分解したチェック項目。全部 true でゲート通過。 */
  gates: { id: string; label: string }[];
  route: string;
}

export const PHASES: PhaseDef[] = [
  {
    phase: 0,
    name: '素材ストック',
    todo: '遊んだもの・違和感・数字をメモに溜める',
    gate: 'ネタ帳が枯れていない',
    route: 'notes',
    gates: [
      { id: 'p0-stock', label: '直近のメモが10件以上ある' },
      { id: 'p0-fresh', label: '今週書いたメモがある' },
    ],
  },
  {
    phase: 1,
    name: '種を出す',
    todo: '発散。質を問わず30〜50個',
    gate: '自分が人に話したくなる種が3つ以上',
    route: 'seeds',
    gates: [
      { id: 'p1-volume', label: '種が30個以上ある' },
      { id: 'p1-star', label: '話したくなる種 (★) が3つ以上ある' },
      { id: 'p1-sources', label: '出所7分類のうち4種類以上から出した' },
    ],
  },
  {
    phase: 2,
    name: '核を決める',
    todo: '1行に圧縮。3層モデルの「核」を確定',
    gate: '一文で言えて、聞いた人が絵を想像できる',
    route: 'core',
    gates: [
      { id: 'p2-oneline', label: '核が一文 (60字以内) で書けている' },
      { id: 'p2-judge', label: '4判定すべてが3以上' },
      { id: 'p2-reaction', label: '人に話して「それどうなるの?」と聞き返された' },
    ],
  },
  {
    phase: 3,
    name: '骨格を検証',
    todo: 'コアループ・ターゲット・収益・実現性',
    gate: '引き算テストと一般化テストを通過',
    route: 'skeleton',
    gates: [
      { id: 'p3-loop', label: 'コアループが30秒単位で書けている' },
      { id: 'p3-target', label: 'ターゲットを属性でなく行動で書いた' },
      { id: 'p3-money', label: '提出先の収益構造に乗っている' },
      { id: 'p3-sub', label: '引き算テストを通過した' },
      { id: 'p3-gen', label: '一般化テストを通過した' },
      { id: 'p3-weak', label: '弱点を1つ残し、それでもやる理由を書いた' },
    ],
  },
  {
    phase: 4,
    name: '書面化',
    todo: '構成・図・数値・演出',
    gate: '冒頭30秒で「面白そう」と思わせられる',
    route: 'proposal',
    gates: [
      { id: 'p4-sections', label: '企画書の必須6セクションが埋まっている' },
      { id: 'p4-numbers', label: '目的とゴールに具体的な数値が入っている' },
      { id: 'p4-hook', label: '一番面白い瞬間から始まっている (背景説明から始めない)' },
      { id: 'p4-design', label: '見やすさの3法則をチェックした' },
    ],
  },
];

export const PHASE_WARNING =
  '多くの企画書が失敗するのは、段階2を飛ばして1から4に直行するから。核が決まらないまま書き始めると、後半が前半と矛盾して「機能の羅列」になります。';

// ---- 種の出所7分類 ---------------------------------------------------------

export interface SourceDef {
  id: SourceId;
  name: string;
  hint: string;
  /** 発想が止まったときに投げる質問。 */
  prompts: string[];
}

export const SOURCES: SourceDef[] = [
  {
    id: 'passion',
    name: '自分の偏愛と違和感',
    hint: '一番強い種',
    prompts: [
      'なぜ自分はこれに200時間使えたのか',
      'なぜここで冷めたのか',
      '人に勧めるとき、最初に言う一言は何か',
    ],
  },
  {
    id: 'gap',
    name: '既存作の欠けている体験',
    hint: 'そのジャンルが構造上まだ提供できていない快感',
    prompts: [
      'このジャンルが構造上まだ提供できていない快感は何か',
      '毎回「ここが惜しい」と思う瞬間はどこか',
      '続編で必ず改善されるのに、まだ誰も直していない点は何か',
    ],
  },
  {
    id: 'transplant',
    name: '異業種の体験構造の移植',
    hint: '構造だけ抜いて別ジャンルに置く',
    prompts: [
      '謎解きライブ・音ゲー・スポーツ・教育・接客のどの構造が使えるか',
      'その体験の「表層」を捨てて「構造」だけ取り出すと何が残るか',
      'その構造を別ジャンルに置くと、何が新しくなるか',
    ],
  },
  {
    id: 'change',
    name: '技術・制度・社会の変化',
    hint: '「なぜ今か」の根拠になる',
    prompts: [
      '直近3年で変わった制度・技術・習慣は何か',
      'その変化で新しく生まれた「困りごと」は何か',
      'その根拠になる一次データはどこにあるか',
    ],
  },
  {
    id: 'company',
    name: '企業側の文脈',
    hint: 'IP・収益構造・プラットフォーム戦略',
    prompts: [
      '提出先が持っているIPで、まだ使い切れていないものは何か',
      '売り切り / F2P / アーケード / ライセンスのどれに乗る企画か',
      'その会社が今いちばん増やしたい数字は何か',
    ],
  },
  {
    id: 'idletime',
    name: 'ターゲットの空き時間',
    hint: '誰のどの時間を奪うのか',
    prompts: [
      '通学中・風呂上がり・待ち合わせ、どの時間を奪うのか',
      'その時間に今使われているアプリは何か',
      '1回あたり何分なら成立するか',
    ],
  },
  {
    id: 'constraint',
    name: '制約の逆用',
    hint: '普通は欠点になる制約を売りにする',
    prompts: [
      '「操作させない」としたら何が残るか',
      '「1日1回しか遊べない」としたら何が起きるか',
      'この企画で普通なら欠点になる制約は何か。それを売りにできるか',
    ],
  },
];

export const SOURCE_MAP: Record<SourceId, SourceDef> = Object.fromEntries(
  SOURCES.map((s) => [s.id, s]),
) as Record<SourceId, SourceDef>;

// ---- 良い種かどうかの4判定 -------------------------------------------------

export const JUDGES = [
  { key: 'oneLine', name: '一行性', desc: '一文で言えるか。言えないものは核が2つ以上ある' },
  { key: 'novelty', name: '未既視感', desc: '既存作の名前を並べただけで説明できてしまわないか' },
  { key: 'reaction', name: '反応の質', desc: '「なるほど」ではなく「それどうなるの?」と聞き返されるか' },
  { key: 'necessity', name: '自分の必然性', desc: '自分が作る理由があるか。ここが企画書の熱量そのもの' },
] as const;

export type JudgeKey = (typeof JUDGES)[number]['key'];

// ---- 書く前に自分で潰しておく5つの質問 -------------------------------------

export const FIVE_QUESTIONS = [
  { key: 'what', q: '何のゲームか (一行)', hint: 'キャッチコピーと同義ではなく、体験の定義' },
  { key: 'feel', q: '何が気持ちいいのか (コアループ)', hint: '入力→変化→報酬→次の入力。30秒単位で書けるか' },
  { key: 'who', q: '誰が、いつ、なぜ遊ぶのか', hint: '属性ではなく行動で書く。「中高生」ではなく「授業でPythonを触ったが退屈している中高生」' },
  { key: 'money', q: 'どう収益になるのか', hint: '売り切り / ガチャ / イベント課金 / 筐体収入のどれに乗る企画か' },
  { key: 'build', q: '作れるのか', hint: 'チーム規模・期間・既存技術で成立するか。プロトタイプがあれば最強の回答' },
] as const;

export const FIVE_Q_CAUTION =
  '批判への防御を厚くしすぎないこと。反論をすべて先回りして潰した企画書は安全ですが面白くありません。弱点は1つ残して、それを認めた上で「それでもやる理由」を書いたほうが強い。';

// ---- マインドマップ 第1階層8軸 ---------------------------------------------

export const MIND_AXES = [
  { id: 'who', name: '誰が', hint: '行動で定義' },
  { id: 'when', name: 'いつ・どこで', hint: 'プレイ文脈・1回の長さ' },
  { id: 'pleasure', name: '何が快感か', hint: '核体験' },
  { id: 'input', name: '何を操作するか', hint: '入力' },
  { id: 'conflict', name: '何が邪魔するか', hint: '葛藤・敵' },
  { id: 'end', name: 'どう終わるか', hint: '勝敗・目標・成長' },
  { id: 'why', name: 'なぜ今か', hint: '外部環境・根拠数値' },
  { id: 'money', name: 'どう儲かるか', hint: '収益構造' },
] as const;

export const MIND_TIPS = [
  '第2階層まで必ず埋める。第1階層だけだと項目表になり、発想が広がらない',
  '埋まらない枝が本当の弱点。「どう終わるか」が書けない企画は、遊びのゴールが設計されていない',
  '枝から枝への線を引く。「操作」と「収益」がつながると強い企画になる',
];

// ---- SCAMPER ---------------------------------------------------------------

export const SCAMPER = [
  { key: 's', name: 'Substitute', ja: '代用', q: '要素の一部を別のものに置き換えると?' },
  { key: 'c', name: 'Combine', ja: '結合', q: '別のジャンル・仕組みと組み合わせると?' },
  { key: 'a', name: 'Adapt', ja: '応用', q: '他の分野の解決策を持ち込めないか?' },
  { key: 'm', name: 'Modify', ja: '変更', q: '大きく / 小さく / 速く / 遅くしたら?' },
  { key: 'p', name: 'Put to other uses', ja: '転用', q: '別の目的・別のターゲットに使えないか?' },
  { key: 'e', name: 'Eliminate', ja: '削除', q: 'これを取り除いても成立するか? 何が残るか?' },
  { key: 'r', name: 'Reverse', ja: '逆転', q: '順番・立場・勝敗をひっくり返すと?' },
] as const;

export const SCAMPER_TIP =
  'Eliminate と Reverse が最も企画らしい変化を生みます。引き算テストは Eliminate の徹底版です。';

// ---- 問題逆転 5ステップ ----------------------------------------------------

export const PROBLEM_REVERSAL_STEPS = [
  { key: 'stated', label: '(1) 問題・課題・既存のアイデアを言葉で表現する', ex: '例: 売り上げが足りない' },
  { key: 'reversed', label: '(2) 一部を否定形や対義語に置き換えて〈逆転〉する', ex: '例: 売り上げが多すぎる' },
  { key: 'solutions', label: '(3) 裏返した問題についての〈逆転解決策〉を考える', ex: '例: 売り渋る、自らネガティブな広告をうつ' },
  { key: 'backport', label: '(4) 〈逆転解決策〉を(一部変更して)元の問題に使えないか考える', ex: '例: 期間限定や地域限定で販売しプレミアム感を出す' },
  { key: 'verified', label: '(5) (4)でできた解決策が使えるかどうか確かめる', ex: '' },
] as const;

// ---- 三角メモ --------------------------------------------------------------

export const TRIMEMO_STEPS = [
  '(1) 左の三角形に、テーマに関連する情報を書き出す',
  '(2) 右の三角形にターゲットの好きなことを、ただただリストアップ',
  '(3) (1)と(2)を結びつけて、面白い言葉をつくる',
];

// ---- 体験の時間割 ----------------------------------------------------------

export const JOURNEY_CHECKPOINTS = {
  session: [
    { at: '0分', q: '何が起きて、何を面白いと思うか' },
    { at: '3分', q: 'ここで離脱するなら企画は成立しない' },
    { at: '15分', q: '2周目に入る理由は何か' },
  ],
  month: [
    { at: '1週間後', q: 'まだ遊んでいる理由は何か' },
    { at: '2週間後', q: '飽きの兆候はどこに出るか' },
    { at: '1か月後', q: '何に課金しているか、誰と話しているか' },
  ],
};

export const JOURNEY_TIP = 'この線が平坦な企画は、要素は多くても山がない企画です。';

// ---- 手法の使い分け --------------------------------------------------------

export const METHOD_ROUTING: { situation: string; methods: string; to: ToolId | 'seeds' | 'core' }[] = [
  { situation: 'ゼロから発想したい', methods: '種の出所7分類 → マインドマップ', to: 'seeds' },
  { situation: 'アイデアが多すぎて選べない', methods: 'KJ法 → 一行性の判定', to: 'core' },
  { situation: '既存タイトルの改善案', methods: '3層モデル → SCAMPER (特に Eliminate/Reverse)', to: 'scamper' },
  { situation: '企画が平凡に感じる', methods: '逆転発想、制約の逆用', to: 'reversal' },
  { situation: '抜け漏れが不安', methods: 'マンダラート、5つの質問', to: 'mandala' },
  { situation: '面白さを他人に説明できない', methods: '体験の時間割', to: 'journey' },
];

// ---- 陥りやすい罠 ----------------------------------------------------------

export const PITFALLS = [
  { name: '要素の足し算', desc: '不安になると機能を足すが、足すほど核がぼやける。迷ったら削る' },
  { name: 'ターゲットの後付け', desc: '作りたいものを決めてから対象を探すと根拠が薄くなる。数字は一次データで取る' },
  { name: '社名差し替えで通る企画書', desc: 'その会社の収益構造・IP・時間軸に乗っていない企画はどこにも刺さらない' },
  { name: '磨きすぎ', desc: '完成度の高いテンプレートより、個人的な投資感があるほうが読まれる。企画書はラブレター' },
  { name: '冒頭の順番ミス', desc: '背景説明から始めない。一番面白い瞬間から始めて、根拠は後ろに置く' },
];

// ---- 企画書の構成 (Adobe / マネーフォワード の記事より) ---------------------

export interface SectionDef {
  id: string;
  title: string;
  hint: string;
  placeholder: string;
  required: boolean;
}

export const PROPOSAL_SECTIONS: SectionDef[] = [
  {
    id: 'summary',
    title: 'エグゼクティブサマリー',
    hint: '意思決定者はここを読んで続きを読むか決める。要旨を簡潔に。一番面白い瞬間から始める',
    placeholder: 'この企画は「◯◯」を実現する。読み手に期待することと、提供する価値を3行で。',
    required: true,
  },
  {
    id: 'analysis',
    title: '現状分析・課題',
    hint: '3C / SWOT で集めた客観データを根拠に、ストーリー性を加えて背景を説明する',
    placeholder: '【市場】…\n【競合】…\n【自社】…\n→ 導かれる課題: …',
    required: true,
  },
  {
    id: 'purpose',
    title: '企画の目的とゴール',
    hint: 'なるべく具体的な数値を入れる。採用するとどんなメリットがあるかを想像させる',
    placeholder: '◯月〜◯月の◯◯を、昨対比で◯%向上させることを目的とする。',
    required: true,
  },
  {
    id: 'detail',
    title: '企画の具体的な内容',
    hint: 'CTPT (コンセプト/ターゲット/プロセス/ツール) と 6W2H で言語化する。施策と目的の因果関係を書く',
    placeholder: '【コンセプト】…\n【ターゲット】…\n【プロセス】…\n【ツール】…',
    required: true,
  },
  {
    id: 'plan',
    title: 'スケジュール・予算・収支',
    hint: 'ヒト・モノ・カネの配分と ROI。総額だけでなく内訳も示す',
    placeholder: '【スケジュール】…\n【体制】…\n【予算内訳】…\n【ROI】…',
    required: true,
  },
  {
    id: 'goal',
    title: '施策の目標・ゴール (まとめ)',
    hint: '結論に相当するまとめを自信に満ちた言葉で。サマリーとのバランスを取り簡潔に',
    placeholder: 'この企画が取り組む課題と、その解決策となる施策の目標を一段落で。',
    required: true,
  },
  {
    id: 'weakness',
    title: '想定される弱点と、それでもやる理由',
    hint: '弱点は1つ残して認める。全部潰した企画書は安全だが面白くない',
    placeholder: '【弱点】…\n【それでもやる理由】…',
    required: false,
  },
  {
    id: 'appendix',
    title: '補足・出典',
    hint: '一次データの出典、参考資料、プロトタイプへのリンク',
    placeholder: '',
    required: false,
  },
];

/** 文章の3ポイント + 見やすく整える3つの法則 (Adobe)。 */
export const DESIGN_CHECKS = [
  { id: 'point', label: '要点を明確にする', desc: '情報を並列に書かず重み付けする。スライドなら「1スライド1メッセージ」' },
  { id: 'plain', label: 'わかりやすい言葉を選ぶ', desc: '凝った表現・難解な言い回しを避け、専門用語には補足を付ける' },
  { id: 'short', label: '文章は簡潔に書く', desc: '1文に複数の意味を詰め込まず、適度に文を分ける' },
  { id: 'font', label: 'フォントは読みやすいものに統一する', desc: 'メイリオ / 游ゴシック / ヒラギノ角ゴ。意図なく混在させない' },
  { id: 'color', label: '配色は4色以内に抑える', desc: 'ベース70% / メイン25% / アクセント5% + 文字色1色' },
  { id: 'layout', label: 'レイアウトの4原則を意識する', desc: '整列・近接・反復・対比' },
];

export const DESIGN_CAUTION =
  '企画書の採否が見た目の装飾で決まることは基本的にありません。重要なのは中身の情報です。装飾に時間をかけるのは本末転倒。';

// ---- フレームワークのヒント ------------------------------------------------

export const THREE_C = [
  { key: 'customer', name: 'Customer (市場・顧客)', hint: '業界の市場規模 / 市場の成長性 / 顧客ニーズ / 消費行動' },
  { key: 'competitor', name: 'Competitor (競合)', hint: '競合のシェア・特徴 / 新規参入・代替品の脅威 / 業界ポジション' },
  { key: 'company', name: 'Company (自社)', hint: '企業理念・ビジョン / 既存事業の現状 / 保有するヒト・モノ・カネ' },
] as const;

export const THREE_C_TIP = '3C分析では事実のみを集めること。解釈は SWOT で行います。';

export const SWOT = [
  { key: 's', name: 'Strengths (強み)', hint: '得意なことは? 他社にないユニークな点は?' },
  { key: 'w', name: 'Weaknesses (弱み)', hint: 'うまくいっていない取り組みは? 必要なリソースは?' },
  { key: 'o', name: 'Opportunities (機会)', hint: 'プラスに働く外部環境は? 法改正・人口動態・生活スタイル' },
  { key: 't', name: 'Threats (脅威)', hint: 'マイナスに働く外部環境は?' },
] as const;

export const SIX_W2H = [
  { key: 'why', name: 'Why (目的)', hint: '「なぜ」この企画を実施するのか。社会的背景や競合の状況' },
  { key: 'what', name: 'What (施策)', hint: '「なに」を実現したいのか。課題を解決する具体的なアクション' },
  { key: 'where', name: 'Where (実施場所)', hint: '「どの」マーケットに参入するのか。会場・プラットフォーム' },
  { key: 'whom', name: 'Whom (対象者)', hint: '「だれを」ターゲットとするのか。なぜその対象者を選んだのか' },
  { key: 'when', name: 'When (実施期間)', hint: '「いつ」実施するのか。中間目標も設定する' },
  { key: 'who', name: 'Who (担当者)', hint: '「だれが」主体となって実施するのか。役割と責任の範囲' },
  { key: 'how', name: 'How (実施方法)', hint: '「どんな方法で」実施するのか。プロセス・手順・ツール' },
  { key: 'howMuch', name: 'How much (予算)', hint: '予算・投資・収益は「いくら」を想定するのか。内訳も示す' },
] as const;

export const CTPT = [
  { key: 'concept', name: 'C: コンセプト', hint: '企画の中心にある一行' },
  { key: 'target', name: 'T: ターゲット', hint: 'ペルソナの設定。行動で書く' },
  { key: 'process', name: 'P: プロセスの提示', hint: 'どういう順序で実現するか' },
  { key: 'tool', name: 'T: ツール', hint: '使う手段・チャネル・技術' },
] as const;

// ---- メモ術 (業務効率化ガイド) ---------------------------------------------

export const MEMO_TIPS = [
  'アイデアが生まれてからメモするのではなく、アイデアを生むためにメモする。頭と同時に手を動かす',
  '深く考えず、思い浮かんだことをすぐメモする。些細な出来事でも、あとから振り返ると重大な発見になる',
  '思い付いたら忘れないうちにメモする。通勤中や外出先など、どこでも書ける環境を用意しておく',
];
