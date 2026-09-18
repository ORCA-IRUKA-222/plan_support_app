import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

/**
 * 図を描くための共通部品。
 * 色はすべて CSS 変数から取るので、ライト/ダークの切り替えに自動で追従する。
 */

/** SVG の <text> は折り返さないので、文字数で行に割る（日本語は単語境界がないため）。 */
export function wrapLines(text: string, perLine: number, maxLines: number): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const lines: string[] = [];
  for (let i = 0; i < clean.length && lines.length < maxLines; i += perLine) {
    lines.push(clean.slice(i, i + perLine));
  }
  const last = lines.length - 1;
  if (last >= 0 && clean.length > maxLines * perLine) {
    lines[last] = `${lines[last]!.slice(0, Math.max(1, perLine - 1))}…`;
  }
  return lines;
}

export function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/** 2点をなめらかにつなぐ曲線。中心を避けて弧を描く。 */
export function curvePath(x1: number, y1: number, x2: number, y2: number, bend = 0.25): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  // 線分の垂直方向へ持ち上げて弧にする。
  const cx = mx - dy * bend;
  const cy = my + dx * bend;
  return `M${x1.toFixed(1)},${y1.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
}

export interface BoxProps {
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  /** 見出し（小さく上に出る）。 */
  label?: string;
  selected?: boolean;
  /** 未記入など、注意を促したいとき。 */
  warn?: boolean;
  accent?: boolean;
  badge?: string | number;
  perLine?: number;
  maxLines?: number;
  onClick?: () => void;
  title?: string;
}

/** 中心座標で置く角丸ノード。 */
export function Box({
  x, y, w, h, text, label, selected, warn, accent, badge,
  perLine = 9, maxLines = 2, onClick, title,
}: BoxProps) {
  const lines = wrapLines(text, perLine, maxLines);
  const cls = [
    'dg-box',
    selected ? 'is-selected' : '',
    warn ? 'is-warn' : '',
    accent ? 'is-accent' : '',
    onClick ? 'is-clickable' : '',
  ].filter(Boolean).join(' ');

  // ラベルがあるときは、その下に十分な間隔を空ける（重ねない）。
  const bodyTop = label ? y - h / 2 + 34 : y - (lines.length - 1) * 8;

  return (
    <g className={cls} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}
       onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}>
      {title && <title>{title}</title>}
      <rect className="dg-box-bg" x={x - w / 2} y={y - h / 2} width={w} height={h} rx={9} />
      {label && (
        <text className="dg-box-label" x={x} y={y - h / 2 + 15} textAnchor="middle">{label}</text>
      )}
      {lines.length === 0 && !label && (
        <text className="dg-box-empty" x={x} y={y + 4} textAnchor="middle">（未記入）</text>
      )}
      {lines.map((line, i) => (
        <text key={i} className="dg-box-text" x={x} y={bodyTop + i * 16} textAnchor="middle">{line}</text>
      ))}
      {badge !== undefined && badge !== '' && (
        <>
          <circle className="dg-badge-bg" cx={x + w / 2 - 9} cy={y - h / 2 + 9} r={9} />
          <text className="dg-badge-text" x={x + w / 2 - 9} y={y - h / 2 + 12.5} textAnchor="middle">{badge}</text>
        </>
      )}
    </g>
  );
}

/** 図の下に置く編集パネル。狭い画面でも入力しやすいよう本文とは分ける。 */
export function EditorPanel({ title, sub, onClose, children }: {
  title: ReactNode; sub?: ReactNode; onClose?: () => void; children: ReactNode;
}) {
  return (
    <div className="dg-editor">
      <header>
        <b>{title}</b>
        {sub && <span className="tiny muted">{sub}</span>}
        {onClose && <button className="ghost sm" onClick={onClose}>閉じる</button>}
      </header>
      {children}
    </div>
  );
}

/** 図を包む器。狭い画面では横スクロールで全体を見られるようにする。 */
export function Canvas({ viewBox, minWidth, children, label }: {
  viewBox: string; minWidth?: number; children: ReactNode; label: string;
}) {
  return (
    <div className="dg-canvas">
      <svg
        viewBox={viewBox}
        role="img"
        aria-label={label}
        preserveAspectRatio="xMidYMid meet"
        style={minWidth ? { minWidth } : undefined}
      >
        {children}
      </svg>
    </div>
  );
}

/** 要素の実寸を測る（図の中に HTML を置きたいときなどに使う）。 */
export function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (typeof w === 'number') setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}
