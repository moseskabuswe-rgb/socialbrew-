import { useState, useEffect } from 'react'

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
}

function isSafari() {
  return /safari/i.test(navigator.userAgent) && !/chrome/i.test(navigator.userAgent)
}

export default function InstallPrompt() {
  const [showAndroid, setShowAndroid] = useState(false)
  const [showIOS, setShowIOS] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [dismissed, setDismissed] = useState(false)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    if (isStandalone()) return
    if (sessionStorage.getItem('sb-install-dismissed')) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowAndroid(true)
      trackInstallEvent('prompt_shown', 'android')
    }

    window.addEventListener('beforeinstallprompt', handler as EventListener)

    if (isIOS() && isSafari()) {
      const timer = setTimeout(() => {
        setShowIOS(true)
        trackInstallEvent('prompt_shown', 'ios')
      }, 2500)
      return () => {
        clearTimeout(timer)
        window.removeEventListener('beforeinstallprompt', handler as EventListener)
      }
    }

    window.addEventListener('appinstalled', () => {
      trackInstallEvent('installed', isIOS() ? 'ios' : 'android')
      setShowAndroid(false)
      setShowIOS(false)
    })

    return () => window.removeEventListener('beforeinstallprompt', handler as EventListener)
  }, [])

  function trackInstallEvent(action: string, platform: string) {
    console.log(`[SocialBrew Analytics] install_${action} | platform: ${platform} | time: ${new Date().toISOString()}`)
    // Uncomment when Posthog is configured:
    // posthog.capture(`install_${action}`, { platform })
  }

  async function handleAndroidInstall() {
    if (!deferredPrompt) return
    setInstalling(true)
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    trackInstallEvent(outcome === 'accepted' ? 'accepted' : 'declined', 'android')
    setDeferredPrompt(null)
    setInstalling(false)
    setShowAndroid(false)
  }

  function dismiss() {
    setDismissed(true)
    setShowAndroid(false)
    setShowIOS(false)
    sessionStorage.setItem('sb-install-dismissed', '1')
    trackInstallEvent('dismissed', isIOS() ? 'ios' : 'android')
  }

  if (dismissed) return null

  // ── ANDROID PROMPT ──────────────────────────────────────
  if (showAndroid && deferredPrompt) {
    return (
      <div style={{
        position: 'fixed', bottom: 80, left: 16, right: 16, zIndex: 9999,
        background: 'linear-gradient(135deg, #1a0a00, #2a1408)',
        borderRadius: 20, padding: '18px 20px',
        border: '1px solid rgba(200,133,58,0.4)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
        display: 'flex', flexDirection: 'column' as const, gap: 14,
        animation: 'slideUp 0.35s ease-out',
      }}>
        <style>{`@keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, overflow: 'hidden', flexShrink: 0 }}>
            <img src="/icon-192.png" alt="Social Brew" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ color: '#f5e6c8', fontWeight: 700, fontSize: 15, margin: 0, marginBottom: 3, fontFamily: 'system-ui, sans-serif' }}>
              Add Social Brew to your home screen
            </p>
            <p style={{ color: 'rgba(245,230,200,0.6)', fontSize: 13, margin: 0, fontFamily: 'system-ui, sans-serif' }}>
              One tap — works like a real app, no App Store needed.
            </p>
          </div>
          <button onClick={dismiss} style={{ background: 'none', border: 'none', color: 'rgba(245,230,200,0.4)', fontSize: 20, cursor: 'pointer', padding: 0, lineHeight: 1, flexShrink: 0 }}>✕</button>
        </div>
        <button onClick={handleAndroidInstall} disabled={installing} style={{
          background: 'linear-gradient(135deg, #c8853a, #a06028)',
          border: 'none', borderRadius: 12, padding: '13px 0',
          color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer',
          fontFamily: 'system-ui, sans-serif', opacity: installing ? 0.7 : 1,
        }}>
          {installing ? 'Installing...' : '☕  Add to Home Screen'}
        </button>
        <button onClick={dismiss} style={{ background: 'none', border: 'none', color: 'rgba(245,230,200,0.4)', fontSize: 13, cursor: 'pointer', fontFamily: 'system-ui, sans-serif' }}>
          Maybe later
        </button>
      </div>
    )
  }

  // ── iOS GUIDE OVERLAY ───────────────────────────────────
  if (showIOS) {
    return (
      <>
        <div onClick={dismiss} style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
        }} />
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
          background: 'linear-gradient(180deg, #1a0a00, #0f0500)',
          borderRadius: '24px 24px 0 0', padding: '24px 24px 40px',
          border: '1px solid rgba(200,133,58,0.3)',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.7)',
          animation: 'slideUp 0.35s ease-out',
        }}>
          <style>{`@keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
          <div style={{ width: 40, height: 4, background: 'rgba(245,230,200,0.2)', borderRadius: 2, margin: '0 auto 20px' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, overflow: 'hidden', flexShrink: 0, border: '1px solid rgba(200,133,58,0.3)' }}>
              <img src="/icon-192.png" alt="Social Brew" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div>
              <p style={{ color: '#f5e6c8', fontWeight: 800, fontSize: 17, margin: 0, fontFamily: 'system-ui, sans-serif' }}>Install Social Brew</p>
              <p style={{ color: 'rgba(245,230,200,0.5)', fontSize: 13, margin: '3px 0 0', fontFamily: 'system-ui, sans-serif' }}>Add to your home screen in 2 taps</p>
            </div>
          </div>

          {[
            { num: '1', text: 'Tap the', highlight: 'Share button', suffix: 'at the bottom of Safari' },
            { num: '2', text: 'Scroll down and tap', highlight: '"Add to Home Screen"', suffix: '' },
            { num: '3', text: 'Tap', highlight: '"Add"', suffix: "in the top right — you're in." },
          ].map((step) => (
            <div key={step.num} style={{
              display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 12,
              padding: '12px 14px', background: 'rgba(255,255,255,0.04)',
              borderRadius: 12, border: '1px solid rgba(245,230,200,0.08)',
            }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: 'rgba(200,133,58,0.2)', border: '1px solid rgba(200,133,58,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, fontSize: 13, fontWeight: 800, color: '#c8853a',
                fontFamily: 'system-ui, sans-serif',
              }}>{step.num}</div>
              <p style={{ color: 'rgba(245,230,200,0.8)', fontSize: 14, margin: 0, lineHeight: 1.5, fontFamily: 'system-ui, sans-serif' }}>
                {step.text} <span style={{ color: '#c8853a', fontWeight: 700 }}>{step.highlight}</span>
                {step.suffix ? ` ${step.suffix}` : ''}
              </p>
            </div>
          ))}

          <div style={{
            marginTop: 8, padding: '10px 16px',
            background: 'rgba(200,133,58,0.1)', borderRadius: 10,
            border: '1px solid rgba(200,133,58,0.2)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 18 }}>👆</span>
            <p style={{ color: 'rgba(245,230,200,0.6)', fontSize: 12, margin: 0, fontFamily: 'system-ui, sans-serif' }}>
              The share icon looks like a box with an arrow pointing up — it's at the bottom of Safari.
            </p>
          </div>

          <button onClick={dismiss} style={{
            marginTop: 20, width: '100%', background: 'none',
            border: '1px solid rgba(245,230,200,0.15)', borderRadius: 12,
            padding: '12px 0', color: 'rgba(245,230,200,0.5)',
            fontSize: 14, cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
          }}>
            I'll do it later
          </button>
        </div>
      </>
    )
  }

  return null
}
