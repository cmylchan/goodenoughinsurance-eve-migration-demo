import type { ReactNode } from "react";
import styles from "./neighborhood-scene.module.css";

/**
 * The home hero's animated background: a line-drawn street. Five houses, each a different build,
 * a GoodEnough office on the corner, trees, fences and street furniture, with a town and hills
 * behind, and a sky of drifting clouds, birds and balloons. A car drives past and someone walks
 * by under a burgundy umbrella.
 *
 * It is plain SVG animated by CSS (no JavaScript, no images), so it ships in the prerendered
 * shell, costs nothing to hydrate, and stops for reduced motion.
 */

const GROUND = 392;

const n = (value: number) => Math.round(value * 10) / 10;

// ── Small parts ─────────────────────────────────────────────────────────────

function Win({
  x,
  y,
  w = 24,
  h = 28,
  glow,
  shutters = false,
  box = false,
  arched = false,
}: {
  readonly x: number;
  readonly y: number;
  readonly w?: number;
  readonly h?: number;
  /** Seconds before this window's light comes on, so the street doesn't blink in unison. */
  readonly glow?: number;
  readonly shutters?: boolean;
  readonly box?: boolean;
  readonly arched?: boolean;
}) {
  const frame = arched
    ? `M${x} ${y + h}V${y + w / 2}a${w / 2} ${w / 2} 0 0 1 ${w} 0V${y + h}Z`
    : `M${x} ${y}h${w}v${h}h${-w}Z`;
  return (
    <g>
      {shutters ? (
        <path
          className={styles.shade}
          d={`M${x - 8} ${y}h6v${h}h-6ZM${x + w + 2} ${y}h6v${h}h-6ZM${x - 8} ${y + h / 2}h6M${x + w + 2} ${y + h / 2}h6`}
        />
      ) : null}
      <path className={glow === undefined ? styles.solid : styles.glow} d={frame} style={glow === undefined ? undefined : { animationDelay: `${glow}s` }} />
      <path className={styles.detail} d={`M${x + w / 2} ${arched ? y + 1 : y}V${y + h}M${x} ${y + h * 0.5}h${w}`} />
      <path className={styles.line} d={`M${x - 3} ${y + h + 2.5}h${w + 6}`} />
      {box ? (
        <g>
          <path className={styles.accent} d={`M${x - 2} ${y + h + 3}h${w + 4}l-2 7h${-w}Z`} />
          <path
            className={styles.bloom}
            d={[0.2, 0.5, 0.8].map((at) => `M${n(x + w * at - 2.2)} ${y + h + 1}a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0-4.4 0`).join("")}
          />
        </g>
      ) : null}
    </g>
  );
}

function Door({ cx, w = 26, h = 44, glass = false }: { readonly cx: number; readonly w?: number; readonly h?: number; readonly glass?: boolean }) {
  const x = cx - w / 2;
  const y = GROUND - 4 - h;
  return (
    <g>
      <path className={styles.solid} d={`M${x} ${y}h${w}v${h}h${-w}Z`} />
      {glass ? (
        <path className={styles.detail} d={`M${x + 4} ${y + 4}h${w - 8}v${h * 0.55}h${-(w - 8)}ZM${x + 7} ${y + h * 0.45}l${w * 0.3} ${-h * 0.3}`} />
      ) : (
        <path
          className={styles.detail}
          d={`M${x + 4} ${y + 4}h${w - 8}v${h * 0.34}h${-(w - 8)}ZM${x + 4} ${y + h * 0.5}h${w - 8}v${h * 0.4}h${-(w - 8)}Z`}
        />
      )}
      <circle className={styles.knob} cx={x + w - 5} cy={y + h * 0.54} r={1.5} />
      <path className={styles.solid} d={`M${x - 6} ${GROUND - 4}h${w + 12}v4h${-(w + 12)}Z`} />
    </g>
  );
}

