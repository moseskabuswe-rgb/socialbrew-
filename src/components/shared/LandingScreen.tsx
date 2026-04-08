// Shown to first-time visitors before they sign up
// Makes the "add to home screen" feel like a real app install

import { useState, useEffect } from 'react'

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
}

interface Props {
  onContinue: () => void
}

export default function LandingScreen({ onContinue }: Props) {
  const [step, setStep] = useState<'landing' | 'install'>('landing')
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler as EventListener)
    return () => window.removeEventListener('beforeinstallprompt', handler as EventListener)
  }, [])

  async function handleInstallAndroid() {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        onContinue()
        return
      }
    }
    onContinue()
  }

  // Already installed — skip landing
  if (isStandalone()) return null

  // Already seen landing this session
  if (sessionStorage.getItem('sb-landing-seen')) return null

  const handleSkip = () => {
    sessionStorage.setItem('sb-landing-seen', '1')
    onContinue()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'linear-gradient(160deg, #0f0500 0%, #1a0a00 50%, #2a1408 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'space-between', padding: '48px 24px 40px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>

      {/* Logo area */}
      <div style={{ textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <div style={{ width: 96, height: 96, borderRadius: 24, overflow: 'hidden', border: '2px solid rgba(200,133,58,0.4)', boxShadow: '0 0 40px rgba(200,133,58,0.3)' }}>
          <img src="/icon-512.png" alt="Social Brew" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        <div>
          <h1 style={{ color: '#f5e6c8', fontSize: 36, fontWeight: 900, margin: 0, letterSpacing: -1 }}>Social Brew</h1>
          <p style={{ color: 'rgba(245,230,200,0.5)', fontSize: 15, margin: '6px 0 0' }}>Your independent coffee community</p>
        </div>

        {/* Feature pills */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', marginTop: 16 }}>
          {[
            { icon: '☕', text: 'Rate visits with the mug mechanic' },
            { icon: '📈', text: 'See what\'s trending in your city' },
            { icon: '🤝', text: 'Share brews with friends' },
          ].map(f => (
            <div key={f.text} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: 'rgba(255,255,255,0.05)', borderRadius: 12,
              padding: '12px 16px', border: '1px solid rgba(245,230,200,0.08)',
            }}>
              <span style={{ fontSize: 22, flexShrink: 0 }}>{f.icon}</span>
              <span style={{ color: 'rgba(245,230,200,0.8)', fontSize: 14 }}>{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Install / continue buttons */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12, marginTop: 32 }}>
        {step === 'landing' && (
          <>
            <button
              onClick={() => isIOS() ? setStep('install') : (deferredPrompt ? handleInstallAndroid() : onContinue())}
              style={{
                width: '100%', padding: '16px 0',
                background: 'linear-gradient(135deg, #c8853a, #a06028)',
                border: 'none', borderRadius: 16,
                color: '#fff', fontSize: 17, fontWeight: 800,
                cursor: 'pointer', letterSpacing: 0.3,
              }}
            >
              ☕ Get the App
            </button>
            <button onClick={handleSkip} style={{
              width: '100%', padding: '13px 0',
              background: 'none', border: '1px solid rgba(245,230,200,0.15)',
              borderRadius: 16, color: 'rgba(245,230,200,0.4)',
              fontSize: 14, cursor: 'pointer',
            }}>
              Continue in browser
            </button>
          </>
        )}

        {step === 'install' && isIOS() && (
          <div style={{ width: '100%' }}>
            <p style={{ color: 'rgba(245,230,200,0.6)', fontSize: 13, textAlign: 'center', marginBottom: 16 }}>
              Add to your home screen to install:
            </p>
            {[
              { num: '1', icon: '⬆️', text: 'Tap the', bold: 'Share button', suffix: 'at the bottom of Safari' },
              { num: '2', icon: '➕', text: 'Tap', bold: '"Add to Home Screen"', suffix: '' },
              { num: '3', icon: '✅', text: 'Tap', bold: '"Add"', suffix: 'in the top right' },
            ].map(step => (
              <div key={step.num} style={{
                display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10,
                background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '11px 14px',
                border: '1px solid rgba(245,230,200,0.07)',
              }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: 'rgba(200,133,58,0.2)', border: '1px solid rgba(200,133,58,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, fontSize: 12, fontWeight: 800, color: '#c8853a',
                }}>{step.num}</div>
                <p style={{ color: 'rgba(245,230,200,0.8)', fontSize: 13, margin: 0, lineHeight: 1.5 }}>
                  {step.text} <span style={{ color: '#c8853a', fontWeight: 700 }}>{step.bold}</span>
                  {step.suffix ? ` ${step.suffix}` : ''}
                </p>
              </div>
            ))}
            <button onClick={handleSkip} style={{
              width: '100%', marginTop: 12, padding: '13px 0',
              background: 'none', border: '1px solid rgba(245,230,200,0.15)',
              borderRadius: 16, color: 'rgba(245,230,200,0.4)',
              fontSize: 14, cursor: 'pointer',
            }}>
              I'll do it later
            </button>
          </div>
        )}
      </div>

      {/* Beta tag */}
      <p style={{ color: 'rgba(245,230,200,0.25)', fontSize: 11, marginTop: 16, textAlign: 'center' }}>
        Beta • Independent coffee shops only
      </p>
    </div>
  )
}
