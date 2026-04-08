// Shown after a rating is submitted — tells the user what rank they boosted the shop to
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface Props {
  shopId: string
  shopName: string
  onDone: () => void
}

export default function BoostToast({ shopId, shopName, onDone }: Props) {
  const [rank, setRank] = useState<number | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    async function fetchRank() {
      const { data } = await supabase
        .from('coffee_shops')
        .select('id, weekly_visits')
        .eq('is_active', true)
        .order('weekly_visits', { ascending: false })
      if (data) {
        const idx = data.findIndex(s => s.id === shopId)
        setRank(idx >= 0 ? idx + 1 : null)
      }
      setVisible(true)
      setTimeout(() => { setVisible(false); setTimeout(onDone, 400) }, 3000)
    }
    fetchRank()
  }, [shopId])

  const getMessage = () => {
    if (!rank) return `☕ You just boosted ${shopName}!`
    if (rank === 1) return `🔥 ${shopName} is #1 this week — and you helped get it there`
    if (rank <= 3) return `🚀 You boosted ${shopName} to #${rank} this week`
    return `☕ You boosted ${shopName} to #${rank} on the leaderboard`
  }

  return (
    <div style={{
      position: 'fixed',
      top: 24,
      left: 16,
      right: 16,
      zIndex: 9999,
      background: 'linear-gradient(135deg, #1a0a00, #3d2010)',
      borderRadius: 16,
      padding: '14px 18px',
      border: '1px solid rgba(200,133,58,0.5)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      transform: visible ? 'translateY(0)' : 'translateY(-80px)',
      opacity: visible ? 1 : 0,
      transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        background: 'linear-gradient(135deg, #c8853a, #a06028)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, fontSize: 18,
      }}>☕</div>
      <p style={{ color: '#f5e6c8', fontSize: 14, fontWeight: 600, margin: 0, lineHeight: 1.4, fontFamily: 'system-ui, sans-serif' }}>
        {getMessage()}
      </p>
    </div>
  )
}
