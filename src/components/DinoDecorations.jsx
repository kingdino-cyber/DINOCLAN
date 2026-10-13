import { useEffect, useRef, useState } from 'react'
import { shouldUseLiteBackground } from '../utils/device'

const IMG = 'url(/dinoclan-background.jpg)'

// River/pond outline traced from the hand-drawn red line (percent of the background image)
const RIVER = '58.89% 54.38%, 59.77% 54.38%, 59.86% 55.64%, 59.57% 55.99%, 60.25% 56.89%, 61.43% 57.25%, 62.40% 58.14%, 64.45% 58.68%, 67.09% 60.29%, 68.75% 60.82%, 69.43% 61.54%, 69.43% 64.94%, 69.63% 65.83%, 69.63% 67.44%, 69.24% 69.95%, 69.04% 70.30%, 66.80% 70.30%, 65.33% 69.77%, 64.36% 69.77%, 64.16% 70.13%, 63.18% 70.66%, 62.30% 72.63%, 62.30% 75.67%, 62.11% 76.21%, 58.59% 75.85%, 57.52% 76.74%, 55.96% 76.92%, 55.76% 77.46%, 55.47% 79.79%, 54.98% 80.68%, 54.39% 81.22%, 53.71% 81.40%, 53.22% 81.93%, 52.15% 82.11%, 50.78% 82.83%, 49.80% 82.83%, 48.34% 83.72%, 46.58% 84.26%, 45.90% 84.97%, 43.75% 85.87%, 42.97% 87.12%, 41.89% 87.12%, 39.45% 85.51%, 35.16% 85.51%, 34.57% 84.26%, 33.98% 83.90%, 32.52% 83.18%, 31.05% 83.36%, 30.96% 82.11%, 31.35% 81.57%, 30.57% 81.04%, 26.46% 81.75%, 23.63% 81.57%, 23.73% 79.43%, 33.11% 79.25%, 33.98% 79.61%, 38.38% 79.61%, 40.14% 78.89%, 40.82% 78.35%, 41.50% 78.35%, 45.70% 76.74%, 46.48% 76.74%, 47.66% 76.21%, 53.32% 74.96%, 57.42% 72.27%, 58.89% 70.30%, 58.89% 69.23%, 59.08% 68.87%, 62.70% 68.87%, 63.38% 67.98%, 64.16% 67.44%, 64.84% 66.37%, 66.41% 65.12%, 67.19% 63.69%, 66.70% 63.51%, 65.82% 62.08%, 64.55% 61.54%, 63.28% 60.47%, 62.79% 60.47%, 61.62% 59.39%, 59.96% 58.68%, 59.38% 58.68%, 58.98% 58.32%, 57.71% 57.96%, 57.13% 57.42%, 56.35% 57.25%, 56.25% 55.81%, 56.64% 55.10%'

// Cloud area, kept a little inside the mountains and treetops so only the sky moves
const SKY = '19.53% 0.00%, 100.00% 0.00%, 100.00% 10.38%, 96.68% 10.73%, 92.77% 12.88%, 89.36% 17.53%, 85.94% 20.04%, 82.03% 16.46%, 79.59% 13.95%, 77.15% 13.60%, 75.20% 16.46%, 72.75% 21.11%, 69.82% 24.69%, 67.38% 26.83%, 64.45% 22.90%, 62.50% 20.04%, 59.57% 21.11%, 57.13% 25.04%, 54.20% 28.62%, 50.78% 30.77%, 46.88% 30.77%, 42.97% 30.41%, 40.04% 26.83%, 38.57% 21.47%, 37.11% 17.53%, 34.67% 13.95%, 32.23% 11.63%, 29.79% 10.73%, 27.34% 11.27%, 24.90% 13.42%, 22.66% 17.53%, 21.29% 22.36%, 20.02% 17.89%, 19.53% 10.73%'