function Chimney({ x, top, h, delay = 0 }: { readonly x: number; readonly top: number; readonly h: number; readonly delay?: number }) {
  const y = top - h;
  return (
    <g>
      <g className={styles.smoke}>
        {[0, 1.3, 2.6].map((offset) => (
          <circle cx={x + 9} cy={y - 12} key={offset} r={5} style={{ animationDelay: `${delay + offset}s` }} />
        ))}
      </g>
      <path className={styles.solid} d={`M${x} ${top + 14}V${y}h18V${top + 14}`} />
      <path className={styles.solid} d={`M${x - 3} ${y - 5}h24v5h-24Z`} />
      <path className={styles.detail} d={`M${x} ${y + 9}h18M${x} ${y + 18}h18M${x + 9} ${y}v9M${x + 5} ${y + 9}v9M${x + 13} ${y + 9}v9`} />
    </g>
  );
}

/** Rows of shingles: short strokes that follow a gable's slope. */
function gableShingles(mid: number, top: number, half: number, roof: number): string {
  return [0.28, 0.52, 0.76]
    .map((at) => {
      const reach = half * at - 10;
      return reach > 6 ? `M${n(mid - reach)} ${n(top - roof * (1 - at))}h${n(reach * 2)}` : "";
    })
    .join("");
}

// ── Houses ──────────────────────────────────────────────────────────────────

/** A front-gabled house: attic window, chimney, shuttered windows, an optional porch. */
function GableHouse({
  x,
  w,
  h,
  roof,
  porch = false,
  chimneyAt = 0.72,
  glow,
}: {
  readonly x: number;
  readonly w: number;
  readonly h: number;
  readonly roof: number;
  readonly porch?: boolean;
  readonly chimneyAt?: number;
  readonly glow: number;
}) {
  const top = GROUND - h;
  const mid = x + w / 2;
  const half = w / 2 + 14;
  const doorTop = GROUND - 48;
  return (
    <g>
      <Chimney delay={glow} h={roof * 0.62} top={top - roof * (1 - Math.abs(chimneyAt - 0.5) * 2) + 4} x={x + w * chimneyAt - 9} />
      <path className={styles.solid} d={`M${x} ${top}h${w}V${GROUND}h${-w}Z`} />
      <path className={styles.detail} d={`M${x} ${GROUND - 9}h${w}M${x + 6} ${top + 12}h${w - 12}`} />
      {/* Roof, with a second line for the bargeboard */}
      <path className={styles.solid} d={`M${x - 14} ${top + 3}L${mid} ${top - roof}L${x + w + 14} ${top + 3}l-5 3L${mid} ${top - roof + 8}L${x - 9} ${top + 6}Z`} />
      <path className={styles.solid} d={`M${x - 3} ${top + 2}L${mid} ${top - roof + 8}L${x + w + 3} ${top + 2}Z`} />
      <path className={styles.detail} d={gableShingles(mid, top, half, roof)} />
      <circle className={styles.solid} cx={mid} cy={top - roof * 0.36} r={9} />
      <path className={styles.detail} d={`M${mid - 9} ${top - roof * 0.36}h18M${mid} ${top - roof * 0.36 - 9}v18`} />
      <Win box glow={glow} shutters x={x + 22} y={top + 24} />
      <Win shutters x={x + w - 46} y={top + 24} />
      {porch ? (
        <g>
          <path className={styles.line} d={`M${mid - 24} ${doorTop - 2}V${GROUND}M${mid + 24} ${doorTop - 2}V${GROUND}`} />
          <path className={styles.solid} d={`M${mid - 31} ${doorTop - 2}L${mid} ${doorTop - 22}L${mid + 31} ${doorTop - 2}Z`} />
        </g>
      ) : (
        <g>
          <path className={styles.line} d={`M${mid + 20} ${doorTop + 4}v6`} />
          <circle className={styles.lamp} cx={mid + 20} cy={doorTop + 13} r={3} style={{ animationDelay: `${glow}s` }} />
        </g>
      )}
      <Door cx={mid} />
    </g>
  );
}

