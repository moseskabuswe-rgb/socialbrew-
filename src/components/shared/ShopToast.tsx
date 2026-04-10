import { useEffect } from 'react'

type Props = {
  shopName: string
  onDone: () => void
}

export default function ShopToast({ shopName, onDone }: Props) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none">
      <div className="animate-bounce-in bg-white rounded-2xl px-6 py-4 shadow-2xl border border-cream-200 flex items-center gap-3">
        <span className="text-2xl">☕</span>
        <div>
          <p className="text-coffee-800 font-bold text-base">{shopName}</p>
          <p className="text-green-500 font-bold text-sm">+1 visit logged</p>
        </div>
      </div>
    </div>
  )
}
