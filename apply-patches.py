#!/usr/bin/env python3
"""
Run from your project root: python3 apply-patches.py
Reads your actual repo files and adds ONLY what's missing.
Prints OK, SKIP, or WARNING for every patch.
Then run: npm run build
"""
import os

def patch_file(path, patches):
    if not os.path.exists(path):
        print(f"  ❌ NOT FOUND: {path} — run from project root")
        return
    with open(path) as f:
        content = f.read()
    original = content
    for desc, old, new in patches:
        if old not in content:
            if new[:60] in content:
                print(f"  ⏭  SKIP (already applied): {desc}")
            else:
                print(f"  ⚠️  NOT FOUND — apply manually: {desc}")
                print(f"      Looking for: {repr(old[:80])}")
            continue
        content = content.replace(old, new, 1)
        print(f"  ✅ Applied: {desc}")
    if content != original:
        with open(path, 'w') as f:
            f.write(content)
        print(f"  💾 Saved.\n")
    else:
        print(f"  (no changes)\n")

# ─── MugRating.tsx ────────────────────────────────────────────────────────────
print("=" * 60)
print("MugRating.tsx")
print("=" * 60)
patch_file('src/components/brew/MugRating.tsx', [

    ("1. Add imports: push/AnonymousFeedbackModal/MugSwipeHint",
     "import { supabase } from '../../lib/supabase'",
     """import { supabase } from '../../lib/supabase'
import { notifyMention } from '../../lib/push'
import AnonymousFeedbackModal from '../shared/AnonymousFeedbackModal'
import MugSwipeHint from '../shared/MugSwipeHint'"""),

    ("2. Add price step to step type",
     "useState<'rate' | 'details' | 'submitting' | 'done'>('rate')",
     "useState<'rate' | 'details' | 'price' | 'submitting' | 'done'>('rate')"),

    ("3. Pre-fill drink name from Discover",
     "const [drinkName, setDrinkName] = useState('')",
     "const [drinkName, setDrinkName] = useState(shop?._prefillDrink || '')"),

    ("4. Add price + hint + feedback state",
     "const fileRef = useRef<HTMLInputElement>(null)",
     """const fileRef = useRef<HTMLInputElement>(null)
  const [drinkPrice, setDrinkPrice] = useState('')
  const [pricePerception, setPricePerception] = useState('')
  const [showPriceOnPost, setShowPriceOnPost] = useState(true)
  const [showFeedback, setShowFeedback] = useState(false)
  const [showHint, setShowHint] = useState(() => {
    try { return localStorage.getItem('sb_mug_hint_seen') !== '1' } catch { return true }
  })"""),

    ("5. Replace entire submit block with price/OSM/notifications/feedback",
     """    const captionParts = [caption].filter(Boolean)
    const { error } = await supabase.from('ratings').insert({
      user_id: profile.id,
      shop_id: shop?.id?.startsWith?.('osm-') || shop?.id?.startsWith?.('fb-') ?
        (await supabase.from('coffee_shops').insert({...}).select('id').single()).data?.id
        : shop.id,
      fill_level: fill,
      drink_name: drinkName || null,
      vibe_tags: selectedVibes,
      caption: captionParts.join(' · ') || null,
    })
    if (!error) { setStep('done'); setTimeout(() => { onComplete(shop?.name); onClose() }, 1600) }
    else { setStep('details'); alert('Something went wrong. Please try again.') }""",
     """    // Resolve OSM/external IDs into real DB IDs
    let shopId = shop.id
    if (String(shopId).startsWith('osm-') || String(shopId).startsWith('fb-')) {
      const { data: existing } = await supabase.from('coffee_shops').select('id').ilike('name', shop.name).maybeSingle()
      if (existing) {
        shopId = existing.id
      } else {
        const { data: inserted } = await supabase.from('coffee_shops').insert({
          name: shop.name, address: shop.address || null, city: shop.city || null,
          state: shop.state || null, lat: shop.lat || null, lng: shop.lng || null,
          is_active: true, is_certified: false, is_verified: false,
          vibes: [], avg_rating: 0, total_ratings: 0, weekly_visits: 0,
        }).select('id').maybeSingle()
        shopId = inserted?.id
      }
    }
    if (!shopId) { setStep('details'); alert('Could not find shop. Please try again.'); return }

    const priceValue = drinkPrice ? parseFloat(drinkPrice) : null

    const { error } = await supabase.from('ratings').insert({
      user_id: profile.id,
      shop_id: shopId,
      fill_level: fill,
      drink_name: drinkName || null,
      vibe_tags: selectedVibes,
      caption: caption || null,
      visit_time: visitTime || null,
      drink_price: priceValue,
      price_perception: pricePerception || null,
      show_price: showPriceOnPost,
    })

    if (error) {
      console.error('MugRating insert error:', error)
      alert(`Could not post: ${error.message}`)
      setStep('price')
      return
    }

    // Notify followers + @mentions (fire and forget)
    supabase.from('ratings').select('id').eq('user_id', profile.id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
      .then(async ({ data: newRating }) => {
        if (!newRating) return
        const { data: followers } = await supabase.from('follows')
          .select('follower_id').eq('following_id', profile.id)
        if (followers?.length) {
          await supabase.from('notifications').insert(
            followers.map((f: any) => ({
              user_id: f.follower_id, actor_id: profile.id,
              type: 'new_post', rating_id: newRating.id,
            }))
          )
        }
        if (caption.trim()) {
          const mentions = caption.match(/@([a-z0-9_.]+)/gi) || []
          for (const handle of mentions) {
            const { data: mentioned } = await supabase.from('profiles')
              .select('id').eq('username', handle.slice(1)).maybeSingle()
            if (mentioned?.id && mentioned.id !== profile.id)
              notifyMention(mentioned.id, profile.username || 'Someone', caption)
          }
        }
      })

    Promise.resolve(supabase.rpc('increment_shop_visit', { shop_id_input: shopId })).catch(() => {})

    setStep('done')
    setTimeout(() => {
      onComplete(shop?.name)
      if (fill <= 50) setShowFeedback(true)
      else onClose()
    }, 1600)"""),

    ("6. Add percentage display after fill sub-label",
     "{s.sub && <p className=\"text-coffee-400 text-sm mt-1\">{s.sub}</p>}",
     """{s.sub && <p className="text-coffee-400 text-sm mt-1">{s.sub}</p>}
              {fill > 0 && <p className="text-coffee-400 text-xs mt-1 font-mono">{fill}%</p>}"""),

    ("7. Add MugSwipeHint after closing SVG tag",
     "</svg>\n            </div>",
     """</svg>
              <MugSwipeHint visible={showHint && fill === 0} />
            </div>"""),

    ("8. Add price step before details step",
     "{/* ── DETAILS STEP",
     """{/* ── PRICE STEP ── */}
        {step === 'price' && (
          <div className="p-5 pb-8">
            <p className="text-coffee-200 text-xs uppercase tracking-wider mb-4">
              💰 What did you pay? <span className="normal-case text-coffee-400">(optional)</span>
            </p>
            <div className="flex items-center bg-coffee-800 rounded-xl px-4 py-3 border border-coffee-600 mb-3 gap-2">
              <span className="text-coffee-400 font-semibold">$</span>
              <input type="number" inputMode="decimal" placeholder="0.00"
                value={drinkPrice} onChange={e => setDrinkPrice(e.target.value)}
                className="flex-1 bg-transparent text-white text-sm focus:outline-none" />
            </div>
            <div className="flex gap-2 mb-4">
              {[{key:'steal',label:'🤑 Steal'},{key:'worth_it',label:'✅ Worth it'},{key:'overpriced',label:'😬 Overpriced'}].map(opt => (
                <button key={opt.key}
                  onClick={() => setPricePerception(pricePerception === opt.key ? '' : opt.key)}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold border transition-all"
                  style={pricePerception === opt.key
                    ? {background:'#c8853a',color:'#fff',borderColor:'#c8853a'}
                    : {background:'rgba(255,255,255,0.05)',color:'#d4c4b0',borderColor:'rgba(255,255,255,0.1)'}}>
                  {opt.label}
                </button>
              ))}
            </div>
            {(drinkPrice || pricePerception) && (
              <div className="flex items-center justify-between bg-coffee-800 rounded-xl px-4 py-3 border border-coffee-600 mb-4">
                <div>
                  <p className="text-white text-xs font-semibold">Show price on my post</p>
                  <p className="text-coffee-400 text-xs">Others can see what you paid</p>
                </div>
                <button onClick={() => setShowPriceOnPost(v => !v)}
                  className="w-10 h-6 rounded-full relative transition-all flex-shrink-0"
                  style={{background: showPriceOnPost ? '#c8853a' : '#4a3820'}}>
                  <div className="w-4 h-4 bg-white rounded-full absolute top-1 transition-all"
                    style={{left: showPriceOnPost ? '22px' : '2px'}} />
                </button>
              </div>
            )}
            <button onClick={handleSubmit}
              className="w-full py-3.5 rounded-2xl font-semibold text-white mb-2"
              style={{background:`linear-gradient(135deg, ${s.liquid}, #9b5e1a)`}}>
              Share to Feed
            </button>
            <button onClick={handleSubmit} className="w-full py-2 text-coffee-400 text-sm">
              Skip &amp; post now
            </button>
          </div>
        )}

        {/* ── DETAILS STEP"""),

    ("9. Wire details Share button to go to price step",
     """onClick={handleSubmit}
              className="w-full py-3.5 rounded-2xl bg-caramel""",
     """onClick={() => setStep('price')}
              className="w-full py-3.5 rounded-2xl bg-caramel"""),

    ("10. Add feedback modal before final closing tags",
     "      </div>\n    </div>\n  )\n}",
     """      </div>
    </div>
    {step === 'done' && showFeedback && (
      <AnonymousFeedbackModal
        shopId={String(shop?.id || '')}
        shopName={shop?.name || 'this shop'}
        fillLevel={fill}
        onSkip={onClose}
        onSent={onClose}
      />
    )}
  )
}"""),

])