/** A low, side-gabled bungalow with a dormer and a garage. */
function Bungalow({ x, w, h, roof, glow }: { readonly x: number; readonly w: number; readonly h: number; readonly roof: number; readonly glow: number }) {
  const top = GROUND - h;
  const garage = x + w - 68;
  return (
    <g>
      <path className={styles.solid} d={`M${x} ${top}h${w}V${GROUND}h${-w}Z`} />
      <path className={styles.detail} d={`M${x} ${GROUND - 9}h${w - 74}`} />
      <path className={styles.solid} d={`M${x - 12} ${top + 3}L${x + 12} ${top - roof}h${w - 24}L${x + w + 12} ${top + 3}Z`} />
      <path
        className={styles.detail}
        d={`M${x + 2} ${top - roof * 0.3}h${w - 4}M${x + 8} ${top - roof * 0.62}h${w - 16}${[0.2, 0.42, 0.64, 0.86]
          .map((at) => `M${n(x + w * at)} ${top - roof * 0.3}v${n(roof * 0.3)}M${n(x + w * (at - 0.1))} ${n(top - roof * 0.62)}v${n(roof * 0.32)}`)
          .join("")}`}
      />
      {/* Dormer */}
      <path className={styles.solid} d={`M${x + 34} ${top - 4}v-22h30v22Z`} />
      <path className={styles.solid} d={`M${x + 29} ${top - 25}L${x + 49} ${top - 40}L${x + 69} ${top - 25}Z`} />
      <path className={styles.detail} d={`M${x + 40} ${top - 20}h18v13h-18ZM${x + 49} ${top - 20}v13`} />
      <Win glow={glow} x={x + 16} y={top + 22} />
      <Door cx={x + 68} h={42} />
      {/* Garage */}
      <path className={styles.solid} d={`M${garage} ${GROUND}v-52h56v52`} />
      <path className={styles.detail} d={`M${garage} ${GROUND - 39}h56M${garage} ${GROUND - 26}h56M${garage} ${GROUND - 13}h56M${garage + 10} ${GROUND - 47}h8v5h-8ZM${garage + 24} ${GROUND - 47}h8v5h-8ZM${garage + 38} ${GROUND - 47}h8v5h-8Z`} />
      <circle className={styles.lamp} cx={garage + 28} cy={GROUND - 60} r={3} style={{ animationDelay: `${glow + 2}s` }} />
    </g>
  );
}

/** A two-storey townhouse with a hipped roof, arched windows and a balcony. */
function Townhouse({ x, w, h, roof, glow }: { readonly x: number; readonly w: number; readonly h: number; readonly roof: number; readonly glow: number }) {
  const top = GROUND - h;
  const floor = top + h * 0.47;
  return (
    <g>
      <Chimney delay={glow} h={24} top={top - roof + 2} x={x + w - 44} />
      <path className={styles.solid} d={`M${x} ${top}h${w}V${GROUND}h${-w}Z`} />
      <path className={styles.detail} d={`M${x} ${floor}h${w}M${x} ${floor + 5}h${w}M${x} ${GROUND - 9}h${w}`} />
      <path className={styles.solid} d={`M${x - 12} ${top + 3}L${x + 16} ${top - roof}h${w - 32}L${x + w + 12} ${top + 3}Z`} />
      <path className={styles.detail} d={`M${x + 4} ${top - roof * 0.5}h${w - 8}M${x - 8} ${top + 8}h${w + 16}`} />
      <Win arched h={34} x={x + 18} y={top + 18} />
      <Win arched glow={glow} h={34} x={x + w - 42} y={top + 18} />
      {/* Balcony under the lit window */}
      <path
        className={styles.line}
        d={`M${x + w - 50} ${top + 56}h40M${x + w - 50} ${top + 44}h40${[0, 8, 16, 24, 32, 40].map((dx) => `M${x + w - 50 + dx} ${top + 44}v12`).join("")}`}
      />
      <Door cx={x + 32} h={46} />
      <path className={styles.solid} d={`M${x + 14} ${GROUND - 56}h36l4 6h-44Z`} />
      <Win box h={30} w={36} x={x + w - 52} y={floor + 22} />
    </g>
  );
}

