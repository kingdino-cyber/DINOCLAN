// Safari (every iPhone/iPad browser, and Safari on Mac) is WebKit, which is very slow at the
// animated SVG-filter background. These helpers decide when to fall back to a plain image.

export function isAppleDevice(nav = navigator) {
  const ua = nav.userAgent || ''
  if (/iPad|iPhone|iPod/.test(ua)) return true
  if (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1) return true // iPadOS pretending to be a Mac
  // Desktop Safari: has "Safari/" but none of the Chromium/Firefox markers
  return /Safari\//.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|Edg|OPR|Android/.test(ua)
}

export function shouldUseLiteBackground(win = window) {
  try {
    if (isAppleDevice(win.navigator)) return true
    if (win.matchMedia && win.matchMedia('(pointer: coarse)').matches) return true
    if (win.localStorage.getItem('mobileMode') === 'true') return true
    if ((win.navigator.hardwareConcurrency || 8) <= 2) return true
  } catch (_) {}
  return false
}
