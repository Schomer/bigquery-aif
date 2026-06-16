'use client';
import React from 'react';

/**
 * Ball-only variant of the crystal ball — no pedestal stand.
 * Designed for compact loading / thinking indicator use.
 * The viewBox is cropped tightly around the ball circle.
 */
export function CrystalBallSpinner({ size = 28 }: { size?: number }) {
  const uid = React.useId().replace(/:/g, 'u');

  // Same coordinate space as the full crystal ball
  const BX = 24, BY = 20.43;

  function spark(r: number): string {
    const c = r * 0.16;
    return (
      `M0,${-r} C${c},${-c} ${c},${-c} ${r},0 ` +
      `C${c},${c} ${c},${c} 0,${r} ` +
      `C${-c},${c} ${-c},${c} ${-r},0 ` +
      `C${-c},${-c} ${-c},${-c} 0,${-r}Z`
    );
  }

  return (
    <svg
      width={size}
      height={size}
      // Cropped tight around the ball circle — stand is outside this viewport
      viewBox="6 2.5 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <style>{`
          @keyframes ${uid}cw  { to { transform: rotate( 360deg); } }
          @keyframes ${uid}ccw { to { transform: rotate(-360deg); } }
          @keyframes ${uid}pulse {
            0%,100% { opacity:.9;  transform:scale(1);   }
            50%     { opacity:.25; transform:scale(.55); }
          }
          @keyframes ${uid}tw {
            0%,100% { opacity:1;  }
            50%     { opacity:.1; }
          }
          .${uid}o1 { transform-origin:0 0; animation:${uid}cw   3.6s linear      infinite; }
          .${uid}o2 { transform-origin:0 0; animation:${uid}ccw  2.7s linear      infinite; }
          .${uid}o3 { transform-origin:0 0; animation:${uid}cw   5.8s linear      infinite; }
          .${uid}c  { transform-origin:0 0; animation:${uid}pulse 1.9s ease-in-out infinite; }
          .${uid}t1 { animation:${uid}tw 2.1s ease-in-out  .4s infinite; }
          .${uid}t2 { animation:${uid}tw 1.7s ease-in-out  .9s infinite; }
          .${uid}t3 { animation:${uid}tw 2.5s ease-in-out  .0s infinite; }
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

        {/* Clip sparks to ball interior */}
        <clipPath id={`${uid}cp`}>
          <circle cx={BX} cy={BY} r="15" />
        </clipPath>
      </defs>

      {/* ── Outer dark rim — plain circle, no pedestal ── */}
      <circle cx={BX} cy={BY} r="16" fill="#1b2e5d" />

      {/* ── Gradient ball fill ── */}
      <circle cx={BX} cy={BY} r="15.5" fill={`url(#${uid}bg)`} stroke="#1a2d5a" strokeWidth="1.2" />

      {/* ── Ambient glow ── */}
      <circle cx={BX} cy={BY} r="16" fill={`url(#${uid}eg)`} />

      {/* ── Animated Gemini sparks ── */}
      <g clipPath={`url(#${uid}cp)`} filter={`url(#${uid}sf)`}>

        {/* Orbit 1 – CW, large white sparks */}
        <g transform={`translate(${BX},${BY})`}>
          <g className={`${uid}o1`}>
            <path d={spark(5.2)} transform="translate(0,-7.6)" fill="white"   opacity=".93" className={`${uid}t3`} />
            <path d={spark(5.2)} transform="translate(0, 7.6)" fill="white"   opacity=".93" className={`${uid}t3`} />
          </g>
        </g>

        {/* Orbit 2 – CCW, medium blue sparks */}
        <g transform={`translate(${BX},${BY})`}>
          <g className={`${uid}o2`}>
            <path d={spark(3.8)} transform="translate(-7.6,0) rotate(45)" fill="#aad4ff" opacity=".8" className={`${uid}t1`} />
            <path d={spark(3.8)} transform="translate( 7.6,0) rotate(45)" fill="#aad4ff" opacity=".8" className={`${uid}t1`} />
          </g>
        </g>

        {/* Orbit 3 – CW slow, tiny corner sparks */}
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
      <circle cx={BX} cy={BY} r="15.5" fill="none" stroke="white" strokeWidth=".4" opacity=".2" />
    </svg>
  );
}