/** A small cottage with a wide chimney and a round-topped door. */
function Cottage({ x, w, h, roof, glow }: { readonly x: number; readonly w: number; readonly h: number; readonly roof: number; readonly glow: number }) {
  const top = GROUND - h;
  const mid = x + w * 0.36;
  return (
    <g>
      <Chimney delay={glow} h={30} top={top - roof + 6} x={x + w - 46} />
      <path className={styles.solid} d={`M${x} ${top}h${w}V${GROUND}h${-w}Z`} />
      <path className={styles.detail} d={`M${x} ${GROUND - 9}h${w}`} />
      <path className={styles.solid} d={`M${x - 12} ${top + 3}Q${x + 2} ${top - roof * 0.7} ${x + 18} ${top - roof}h${w - 36}Q${x + w - 2} ${top - roof * 0.7} ${x + w + 12} ${top + 3}Z`} />
      <path className={styles.detail} d={`M${x + 4} ${top - roof * 0.34}h${w - 8}M${x + 11} ${top - roof * 0.68}h${w - 22}`} />
      {/* Round-topped door */}
      <path className={styles.solid} d={`M${mid - 13} ${GROUND - 4}v-30a13 13 0 0 1 26 0v30Z`} />
      <path className={styles.detail} d={`M${mid} ${GROUND - 47}v43M${mid - 13} ${GROUND - 34}h26`} />
      <circle className={styles.knob} cx={mid + 8} cy={GROUND - 22} r={1.5} />
      <path className={styles.solid} d={`M${mid - 19} ${GROUND - 4}h38v4h-38Z`} />
      <Win box glow={glow} shutters w={26} x={x + w - 48} y={top + 26} />
      <path className={styles.line} d={`M${x + 12} ${top + 30}v6`} />
      <circle className={styles.lamp} cx={x + 12} cy={top + 39} r={3} style={{ animationDelay: `${glow + 1}s` }} />
    </g>
  );
}

/** GoodEnough's own office on the corner: a sign with the shield, a striped awning, a shop window. */
function Office({ x, w, h }: { readonly x: number; readonly w: number; readonly h: number }) {
  const top = GROUND - h;
  const awning = top + 46;
  const stripes = 9;
  const step = (w - 12) / stripes;
  return (
    <g>
      <path className={styles.solid} d={`M${x} ${top}h${w}V${GROUND}h${-w}Z`} />
      <path className={styles.solid} d={`M${x - 6} ${top - 9}h${w + 12}v9h${-(w + 12)}Z`} />
      <path className={styles.detail} d={`M${x - 2} ${top - 4}h${w + 4}M${x} ${GROUND - 9}h${w}`} />
      {/* Sign */}
      <path className={styles.solid} d={`M${x + 22} ${top + 10}h${w - 44}a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4h${-(w - 44)}a4 4 0 0 1-4-4v-20a4 4 0 0 1 4-4Z`} />
      <g transform={`translate(${x + 30} ${top + 13.5}) scale(0.66)`}>
        <path className={styles.badge} d="M16 1.75 28.25 6v9.25c0 7.4-5.1 12.9-12.25 15-7.15-2.1-12.25-7.6-12.25-15V6L16 1.75Z" />
        <path className={styles.badgeMark} d="M16 9.25 23.5 15.6h-2.1v7.15h-3.6v-4.1h-3.6v4.1h-3.6V15.6H8.5L16 9.25Z" />
      </g>
      <text className={styles.sign} x={x + 56} y={top + 29}>
        GoodEnough
      </text>
      {/* Awning */}
      <path className={styles.accent} d={`M${x + 12} ${awning}h${w - 24}l6 16h${-(w - 12)}Z`} />
      <path
        className={styles.accent}
        d={`M${x + 6} ${awning + 16}${Array.from({ length: stripes }, () => `q${n(step / 2)} 9 ${n(step)} 0`).join("")}`}
      />
      <path
        className={styles.accentLine}
        d={Array.from({ length: stripes - 1 }, (_, index) => {
          const at = (index + 1) / stripes;
          return `M${n(x + 12 + (w - 24) * at)} ${awning}L${n(x + 6 + (w - 12) * at)} ${awning + 16}`;
        }).join("")}
      />
      {/* Shop window, with a plant and a desk lamp inside */}
      <path className={styles.glow} d={`M${x + 14} ${awning + 30}h${w - 84}V${GROUND - 14}h${-(w - 84)}Z`} style={{ animationDelay: "2.4s" }} />
      <path
        className={styles.detail}
        d={`M${x + 14 + (w - 84) / 2} ${awning + 30}V${GROUND - 14}M${x + 22} ${awning + 52}l16-16M${x + 22} ${awning + 62}l26-26M${x + w - 100} ${GROUND - 14}v-9h12v9M${x + w - 94} ${GROUND - 23}c-9-6-7-13-1-15c-1 6 1 9 1 15c0-8 3-13 8-15c0 7-3 10-8 15`}
      />
      <path className={styles.line} d={`M${x + 11} ${GROUND - 11.5}h${w - 78}`} />
      <Door cx={x + w - 34} glass h={50} w={32} />
      <path className={styles.accentLine} d={`M${x + w - 44} ${GROUND - 32}v10`} />
    </g>
  );
}

