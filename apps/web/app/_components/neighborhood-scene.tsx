import styles from "./neighborhood-scene.module.css";

/**
 * The home hero's animated background: a line-drawn street of houses, trees, drifting clouds,
 * a balloon and a passing car. It is plain SVG animated by CSS (no JavaScript, no images), so it
 * ships in the prerendered shell, costs nothing to hydrate, and stops for reduced motion.
 */

const GROUND = 392;

interface House {
  readonly x: number;
  readonly w: number;
  readonly h: number;
  readonly roof: number;
  readonly chimney?: boolean;
  /** Which window glows, and when, so the street doesn't blink in unison. */
  readonly glowDelay: number;
}

const HOUSES: readonly House[] = [
  { x: 110, w: 160, h: 118, roof: 72, chimney: true, glowDelay: 0 },
  { x: 410, w: 118, h: 96, roof: 58, glowDelay: 3.2 },
  { x: 1000, w: 176, h: 128, roof: 80, chimney: true, glowDelay: 1.6 },
  { x: 1330, w: 128, h: 104, roof: 64, glowDelay: 4.4 },
];

const TREES: readonly { x: number; r: number; delay: number }[] = [
  { x: 330, r: 30, delay: 0 },
  { x: 620, r: 38, delay: 1.1 },
  { x: 780, r: 26, delay: 0.4 },
  { x: 900, r: 34, delay: 1.8 },
  { x: 1250, r: 30, delay: 0.9 },
  { x: 1540, r: 36, delay: 1.4 },
];

function HouseShape({ x, w, h, roof, chimney, glowDelay }: House) {
  const top = GROUND - h;
  const mid = x + w / 2;
  const win = 24;
  return (
    <g>
      {chimney ? <rect className={styles.solid} height={roof * 0.7} width={18} x={x + w * 0.7} y={top - roof * 0.7} /> : null}
      {chimney ? (
        <g className={styles.smoke}>
          <circle cx={x + w * 0.7 + 9} cy={top - roof * 0.7 - 10} r={5} />
          <circle cx={x + w * 0.7 + 9} cy={top - roof * 0.7 - 10} r={5} style={{ animationDelay: "1.3s" }} />
          <circle cx={x + w * 0.7 + 9} cy={top - roof * 0.7 - 10} r={5} style={{ animationDelay: "2.6s" }} />
        </g>
      ) : null}
      <rect className={styles.solid} height={h} width={w} x={x} y={top} />
      <path className={styles.solid} d={`M${x - 12} ${top} L${mid} ${top - roof} L${x + w + 12} ${top} Z`} />
      <circle className={styles.line} cx={mid} cy={top - roof * 0.42} r={8} />
      <rect className={styles.solid} height={38} rx={2} width={26} x={mid - 13} y={GROUND - 38} />
      <circle className={styles.line} cx={mid + 7} cy={GROUND - 19} r={1.5} />
      {[x + 18, x + w - 18 - win].map((wx, index) => (
        <g key={wx}>
          <rect
            className={index === 0 ? styles.glow : styles.solid}
            height={win}
            style={index === 0 ? { animationDelay: `${glowDelay}s` } : undefined}
            width={win}
            x={wx}
            y={top + 22}
          />
          <path className={styles.line} d={`M${wx + win / 2} ${top + 22}v${win}M${wx} ${top + 22 + win / 2}h${win}`} />
        </g>
      ))}
    </g>
  );
}

