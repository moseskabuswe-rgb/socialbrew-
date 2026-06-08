import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

interface Shop { id: string; name: string }
interface Props { shop: Shop }

interface RoastProfile {
  roaster: string
  roast_levels: string[]
  origins: string[]
  brew_methods: string[]
  notes: string
}

const ROAST_LEVELS = ['Light', 'Medium', 'Dark', 'Single Origin', 'Blend']

const ORIGINS = [
  'Ethiopia', 'Colombia', 'Guatemala', 'Brazil', 'Kenya',
  'Peru', 'Costa Rica', 'Honduras', 'Indonesia', 'Mexico',
  'Rwanda', 'Burundi', 'Yemen', 'Panama', 'Jamaica',
]

const BREW_METHODS = [
  'Espresso', 'Pour Over', 'Cold Brew', 'French Press',
  'Aeropress', 'Siphon', 'Drip', 'Chemex',
]

const MAX_NOTES = 300

function PillToggle({
  label,
  selected,
  onToggle,
}: {
  label: string
  selected: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
        selected
          ? 'border-caramel bg-caramel/10 text-caramel'
          : 'border-cream-300 bg-white text-coffee-500 hover:border-caramel/50'
      }`}
    >
      {label}
    </button>
  )
}

export default function PortalRoastProfile({ shop }: Props) {
  const [roaster, setRoaster] = useState('')
  const [roastLevels, setRoastLevels] = useState<string[]>([])
  const [origins, setOrigins] = useState<string[]>([])
  const [brewMethods, setBrewMethods] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('coffee_shops')
        .select('roast_profile')
        .eq('id', shop.id)
        .single()
      if (data?.roast_profile) {
        const rp = data.roast_profile as RoastProfile
        setRoaster(rp.roaster || '')
        setRoastLevels(rp.roast_levels || [])
        setOrigins(rp.origins || [])
        setBrewMethods(rp.brew_methods || [])
        setNotes(rp.notes || '')
      }
      setLoading(false)
    }
    load()
  }, [shop.id])

  function toggle(arr: string[], setArr: (v: string[]) => void, val: string) {
    setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val])
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    setSaved(false)

    const profile: RoastProfile = {
      roaster: roaster.trim(),
      roast_levels: roastLevels,
      origins,
      brew_methods: brewMethods,
      notes: notes.trim().slice(0, MAX_NOTES),
    }

    const { error: err } = await supabase
      .from('coffee_shops')
      .update({ roast_profile: profile })
      .eq('id', shop.id)

    setSaving(false)
    if (err) {
      setError('Could not save. Please try again.')
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-6 h-6 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-coffee-900">Roast Profile</h1>
        <p className="text-xs text-coffee-400 mt-1">
          Tell your followers about the coffee you serve. This appears on your public shop page.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-cream-200 p-5 space-y-5">

        {/* Roaster */}
        <div>
          <label className="block text-xs font-semibold text-coffee-600 mb-1.5">Roaster name</label>
          <input
            value={roaster}
            onChange={e => setRoaster(e.target.value)}
            placeholder="e.g. Counter Culture, Heart Coffee, local roaster..."
            className="w-full text-sm border border-cream-200 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-caramel/30 bg-cream-50"
          />
        </div>

        {/* Roast levels */}
        <div>
          <label className="block text-xs font-semibold text-coffee-600 mb-2">Roast levels you offer</label>
          <div className="flex flex-wrap gap-2">
            {ROAST_LEVELS.map(l => (
              <PillToggle
                key={l}
                label={l}
                selected={roastLevels.includes(l)}
                onToggle={() => toggle(roastLevels, setRoastLevels, l)}
              />
            ))}
          </div>
        </div>

        {/* Origins */}
        <div>
          <label className="block text-xs font-semibold text-coffee-600 mb-2">Bean origins</label>
          <div className="flex flex-wrap gap-2">
            {ORIGINS.map(o => (
              <PillToggle
                key={o}
                label={o}
                selected={origins.includes(o)}
                onToggle={() => toggle(origins, setOrigins, o)}
              />
            ))}
          </div>
        </div>

        {/* Brew methods */}
        <div>
          <label className="block text-xs font-semibold text-coffee-600 mb-2">Brew methods</label>
          <div className="flex flex-wrap gap-2">
            {BREW_METHODS.map(m => (
              <PillToggle
                key={m}
                label={m}
                selected={brewMethods.includes(m)}
                onToggle={() => toggle(brewMethods, setBrewMethods, m)}
              />
            ))}
          </div>
        </div>

        {/* Tasting notes */}
        <div>
          <label className="block text-xs font-semibold text-coffee-600 mb-1.5">
            Tasting notes <span className="font-normal text-coffee-400">(optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value.slice(0, MAX_NOTES))}
            rows={3}
            placeholder="e.g. Expect notes of dark chocolate, caramel, and a bright citrus finish..."
            className="w-full text-sm border border-cream-200 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-caramel/30 resize-none bg-cream-50"
          />
          <p className="text-xs text-coffee-400 text-right mt-0.5">{notes.length}/{MAX_NOTES}</p>
        </div>

        {error && <p className="text-red-500 text-xs bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2.5 rounded-xl text-white font-semibold text-sm disabled:opacity-40 transition-all"
          style={{ background: '#c8853a' }}
        >
          {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save roast profile'}
        </button>
      </div>
    </div>
  )
}