// ── Greenery and street furniture ───────────────────────────────────────────

function RoundTree({ x, r, delay }: { readonly x: number; readonly r: number; readonly delay: number }) {
  const trunk = r * 1.4;
  const cy = GROUND - trunk - r * 0.5;
  return (
    <g className={styles.sway} style={{ animationDelay: `-${delay}s` }}>
      <path
        className={styles.solid}
        d={`M${x - r * 0.13} ${GROUND}L${x - r * 0.08} ${GROUND - trunk}h${n(r * 0.16)}L${x + r * 0.13} ${GROUND}Z`}
      />
      <path className={styles.line} d={`M${x} ${GROUND - trunk * 0.62}l${n(r * 0.38)} ${n(-r * 0.4)}M${x} ${GROUND - trunk * 0.78}l${n(-r * 0.3)} ${n(-r * 0.32)}`} />
      <path
        className={styles.solid}
        d={`M${x - r} ${GROUND - trunk - r * 0.6}a${r} ${r} 0 0 1 ${r * 0.5}-${r * 0.95}a${r * 0.8} ${r * 0.8} 0 0 1 ${r * 1.2} 0a${r} ${r} 0 0 1 ${r * 0.3} ${r * 1.5}a${r * 0.7} ${r * 0.7} 0 0 1-${r * 0.9} ${r * 0.5}a${r * 0.8} ${r * 0.8} 0 0 1-${r * 1.1}-${r * 1.05}Z`}
      />
      {/* A few leaf curls inside the crown */}
      <path
        className={styles.detail}
        d={`M${n(x - r * 0.55)} ${n(cy - r * 0.2)}q${n(r * 0.18)} ${n(-r * 0.3)} ${n(r * 0.46)} ${n(-r * 0.12)}M${n(x + r * 0.05)} ${n(cy - r * 0.62)}q${n(r * 0.22)} ${n(-r * 0.22)} ${n(r * 0.46)} 0M${n(x + r * 0.1)} ${n(cy + r * 0.28)}q${n(r * 0.24)} ${n(-r * 0.26)} ${n(r * 0.5)} ${n(-r * 0.04)}M${n(x - r * 0.5)} ${n(cy + r * 0.42)}q${n(r * 0.16)} ${n(-r * 0.2)} ${n(r * 0.38)} ${n(-r * 0.05)}`}
      />
    </g>
  );
}

function Pine({ x, h, delay }: { readonly x: number; readonly h: number; readonly delay: number }) {
  const w = h * 0.3;
  const base = GROUND - h * 0.14;
  const tier = (bottom: number, half: number, rise: number) =>
    `M${n(x - half)} ${n(bottom)}L${x} ${n(bottom - rise)}L${n(x + half)} ${n(bottom)}q${n(-half)} ${n(half * 0.3)} ${n(-half * 2)} 0Z`;
  return (
    <g className={styles.sway} style={{ animationDelay: `-${delay}s` }}>
      <path className={styles.solid} d={`M${x - 3} ${GROUND}V${base}h6V${GROUND}Z`} />
      <path className={styles.solid} d={tier(base, w, h * 0.42)} />
      <path className={styles.solid} d={tier(base - h * 0.26, w * 0.8, h * 0.36)} />
      <path className={styles.solid} d={tier(base - h * 0.5, w * 0.58, h * 0.36)} />
    </g>
  );
}

function Bush({ x, w }: { readonly x: number; readonly w: number }) {
  const r = w / 5;
  return (
    <path
      className={styles.solid}
      d={`M${x} ${GROUND}a${r} ${r} 0 0 1 ${n(r * 0.9)} ${n(-r * 1.1)}a${n(r * 1.1)} ${n(r * 1.1)} 0 0 1 ${n(r * 1.9)} ${n(-r * 0.4)}a${r} ${r} 0 0 1 ${n(r * 1.6)} ${n(r * 0.5)}a${n(r * 0.9)} ${n(r * 0.9)} 0 0 1 ${n(r * 0.6)} ${r}Z`}
    />
  );
}

