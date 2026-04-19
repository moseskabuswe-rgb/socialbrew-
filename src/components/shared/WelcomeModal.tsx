// src/components/shared/WelcomeModal.tsx

import { useState } from 'react'

interface Props {
  username: string
  onClose: () => void
  onBrew: () => void
}

export default function WelcomeModal({ username, onClose, onBrew }: Props) {
  const [closing, setClosing] = useState(false)

  function handleClose() {
    setClosing(true)
    setTimeout(onClose, 300)
  }

  function handleBrew() {
    setClosing(true)
    setTimeout(onBrew, 300)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(8,4,1,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={handleClose}
    >
      <div
        className="w-full max-w-lg mx-auto rounded-t-3xl overflow-hidden flex flex-col"
        style={{
          background: 'linear-gradient(160deg, #fdfaf5 0%, #f5ead8 100%)',
          maxHeight: '88vh',
          transform: closing ? 'translateY(100%)' : 'translateY(0)',
          transition: 'transform 0.3s ease',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-coffee-300 opacity-40" />
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto px-6 pt-2 pb-4 flex-1">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">☕</div>
            <h1 className="font-display text-2xl font-bold text-coffee-900 leading-tight">
              You found your people.
            </h1>
            <p className="text-coffee-500 text-sm mt-2">
              Welcome, <span className="font-semibold text-caramel">{username}</span>
            </p>
          </div>

          {/* Founder message */}
          <div
            className="rounded-2xl p-4 mb-6"
            style={{ background: 'rgba(200,133,58,0.08)', border: '1px solid rgba(200,133,58,0.15)' }}
          >
            <p className="text-coffee-700 text-sm leading-relaxed">
              Hey, I'm Moses — founder of Social Brew. Welcome to something we've been building with a lot of love.
            </p>
            <p className="text-coffee-600 text-sm leading-relaxed mt-2">
              Social Brew is where coffee lovers like you rate visits, share brews, and discover the independent shops that make every city worth exploring. <span className="font-semibold text-coffee-800">No chains. No algorithms.</span> Just real people and real coffee.
            </p>
          </div>

          {/* Features */}
          <p className="text-coffee-800 font-display font-bold text-base mb-3">
            Here's what's waiting for you:
          </p>
          <div className="space-y-3 mb-6">
            {[
              { icon: '🫖', title: 'Fill the mug', desc: 'Rate your visits your way — from a quick sip to a full experience' },
              { icon: '📍', title: 'Discover', desc: 'Find independent shops near you wherever you go' },
              { icon: '🗺️', title: 'Your coffee map', desc: 'Every shop you visit, mapped and yours forever' },
              { icon: '❤️', title: 'Social feed', desc: 'See what friends are drinking and share your own brews' },
              { icon: '✨', title: 'Wishlist', desc: 'Save drinks you want to try before you forget them' },
            ].map(f => (
              <div key={f.title} className="flex items-start gap-3">
                <span className="text-xl flex-shrink-0 mt-0.5">{f.icon}</span>
                <div>
                  <p className="text-coffee-800 font-semibold text-sm">{f.title}</p>
                  <p className="text-coffee-500 text-xs leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Closer */}
          <div
            className="rounded-2xl p-4 mb-6"
            style={{ background: 'rgba(200,133,58,0.06)', border: '1px solid rgba(200,133,58,0.12)' }}
          >
            <p className="text-coffee-600 text-sm leading-relaxed">
              You're among the first to join. That means you're not just a user — you're helping shape what Social Brew becomes.
            </p>
            <p className="text-caramel font-semibold text-sm mt-2">
              — Moses & the Social Brew team ☕
            </p>
          </div>
        </div>

        {/* Pinned buttons */}
        <div className="px-6 pb-8 pt-3 flex-shrink-0 space-y-2" style={{ borderTop: '1px solid rgba(200,133,58,0.1)' }}>
          <button
            onClick={handleBrew}
            className="w-full py-4 rounded-2xl text-white font-bold text-base"
            style={{ background: 'linear-gradient(135deg, #c8853a, #9b5e1a)', boxShadow: '0 4px 16px rgba(200,133,58,0.3)' }}
          >
            Start my coffee journey →
          </button>
          <button
            onClick={handleClose}
            className="w-full py-3 rounded-2xl text-coffee-500 font-medium text-sm"
          >
            Explore the feed first
          </button>
        </div>
      </div>
    </div>
  )
}