const css = `
.dc-scene {
  position: absolute; left: 50%; top: 50%;
  width: max(100vw, calc(100vh * 1.8325));
  height: max(100vh, calc(100vw / 1.8325));
  transform: translate(-50%, -50%) scale(1.06);
  animation: dc-pan 60s ease-in-out infinite alternate;
  will-change: transform;
}
.dc-layer { position: absolute; inset: 0; background: ${IMG} center / 100% 100% no-repeat; }
/* Water layers are clipped to the river outline (CSS mask would stop the SVG ripple filter in Chrome) */
.dc-ripple, .dc-shimmer {
  position: absolute; inset: 0;
  clip-path: polygon(${RIVER});
}
.dc-ripple { background: ${IMG} center / 100% 100% no-repeat; }
.dc-ripple.a { filter: url(#dc-water-filter); }
.dc-ripple.b { opacity: 0.35; animation: dc-breathe 7s ease-in-out infinite alternate; }
.dc-shimmer {
  background: linear-gradient(100deg, transparent 36%, rgba(255,255,255,0.2) 50%, transparent 64%);
  background-size: 250% 100%;
  animation: dc-shimmer 12s linear infinite;
}
/* Clouds: a slowly morphing, drifting copy of the sky clipped to the cloud area */
.dc-cloud {
  position: absolute; inset: 0;
  clip-path: polygon(${SKY});
  background: ${IMG} 0% 50% / 100.8% 100% no-repeat;
  filter: url(#dc-cloud-filter);
  animation: dc-cloud-drift 30s ease-in-out infinite alternate;
}
.dc-sunlight {
  position: absolute; inset: 0;
  clip-path: polygon(${SKY});
  background: radial-gradient(closest-side, rgba(255,243,205,0.28), rgba(255,243,205,0));
  background-size: 45% 70%; background-repeat: no-repeat;
  animation: dc-sunlight 60s ease-in-out infinite alternate;
}
@keyframes dc-cloud-drift { from { background-position: 0% 50%; } to { background-position: 100% 50%; } }
@keyframes dc-sunlight { from { background-position: 10% 10%; } to { background-position: 95% 25%; } }
.dc-mist {
  position: absolute; border-radius: 50%;
  background: radial-gradient(closest-side, rgba(220,235,225,0.32), rgba(220,235,225,0));
  will-change: transform;
}
.dc-mist.m1 { left: -10%; top: 6%;  width: 55%; height: 22%; animation: dc-drift-a 70s linear infinite alternate; }
.dc-mist.m2 { left: 40%;  top: 2%;  width: 60%; height: 20%; animation: dc-drift-b 90s linear infinite alternate; }
.dc-mist.m3 { left: 15%;  top: 52%; width: 70%; height: 16%; opacity: 0.6; animation: dc-drift-a 80s linear infinite alternate; }
@keyframes dc-pan {
  from { transform: translate(-50%, -50%) scale(1.06); }
  to   { transform: translate(-50.8%, -50.5%) scale(1.12); }
}
@keyframes dc-breathe { from { opacity: 0.15; } to { opacity: 0.5; } }
@keyframes dc-shimmer { from { background-position: 150% 0; } to { background-position: -150% 0; } }
@keyframes dc-drift-a { from { transform: translateX(-8%); } to { transform: translateX(12%); } }
@keyframes dc-drift-b { from { transform: translateX(10%); } to { transform: translateX(-12%); } }
`

export default function DinoDecorations() {
  const turbRef = useRef(null)
  const cloudTurbRef = useRef(null)

  // Apple devices, touch devices and mobile mode get a plain still image: the animated
  // SVG-filter scene makes Safari/iPhones crawl.
  const [lite, setLite] = useState(() => shouldUseLiteBackground())
  useEffect(() => {
    const update = () => setLite(shouldUseLiteBackground())
    window.addEventListener('mobileModeChanged', update)
    return () => window.removeEventListener('mobileModeChanged', update)
  }, [])
  useEffect(() => {
    document.documentElement.classList.toggle('dc-lite', lite)
    return () => document.documentElement.classList.remove('dc-lite')
  }, [lite])

  // Drive the water + cloud distortion from JS (SVG SMIL animation can silently stall in Chrome)
  useEffect(() => {
    if (lite) return
    let raf, last = 0
    const start = performance.now()
    function tick(now) {
      raf = requestAnimationFrame(tick)
      if (document.hidden || now - last < 50) return
      last = now
      const t = (now - start) / 1000
      const fx = 0.014 + 0.007 * Math.sin(t / 3)
      const fy = 0.06 + 0.025 * Math.cos(t / 2.5)
      turbRef.current?.setAttribute('baseFrequency', `${fx.toFixed(5)} ${fy.toFixed(5)}`)
      const cx = 0.005 + 0.002 * Math.sin(t / 6)
      const cy = 0.01 + 0.004 * Math.cos(t / 5)
      cloudTurbRef.current?.setAttribute('baseFrequency', `${cx.toFixed(5)} ${cy.toFixed(5)}`)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [lite])

  if (lite) {
    return (
      <div
        className="dino-decorations"
        style={{
          position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: -1,
          backgroundColor: '#0f1a0f',
          backgroundImage: 'linear-gradient(rgba(10,22,10,0.55), rgba(10,22,10,0.55)), url(/dinoclan-background.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />
    )
  }

  return (
    <div
      className="dino-decorations"
      style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: -1, overflow: 'hidden',
        backgroundColor: '#0f1a0f',
      }}
    >
      <style>{css}</style>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <filter id="dc-water-filter" x="0" y="0" width="100%" height="100%">
          <feTurbulence ref={turbRef} type="fractalNoise" baseFrequency="0.011 0.045" numOctaves="2" seed="4" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="18" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="dc-cloud-filter" x="0" y="0" width="100%" height="100%">
          <feTurbulence ref={cloudTurbRef} type="fractalNoise" baseFrequency="0.0045 0.009" numOctaves="2" seed="9" result="cnoise" />
          <feDisplacementMap in="SourceGraphic" in2="cnoise" scale="22" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <div className="dc-scene">
        <div className="dc-layer" />
        <div className="dc-cloud" />
        <div className="dc-sunlight" />
        <div className="dc-water">
          <div className="dc-ripple a" />
          <div className="dc-ripple b" />
          <div className="dc-shimmer" />
        </div>
        <div className="dc-mist m1" />
        <div className="dc-mist m2" />
        <div className="dc-mist m3" />
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,22,10,0.55)' }} />
    </div>
  )
}