function Fence({ from, to }: { readonly from: number; readonly to: number }) {
  const pickets: string[] = [];
  for (let x = from; x + 6 <= to; x += 10) pickets.push(`M${x} ${GROUND}v-17l3-4l3 4v17`);
  return (
    <g>
      <path className={styles.line} d={`M${from} ${GROUND - 6}H${to}M${from} ${GROUND - 13}H${to}`} />
      <path className={styles.solid} d={pickets.join("")} />
    </g>
  );
}

function StreetLamp({ x, delay }: { readonly x: number; readonly delay: number }) {
  return (
    <g>
      <circle className={styles.halo} cx={x} cy={GROUND - 84} r={17} style={{ animationDelay: `${delay}s` }} />
      <path className={styles.line} d={`M${x} ${GROUND}V${GROUND - 74}M${x - 4} ${GROUND}h8M${x - 3} ${GROUND - 6}h6`} />
      <path className={styles.solid} d={`M${x - 7} ${GROUND - 74}h14l-3-15h-8Z`} />
      <path className={styles.line} d={`M${x - 6} ${GROUND - 89}h12M${x} ${GROUND - 89}v-4`} />
    </g>
  );
}

function Mailbox({ x }: { readonly x: number }) {
  return (
    <g>
      <path className={styles.line} d={`M${x} ${GROUND}v-26`} />
      <path className={styles.solid} d={`M${x - 11} ${GROUND - 26}h22v-10a8 8 0 0 0-8-8h-6a8 8 0 0 0-8 8Z`} />
      <path className={styles.accent} d={`M${x + 11} ${GROUND - 36}v-12h8v6h-8`} />
    </g>
  );
}

function Hydrant({ x }: { readonly x: number }) {
  return (
    <path
      className={styles.accent}
      d={`M${x - 5} ${GROUND}v-13h10v13ZM${x - 7} ${GROUND - 13}h14M${x - 4} ${GROUND - 13}a4 4 0 0 1 8 0M${x - 5} ${GROUND - 8}h-3v-3h3M${x + 5} ${GROUND - 8}h3v-3h-3`}
    />
  );
}

function Bench({ x }: { readonly x: number }) {
  return (
    <path
      className={styles.line}
      d={`M${x} ${GROUND - 12}h40M${x} ${GROUND - 20}h40M${x} ${GROUND - 26}h40M${x + 4} ${GROUND}v-26M${x + 36} ${GROUND}v-26M${x - 3} ${GROUND - 12}v12M${x + 43} ${GROUND - 12}v12`}
    />
  );
}

/** Tufts of grass along the foot of the lawns. */
const GRASS = [18, 236, 282, 478, 548, 716, 990, 1066, 1262, 1318, 1486, 1574]
  .map((x) => `M${x} ${GROUND}l-3-7M${x + 3} ${GROUND}l1-9M${x + 6} ${GROUND}l4-6`)
  .join("");

// ── Sky and distance ────────────────────────────────────────────────────────

function Cloud({ className, y, scale }: { readonly className: string; readonly y: number; readonly scale: number }) {
  return (
    <g className={className}>
      <g transform={`translate(0 ${y}) scale(${scale})`}>
        <path className={styles.cloud} d="M2 40a17 17 0 0 1 18-22a26 26 0 0 1 48-6a20 20 0 0 1 30 18a13 13 0 0 1 6 10Z" />
        <path className={styles.wisp} d="M30 30a12 12 0 0 1 16-9M62 27a10 10 0 0 1 13-5M-14 48h34M112 48h22" />
      </g>
    </g>
  );
}

function Balloon({ x, y, scale, className, far = false }: { readonly x: number; readonly y: number; readonly scale: number; readonly className: string; readonly far?: boolean }) {
  return (
    <g className={className}>
      <g transform={`translate(${x} ${y}) scale(${scale})`}>
        <path className={far ? styles.farSolid : styles.solid} d="M0-48c22 0 36 16 36 34c0 16-10 28-24 44h-24C-26 14-36 2-36-14c0-18 14-34 36-34Z" />
        {far ? null : <path className={styles.accent} d="M0-48c11 6 15 20 15 34c0 15-4 28-9 44h-12c-5-16-9-29-9-44c0-14 4-28 15-34Z" />}
        <path className={far ? styles.far : styles.detail} d="M0-48v78M-36-14c10 5 62 5 72 0" />
        <path className={far ? styles.far : styles.line} d="M-12 30l4 14M12 30l-4 14M0 30v14" />
        <path className={far ? styles.farSolid : styles.solid} d="M-10 44h20l-2 13h-16Z" />
        {far ? null : <path className={styles.detail} d="M-9 48.5h18M-8 53h16" />}
      </g>
    </g>
  );
}

