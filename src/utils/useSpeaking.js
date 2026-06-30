import { useEffect, useRef, useState } from 'react'

// Analyses a MediaStream's audio track volume in real time and reports
// whether the person is currently talking — used to draw the green
// "speaking" ring around their avatar, like Discord.
export function useSpeaking(stream, threshold = 12) {
  const [speaking, setSpeaking] = useState(false)
  const rafRef = useRef(null)

  useEffect(() => {
    const audioTrack = stream?.getAudioTracks?.()[0]
    if (!audioTrack) { setSpeaking(false); return }

    let ctx, analyser, source, data
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)()
      analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      source = ctx.createMediaStreamSource(new MediaStream([audioTrack]))
      source.connect(analyser)
      data = new Uint8Array(analyser.frequencyBinCount)
    } catch (_) {
      return
    }

    function tick() {
      analyser.getByteFrequencyData(data)
      const avg = data.reduce((sum, v) => sum + v, 0) / data.length
      setSpeaking(avg > threshold && audioTrack.enabled)
      rafRef.current = requestAnimationFrame(tick)
    }
    tick()

    return () => {
      cancelAnimationFrame(rafRef.current)
      try { source.disconnect(); analyser.disconnect(); ctx.close() } catch (_) {}
    }
  }, [stream, threshold])

  return speaking
}
