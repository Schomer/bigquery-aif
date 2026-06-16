'use client';
import React from 'react';

interface Props {
  width?: number | string;
  height?: number | string;
  size?: number;
  /** When true, animations are paused until the user hovers over the logo */
  hoverOnly?: boolean;
  /**
   * When true, forces animations to run even when the SVG itself isn't hovered.
   * Use this when a parent element (e.g. a header row) controls the hover state.
   */
  forceAnimate?: boolean;
  className?: string;
  style?: React.CSSProperties;
  'aria-hidden'?: boolean | 'true' | 'false';
  alt?: string;
}

/**
 * Animated crystal-ball logo with orbiting Gemini-style sparks.
 *
 * hoverOnly={true}  → static until hovered (sidebar use-case)
 * hoverOnly={false} → always animating (landing / home page)
 */
export function AnimatedCrystalBall({
  width,
  height,
  size = 48,
  hoverOnly = false,
  forceAnimate = false,
  className,
  style,
  ...rest
}: Props) {
  const uid = React.useId().replace(/:/g, 'u');

  const w = width ?? size;
  const h = height ?? size;

  const BX = 24, BY = 20.43; // ball centre in viewBox coords

  /** 4-pointed Gemini-style spark centred at origin, half-length = r */
  function spark(r: number): string {
    const c = r * 0.16;
    return (
      `M0,${-r} C${c},${-c} ${c},${-c} ${r},0 ` +
      `C${c},${c} ${c},${c} 0,${r} ` +
      `C${-c},${c} ${-c},${c} ${-r},0 ` +
      `C${-c},${-c} ${-c},${-c} 0,${-r}Z`
    );
  }

  // When hoverOnly, all animation classes start paused and resume on SVG :hover
  // forceAnimate overrides the paused state (e.g. parent div is hovered)
  const hoverPause = (cls: string) =>
    hoverOnly
      ? `.${uid}root .${cls} { animation-play-state: paused; }
         .${uid}root:hover .${cls} { animation-play-state: running; }
         .${uid}root.${uid}forced .${cls} { animation-play-state: running; }`
      : '';

  const animClasses = [`${uid}o1`, `${uid}o2`, `${uid}o3`, `${uid}c`, `${uid}t1`, `${uid}t2`, `${uid}t3`];

  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={[`${uid}root`, forceAnimate ? `${uid}forced` : '', className].filter(Boolean).join(' ')}
      style={{ cursor: hoverOnly ? 'default' : undefined, ...style }}
      shapeRendering="geometricPrecision"
      {...rest}
    >
      <defs>
        <style>{`
          /* ── Keyframes ── */
          @keyframes ${uid}cw    { to { transform: rotate( 360deg); } }
          @keyframes ${uid}ccw   { to { transform: rotate(-360deg); } }
          @keyframes ${uid}pulse {
            0%,100% { opacity:.9;  transform:scale(1);  }
            50%     { opacity:.25; transform:scale(.55); }
          }
          @keyframes ${uid}tw {
            0%,100% { opacity:1;  }
            50%     { opacity:.1; }
          }

          /* ── Orbit / animation classes ── */
          .${uid}o1 { transform-origin:0 0; animation:${uid}cw   3.6s linear      infinite; }
          .${uid}o2 { transform-origin:0 0; animation:${uid}ccw  2.7s linear      infinite; }
          .${uid}o3 { transform-origin:0 0; animation:${uid}cw   5.8s linear      infinite; }
          .${uid}c  { transform-origin:0 0; animation:${uid}pulse 1.9s ease-in-out infinite; }
          .${uid}t1 { animation:${uid}tw 2.1s ease-in-out  .4s infinite; }
          .${uid}t2 { animation:${uid}tw 1.7s ease-in-out  .9s infinite; }
          .${uid}t3 { animation:${uid}tw 2.5s ease-in-out  .0s infinite; }

          /* ── Hover-only overrides (pause all, play on hover) ── */
          ${animClasses.map(hoverPause).join('\n')}

          /* ── Smooth transition into animation on hover ── */
          ${hoverOnly
            ? `.${uid}root { transition: filter .25s ease; }
               .${uid}root:hover { filter: drop-shadow(0 0 6px rgba(100,160,255,.55)); }
               .${uid}root.${uid}forced { filter: drop-shadow(0 0 6px rgba(100,160,255,.55)); }`
            : ''}
        `}</style>

        {/* Ball interior gradient */}
        <radialGradient id={`${uid}bg`} cx="36%" cy="27%" r="72%">
          <stop offset="0%"   stopColor="#6b9ef5" />
          <stop offset="30%"  stopColor="#2048a8" />
          <stop offset="100%" stopColor="#091028" />
        </radialGradient>

        {/* Ambient edge glow */}
        <radialGradient id={`${uid}eg`} cx="50%" cy="50%" r="50%">
          <stop offset="68%"  stopColor="#1b2e5d" stopOpacity="0"   />
          <stop offset="100%" stopColor="#2d6bff"  stopOpacity=".3" />
        </radialGradient>

        {/* Spark glow filter */}
        <filter id={`${uid}sf`} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="1.1" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Clip mask: sparks stay inside ball */}
        <clipPath id={`${uid}cp`}>
          <circle cx={BX} cy={BY} r="15" />
        </clipPath>
      </defs>

      {/* ── Ball body — outer dark ring + pedestal ── */}
      <path
        d="M38.5 18.93C37.67 18.93 37 19.6 37 20.43C37 27.6 31.17 33.43 24 33.43C16.83 33.43
           11 27.6 11 20.43C11 13.26 16.83 7.43 24 7.43C25.22 7.43 26.43 7.6 27.59 7.93C28.39
           8.16 29.22 7.7 29.44 6.9C29.67 6.1 29.21 5.27 28.41 5.05C26.98 4.64 25.5 4.43 24
           4.43C15.18 4.43 8 11.61 8 20.43C8 24.63 9.64 28.44 12.3 31.3L10.58 36.45C10.53 36.6
           10.5 36.76 10.5 36.92C10.5 39.58 15.31 43.42 24 43.42C32.69 43.42 37.5 39.58 37.5
           36.92C37.5 36.76 37.47 36.6 37.42 36.45L35.7 31.3C38.36 28.44 40 24.63 40 20.43C40
           19.6 39.33 18.93 38.5 18.93ZM13.57 36.97L14.74 33.45C15.91 34.28 17.19 34.96 18.56
           35.45L17.43 39.41C15.14 38.61 13.91 37.52 13.57 36.96V36.97Z"
        fill="#1b2e5d"
      />

      {/* ── Gradient ball fill ── */}
      <circle cx={BX} cy={BY} r="15.5" fill={`url(#${uid}bg)`} stroke="#1a2d5a" strokeWidth="1.2" />

      {/* ── Ambient edge glow ── */}
      <circle cx={BX} cy={BY} r="16" fill={`url(#${uid}eg)`} />

      {/* ── Animated Gemini sparks ── */}
      <g clipPath={`url(#${uid}cp)`} filter={`url(#${uid}sf)`}>

        {/* Orbit 1 – CW, two large white sparks (12 & 6 o'clock) */}
        <g transform={`translate(${BX},${BY})`}>
          <g className={`${uid}o1`}>
            <path d={spark(5.2)} transform="translate(0,-7.6)" fill="white"   opacity=".93" className={`${uid}t3`} />
            <path d={spark(5.2)} transform="translate(0, 7.6)" fill="white"   opacity=".93" className={`${uid}t3`} />
          </g>
        </g>

        {/* Orbit 2 – CCW, two medium blue sparks (3 & 9 o'clock) */}
        <g transform={`translate(${BX},${BY})`}>
          <g className={`${uid}o2`}>
            <path d={spark(3.8)} transform="translate(-7.6,0) rotate(45)" fill="#aad4ff" opacity=".8" className={`${uid}t1`} />
            <path d={spark(3.8)} transform="translate( 7.6,0) rotate(45)" fill="#aad4ff" opacity=".8" className={`${uid}t1`} />
          </g>
        </g>

        {/* Orbit 3 – CW slow, four tiny corner sparks */}
        <g transform={`translate(${BX},${BY})`}>
          <g className={`${uid}o3`}>
            <path d={spark(2.2)} transform="translate(-5.4,-5.4)" fill="#cce8ff" opacity=".65" className={`${uid}t2`} />
            <path d={spark(2.2)} transform="translate( 5.4,-5.4)" fill="#cce8ff" opacity=".65" className={`${uid}t2`} />
            <path d={spark(2.2)} transform="translate( 5.4, 5.4)" fill="#cce8ff" opacity=".65" className={`${uid}t2`} />
            <path d={spark(2.2)} transform="translate(-5.4, 5.4)" fill="#cce8ff" opacity=".65" className={`${uid}t2`} />
          </g>
        </g>

        {/* Centre pulsing master spark */}
        <g transform={`translate(${BX},${BY})`}>
          <path d={spark(6)} className={`${uid}c`} fill="white" opacity=".95" />
        </g>

      </g>

      {/* ── Glass highlights ── */}
      <ellipse cx="18.5" cy="12.5" rx="4.6" ry="2.4" transform="rotate(-35 18.5 12.5)" fill="white" opacity=".18" />
      <circle cx="30" cy="27.5" r="1.3" fill="white" opacity=".07" />

      {/* ── Subtle rim ── */}
      <circle cx={BX} cy={BY} r="13" fill="none" stroke="white" strokeWidth=".4" opacity=".2" />
    </svg>
  );
}