interface Tower {
  readonly x: number;
  readonly w: number;
  readonly h: number;
  readonly top?: "antenna" | "tank" | "step" | "gable";
}

const SKYLINE: readonly Tower[] = [
  { x: 6, w: 50, h: 94, top: "step" },
  { x: 204, w: 62, h: 150, top: "antenna" },
  { x: 268, w: 40, h: 108 },
  { x: 468, w: 56, h: 128, top: "tank" },
  { x: 526, w: 36, h: 96 },
  { x: 690, w: 54, h: 176, top: "antenna" },
  { x: 746, w: 44, h: 132, top: "step" },
  { x: 960, w: 60, h: 158, top: "tank" },
  { x: 1022, w: 44, h: 116, top: "gable" },
  { x: 1236, w: 58, h: 142, top: "step" },
  { x: 1296, w: 36, h: 104 },
  { x: 1468, w: 56, h: 136, top: "antenna" },
  { x: 1526, w: 62, h: 100, top: "gable" },
];

function Skyline() {
  return (
    <g className={styles.town}>
      {SKYLINE.map(({ x, w, h, top }) => {
        const y = GROUND - h;
        const rows: string[] = [];
        for (let row = y + 16; row < GROUND - 96; row += 15) rows.push(`M${x + 9} ${row}H${x + w - 6}`);
        return (
          <g key={x}>
            <path className={styles.farSolid} d={`M${x} ${GROUND}V${y}h${w}V${GROUND}`} />
            <path className={styles.windows} d={rows.join("")} />
            {top === "antenna" ? <path className={styles.far} d={`M${x + w / 2} ${y}v-26M${x + w / 2 - 6} ${y - 14}h12M${x + w / 2 - 10} ${y}h20v-6h-20Z`} /> : null}
            {top === "tank" ? (
              <path className={styles.farSolid} d={`M${x + 12} ${y}v-8M${x + 30} ${y}v-8M${x + 9} ${y - 8}h24v-13h-24ZM${x + 9} ${y - 21}l12-7l12 7`} />
            ) : null}
            {top === "step" ? <path className={styles.farSolid} d={`M${x + 8} ${y}v-12h${w - 16}v12`} /> : null}
            {top === "gable" ? <path className={styles.farSolid} d={`M${x} ${y}l${w / 2} -18l${w / 2} 18`} /> : null}
          </g>
        );
      })}
    </g>
  );
}

// ── Things that move along the street ───────────────────────────────────────

function Car() {
  return (
    <g className={styles.car}>
      <g transform="translate(0 400)">
        <path
          className={styles.carBody}
          d="M8 26V15c0-4 2-6 6-7l15-2L42-8c2-2 4-3 7-3h30c3 0 5 1 7 3l14 14 21 3c6 1 9 4 9 9v6c0 2-1 3-3 3H11c-2 0-3-1-3-1Z"
        />
        <path className={styles.line} d="M38 6 49-5c1-1 2-1 3-1h13V6ZM70-6h9c1 0 2 0 3 1L93 6H70ZM67 6v18M8 17h122M74 11h7" />
        <path className={styles.accent} d="M124 10.5l5 1c1 0 1 1 1 2v2h-6Z" />
        {[36, 104].map((cx) => (
          <g key={cx}>
            <circle className={styles.solid} cx={cx} cy={26} r={11.5} />
            <circle className={styles.detail} cx={cx} cy={26} r={5.5} />
            <path className={`${styles.detail} ${styles.wheel}`} d={`M${cx - 10} 26h20M${cx} 16v20`} />
          </g>
        ))}
      </g>
    </g>
  );
}

