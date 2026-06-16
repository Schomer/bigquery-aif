'use client';
import React from 'react';

/**
 * Bare orbiting sparks — no ball, no background.
 * Uses muted blue-100/200/300 tones so it sits quietly in the chat thread.
 */
export function SparkSpinner({ size = 24 }: { size?: number }) {
  const uid = React.useId().replace(/:/g, 'u');
  const CX = 14, CY = 14; // centre of 28×28 coordinate space

  /** 4-pointed Gemini spark centred at origin */
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
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <style>{`
          @keyframes ${uid}cw  { to { transform: rotate( 360deg); } }
          @keyframes ${uid}ccw { to { transform: rotate(-360deg); } }
          @keyframes ${uid}pulse {
            0%,100% { opacity:.7;  transform:scale(1);   }
            50%     { opacity:.12; transform:scale(.45); }
          }
          @keyframes ${uid}tw {
            0%,100% { opacity:.75; }
            50%     { opacity:.07; }
          }
          .${uid}o1 { transform-origin:0 0; animation:${uid}cw    3.6s linear      infinite; }
          .${uid}o2 { transform-origin:0 0; animation:${uid}ccw   2.7s linear      infinite; }
          .${uid}o3 { transform-origin:0 0; animation:${uid}cw    5.8s linear      infinite; }
          .${uid}c  { transform-origin:0 0; animation:${uid}pulse 1.9s ease-in-out infinite; }
          .${uid}t1 { animation:${uid}tw 2.1s ease-in-out  .4s infinite; }
          .${uid}t2 { animation:${uid}tw 1.7s ease-in-out  .9s infinite; }
          .${uid}t3 { animation:${uid}tw 2.5s ease-in-out  .0s infinite; }
        `}</style>

        {/* Soft glow without the ball's heavy blur */}
        <filter id={`${uid}sf`} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="0.55" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g filter={`url(#${uid}sf)`}>

        {/* Orbit 1 – CW, larger sparks at 12 & 6 o'clock — blue-400 */}
        <g transform={`translate(${CX},${CY})`}>
          <g className={`${uid}o1`}>
            <path d={spark(3.2)} transform="translate(0,-5.6)"  fill="#60a5fa" opacity=".9" className={`${uid}t3`} />
            <path d={spark(3.2)} transform="translate(0, 5.6)"  fill="#60a5fa" opacity=".9" className={`${uid}t3`} />
          </g>
        </g>

        {/* Orbit 2 – CCW, medium sparks at 3 & 9 o'clock — blue-300 */}
        <g transform={`translate(${CX},${CY})`}>
          <g className={`${uid}o2`}>
            <path d={spark(2.4)} transform="translate(-5.6,0) rotate(45)" fill="#93c5fd" opacity=".78" className={`${uid}t1`} />
            <path d={spark(2.4)} transform="translate( 5.6,0) rotate(45)" fill="#93c5fd" opacity=".78" className={`${uid}t1`} />
          </g>
        </g>

        {/* Orbit 3 – slow CW, tiny corner sparks — blue-200 */}
        <g transform={`translate(${CX},${CY})`}>
          <g className={`${uid}o3`}>
            <path d={spark(1.5)} transform="translate(-3.9,-3.9)" fill="#bfdbfe" opacity=".65" className={`${uid}t2`} />
            <path d={spark(1.5)} transform="translate( 3.9,-3.9)" fill="#bfdbfe" opacity=".65" className={`${uid}t2`} />
            <path d={spark(1.5)} transform="translate( 3.9, 3.9)" fill="#bfdbfe" opacity=".65" className={`${uid}t2`} />
            <path d={spark(1.5)} transform="translate(-3.9, 3.9)" fill="#bfdbfe" opacity=".65" className={`${uid}t2`} />
          </g>
        </g>

        {/* Centre pulsing master spark — blue-300 */}
        <g transform={`translate(${CX},${CY})`}>
          <path d={spark(3.8)} className={`${uid}c`} fill="#93c5fd" opacity=".92" />
        </g>

      </g>
    </svg>
  );
}