# ─── QuickSip.tsx ─────────────────────────────────────────────────────────────
print("=" * 60)
print("QuickSip.tsx")
print("=" * 60)
patch_file('src/components/brew/QuickSip.tsx', [

    ("1. Add AnonymousFeedbackModal + MugSwipeHint imports",
     "import { supabase } from '../../lib/supabase'",
     """import { supabase } from '../../lib/supabase'
import AnonymousFeedbackModal from '../shared/AnonymousFeedbackModal'
import MugSwipeHint from '../shared/MugSwipeHint'"""),

    ("2. Add drinkName + price + feedback state",
     "  const [submitting, setSubmitting] = useState(false)",
     """  const [drinkName, setDrinkName] = useState('')
  const [drinkPrice, setDrinkPrice] = useState('')
  const [pricePerception, setPricePerception] = useState('')
  const [showPriceOnPost, setShowPriceOnPost] = useState(true)
  const [showFeedback, setShowFeedback] = useState(false)
  const [submittedShop, setSubmittedShop] = useState<any>(null)
  const [showHint, setShowHint] = useState(() => {
    try { return localStorage.getItem('sb_mug_hint_seen') !== '1' } catch { return true }
  })
  const [submitting, setSubmitting] = useState(false)"""),

    ("3. Add getVisitTime helper before handleSubmit",
     "  async function handleSubmit() {",
     """  function getVisitTime(): string {
    const h = new Date().getHours()
    if (h >= 5 && h < 8)   return 'Early Morning (5–8am)'
    if (h >= 8 && h < 10)  return 'Morning (8–10am)'
    if (h >= 10 && h < 12) return 'Late Morning (10am–12pm)'
    if (h >= 12 && h < 14) return 'Lunch (12–2pm)'
    if (h >= 14 && h < 17) return 'Afternoon (2–5pm)'
    if (h >= 17 && h < 20) return 'Evening (5–8pm)'
    return 'Night (8pm+)'
  }

  async function handleSubmit() {"""),

    ("4. Replace insert block with drink_name, price, error surfacing, notifications, feedback",
     """    await supabase.from('ratings').insert({
      user_id: profile.id,
      shop_id: shop?.id || null,
      fill_level: fill,
      is_quick_sip: true,
      vibe_tags: [],
    })
    trackEvent('quick_sip_posted', { fill_level: fill, shop: shop?.name })
    setDone(true)
    setTimeout(() => { onComplete(); onClose() }, 1400)""",
     """    const priceValue = drinkPrice ? parseFloat(drinkPrice) : null
    const { error: insertError } = await supabase.from('ratings').insert({
      user_id: profile.id,
      shop_id: shop?.id || null,
      fill_level: fill,
      is_quick_sip: true,
      drink_name: drinkName.trim() || null,
      visit_time: getVisitTime(),
      drink_price: priceValue,
      price_perception: pricePerception || null,
      show_price: showPriceOnPost,
    })
    trackEvent('quick_sip_posted', { fill_level: fill, shop: shop?.name })

    if (insertError) {
      console.error('QuickSip insert error:', insertError)
      alert(`Could not post: ${insertError.message}`)
      setSubmitting(false)
      return
    }

    // Notify followers (fire and forget)
    supabase.from('ratings').select('id').eq('user_id', profile.id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
      .then(async ({ data: newRating }) => {
        if (!newRating) return
        const { data: followers } = await supabase.from('follows')
          .select('follower_id').eq('following_id', profile.id)
        if (followers?.length) {
          await supabase.from('notifications').insert(
            followers.map((f: any) => ({
              user_id: f.follower_id, actor_id: profile.id,
              type: 'new_post', rating_id: newRating.id,
            }))
          )
        }
      })

    Promise.resolve(supabase.rpc('increment_shop_visit', { shop_id_input: shop?.id })).catch(() => {})

    setDone(true)
    setTimeout(() => {
      onComplete(shop?.name)
      if (fill <= 50) { setSubmittedShop(shop); setShowFeedback(true) }
      else onClose()
    }, 1400)"""),

    ("5. Add drink name input above mug in UI",
     "{/* Mug */}",
     """{/* Optional drink name */}
            <input
              value={drinkName}
              onChange={e => setDrinkName(e.target.value)}
              placeholder="What did you drink? (optional)"
              className="w-full bg-coffee-800 text-white rounded-xl px-4 py-2.5 text-sm border border-coffee-600 focus:border-caramel focus:outline-none placeholder-coffee-500 mb-3"
            />

            {/* Mug */}"""),

    ("6. Add MugSwipeHint after SVG in QuickSip",
     "</svg>\n          </div>",
     """</svg>
            <MugSwipeHint visible={showHint && fill === 0} />
          </div>"""),

    ("7. Add anonymous feedback modal at end of QuickSip return",
     "      </div>\n    </div>\n  )\n}",
     """      </div>
    </div>
    {done && showFeedback && submittedShop && (
      <AnonymousFeedbackModal
        shopId={String(submittedShop?.id || '')}
        shopName={submittedShop?.name || 'this shop'}
        fillLevel={fill}
        onSkip={onClose}
        onSent={onClose}
      />
    )}
  )
}"""),

])

print("=" * 60)
print("Done. Run: npm run build")
print("Any ⚠️  warnings need manual application.")
print("=" * 60)