/** Someone out for a walk, dry under a burgundy umbrella: cover, in one small picture. */
function Walker() {
  return (
    <g className={styles.walker}>
      <g transform={`translate(0 ${GROUND})`}>
        <path className={`${styles.line} ${styles.legA}`} d="M0-19V0" />
        <path className={`${styles.line} ${styles.legB}`} d="M0-19V0" />
        <path className={styles.solid} d="M-6-36c4-3 8-3 12 0l3 19h-18Z" />
        <circle className={styles.solid} cx={0} cy={-42} r={5.2} />
        <path className={styles.line} d="M-5-31l-6 4v-33" />
        <path className={styles.accent} d="M-33-58a22 16 0 0 1 44 0q-5.5-5-11 0q-5.5-5-11 0q-5.5-5-11 0q-5.5-5-11 0Z" />
        <path className={styles.accentLine} d="M-11-74v-4M-22-58q2-12 11-16q9 4 11 16" />
      </g>
    </g>
  );
}

function Layer({ children }: { readonly children: ReactNode }) {
  return <g>{children}</g>;
}

export function NeighborhoodScene({ className }: { readonly className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={`${styles.scene} ${className ?? ""}`}
      focusable="false"
      preserveAspectRatio="xMidYMax slice"
      viewBox="0 0 1600 440"
    >
      {/* Sky */}
      <Layer>
        <g transform="translate(236 96)">
          <path className={`${styles.far} ${styles.rays}`} d="M0-46v-12M0 46v12M-46 0h-12M46 0h12M-33-33l-8-8M33-33l8-8M-33 33l-8 8M33 33l8 8" />
          <circle className={styles.farSolid} r={30} />
        </g>
        <Balloon className={styles.balloonFar} far scale={0.5} x={372} y={128} />
        <Cloud className={`${styles.drift} ${styles.slow}`} scale={1.3} y={66} />
        <Cloud className={`${styles.drift} ${styles.slower}`} scale={0.9} y={150} />
        <Cloud className={`${styles.drift} ${styles.slowest}`} scale={1.6} y={22} />
        <g className={styles.birds}>
          <path className={styles.line} d="M0 0q6-7 12 0q6-7 12 0M30 13q5-6 10 0q5-6 10 0M14 26q4-5 8 0q4-5 8 0M52-8q4-5 8 0q4-5 8 0" />
        </g>
        <Balloon className={styles.balloon} scale={1} x={1318} y={92} />
      </Layer>

      {/* Hills, then the town in front of them */}
      <path className={styles.hill} d="M0 392V322C150 268 300 262 430 300C560 338 640 286 800 280C960 274 1040 330 1180 312C1330 292 1450 262 1600 300V392Z" />
      <path className={styles.far} d="M118 300l7-16l7 16M132 298l6-13l6 13M842 281l7-16l7 16M1392 280l7-16l7 16M1406 278l6-13l6 13" />
      <Skyline />

      {/* The street, back to front */}
      <Layer>
        <RoundTree delay={0.6} r={34} x={22} />
        <GableHouse glow={0} h={118} roof={72} w={150} x={62} />
        <RoundTree delay={0} r={30} x={246} />
        <Mailbox x={282} />
        <Bungalow glow={3.2} h={92} roof={44} w={176} x={306} />
        <Pine delay={1.1} h={96} x={508} />
        <StreetLamp delay={0.5} x={540} />
        <Townhouse glow={1.6} h={152} roof={34} w={128} x={566} />
        <Bush w={46} x={700} />
        <RoundTree delay={0.4} r={25} x={742} />
        <Office h={116} w={196} x={776} />
        <StreetLamp delay={2.1} x={992} />
        <Bench x={1004} />
        <RoundTree delay={1.8} r={32} x={1070} />
        <GableHouse chimneyAt={0.26} glow={4.4} h={124} porch roof={76} w={150} x={1106} />
        <Fence from={1262} to={1338} />
        <Pine delay={0.9} h={84} x={1290} />
        <Hydrant x={1324} />
        <Cottage glow={2.4} h={96} roof={50} w={136} x={1346} />
        <Fence from={1490} to={1600} />
        <RoundTree delay={1.4} r={36} x={1528} />
        <Pine delay={0.2} h={70} x={1586} />
        <path className={styles.detail} d={GRASS} />
      </Layer>

      {/* Pavement and road */}
      <path className={styles.line} d="M0 392H1600M0 400H1600" />
      <path className={styles.detail} d={Array.from({ length: 21 }, (_, index) => `M${index * 80 + 30} 392v8`).join("")} />
      <path className={styles.dash} d="M0 422H1600" />

      <Walker />
      <Car />
    </svg>
  );
}
