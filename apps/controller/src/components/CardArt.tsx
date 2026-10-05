import type { CardType } from "@bump-run/shared-types";

/** Small hand-drawn icon per card, so the card face reads at a glance instead of just showing a bare number. */
export function CardArt(props: { type: CardType }) {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" style={{ display: "block" }}>
      {ICONS[props.type]}
    </svg>
  );
}

const STROKE = { fill: "none", stroke: "var(--accent-2)", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const ICONS: Record<CardType, JSX.Element> = {
  CARD_1: <path d="M8 4 L16 12 L8 20" {...STROKE} />,
  CARD_2: (
    <>
      <path d="M4 4 L12 12 L4 20" {...STROKE} />
      <path d="M12 4 L20 12 L12 20" {...STROKE} />
    </>
  ),
  CARD_3: (
    <>
      <path d="M2 4 L9 12 L2 20" {...STROKE} />
      <path d="M9 4 L16 12 L9 20" {...STROKE} />
      <path d="M16 4 L22 12 L16 20" {...STROKE} />
    </>
  ),
  CARD_4: <path d="M16 4 L8 12 L16 20" {...STROKE} />,
  CARD_5: (
    <path
      d="M12 3 L14.7 9 L21 9.6 L16.2 13.9 L17.6 20 L12 16.7 L6.4 20 L7.8 13.9 L3 9.6 L9.3 9 Z"
      fill="var(--accent-2)"
      opacity={0.85}
    />
  ),
  CARD_7: (
    <>
      <path d="M4 20 L11 12" {...STROKE} />
      <path d="M11 12 L7 4" {...STROKE} />
      <path d="M11 12 L17 4" {...STROKE} />
      <path d="M11 12 L15 20" {...STROKE} />
    </>
  ),
  CARD_8: <path d="M13 2 L5 13 H11 L9 22 L19 10 H13 Z" fill="var(--accent-2)" opacity={0.85} />,
  CARD_10: (
    <>
      <path d="M6 4 L15 12 L6 20" {...STROKE} />
      <path d="M17 9 L13 12 L17 15" {...STROKE} strokeWidth={1.6} />
    </>
  ),
  CARD_11: (
    <>
      <path d="M4 9 H16 M12 5 L16 9 L12 13" {...STROKE} />
      <path d="M20 15 H8 M12 19 L8 15 L12 11" {...STROKE} />
    </>
  ),
  CARD_12: (
    <>
      <path d="M12 2 L14.5 9 H21 L15.5 13.2 L17.5 20 L12 16 L6.5 20 L8.5 13.2 L3 9 H9.5 Z" fill="var(--accent-2)" opacity={0.85} />
    </>
  ),
  BUMP: (
    <>
      <circle cx={12} cy={12} r={3.4} fill="var(--accent)" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
        const r1 = 6,
          r2 = 11;
        const rad = (deg * Math.PI) / 180;
        return (
          <line
            key={deg}
            x1={12 + r1 * Math.cos(rad)}
            y1={12 + r1 * Math.sin(rad)}
            x2={12 + r2 * Math.cos(rad)}
            y2={12 + r2 * Math.sin(rad)}
            stroke="var(--accent)"
            strokeWidth={2}
            strokeLinecap="round"
          />
        );
      })}
    </>
  ),
};