function Tree({ x, r, delay }: { readonly x: number; readonly r: number; readonly delay: number }) {
  const trunk = r * 1.4;
  return (
    <g className={styles.tree} style={{ animationDelay: `-${delay}s` }}>
      <path className={styles.line} d={`M${x} ${GROUND}V${GROUND - trunk}M${x} ${GROUND - trunk * 0.55}l${r * 0.35} -${r * 0.35}`} />
      <path
        className={styles.solid}
        d={`M${x - r} ${GROUND - trunk - r * 0.6}a${r} ${r} 0 0 1 ${r * 0.5}-${r * 0.95}a${r * 0.8} ${r * 0.8} 0 0 1 ${r * 1.2} 0a${r} ${r} 0 0 1 ${r * 0.3} ${r * 1.5}a${r * 0.7} ${r * 0.7} 0 0 1-${r * 0.9} ${r * 0.5}a${r * 0.8} ${r * 0.8} 0 0 1-${r * 1.1}-${r * 1.05}Z`}
      />
    </g>
  );
}

function Cloud({ className, y, scale }: { readonly className: string; readonly y: number; readonly scale: number }) {
  return (
    <g className={className}>
      <path
        className={styles.cloud}
        d="M0 40a18 18 0 0 1 20-22a26 26 0 0 1 48-6a20 20 0 0 1 30 18a14 14 0 0 1 2 10Z"
        transform={`translate(0 ${y}) scale(${scale})`}
      />
    </g>
  );
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
      <Cloud className={`${styles.drift} ${styles.slow}`} scale={1.3} y={70} />
      <Cloud className={`${styles.drift} ${styles.slower}`} scale={0.9} y={140} />
      <Cloud className={`${styles.drift} ${styles.slowest}`} scale={1.6} y={30} />
      <g className={styles.birds}>
        <path className={styles.line} d="M0 0q6-6 12 0q6-6 12 0M30 12q5-5 10 0q5-5 10 0M14 24q4-4 8 0q4-4 8 0" />
      </g>
      <g className={styles.balloon}>
        <path className={styles.solid} d="M1290 70a34 34 0 1 1 48 0l-14 26h-20Z" />
        <path className={styles.accent} d="M1314 22c-10 12-10 50 0 74c10-24 10-62 0-74Z" />
        <rect className={styles.solid} height={12} rx={2} width={18} x={1305} y={102} />
        <path className={styles.line} d="M1304 96l2 6M1324 96l-2 6" />
      </g>

      {/* Skyline in the distance */}
      <path
        className={styles.far}
        d="M0 392V300h54v-36h48v62h40V232h66v160M208 392V268h52v-30h44v154M340 392V292h58v-56h40v156M560 392V250h60v142M640 392V286h46v-48h52v154M820 392V230h72v162M920 392V280h48v-34h36v146M1200 392V246h56v-28h40v174M1480 392V270h60v-30h60v152"
      />

      {/* Street */}
      {HOUSES.map((house) => (
        <HouseShape key={house.x} {...house} />
      ))}
      {TREES.map((tree) => (
        <Tree key={tree.x} {...tree} />
      ))}
      <path className={styles.line} d="M560 392v-74m-8 0h16l-4-14h-8Z M1180 392v-74m-8 0h16l-4-14h-8Z" />
      <path className={styles.line} d="M300 392v-30m-10 0h22v-14a8 8 0 0 0-8-8h-6a8 8 0 0 0-8 8Z" />
      <path className={styles.accent} d="M312 352v-10h8v5h-8" />

      {/* Road */}
      <path className={styles.line} d="M0 392H1600M0 400H1600" />
      <path className={styles.dash} d="M0 422H1600" />

      <g className={styles.car}>
        <g transform="translate(0 400)">
          <path
            className={styles.carBody}
            d="M10 26H120a6 6 0 0 0 6-6V14a6 6 0 0 0-6-6H98L80-10H42L24 8H14a6 6 0 0 0-6 6v6a6 6 0 0 0 2 6Z"
          />
          <path className={styles.line} d="M44-4h16v12H32ZM66-4h12l12 12H66Z" />
          {[32, 98].map((cx) => (
            <g key={cx}>
              <circle className={styles.solid} cx={cx} cy={26} r={11} />
              <path className={`${styles.line} ${styles.wheel}`} d={`M${cx - 6} 26h12M${cx} 20v12`} />
            </g>
          ))}
        </g>
      </g>
    </svg>
  );
}
