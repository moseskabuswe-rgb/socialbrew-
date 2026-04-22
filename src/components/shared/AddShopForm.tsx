// src/components/shared/AddShopForm.tsx
// Lets users add a coffee shop that doesn't exist in the database yet.
// Shop is created as is_verified=false (community added) and is immediately
// searchable and ratable. Auto-verifies after 5 unique user ratings.

import { useState } from 'react'
import { X, MapPin, Globe, Clock, Coffee } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

interface Props {
  initialName?: string        // pre-fill from search query
  onClose: () => void
  onShopCreated: (shop: any) => void  // called with new shop so caller can use it
}

export default function AddShopForm({ initialName = '', onClose, onShopCreated }: Props) {
  const { profile } = useAuth()
  const [name, setName] = useState(initialName)
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [website, setWebsite] = useState('')
  const [hours, setHours] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!name.trim() || !city.trim()) {
      setError('Shop name and city are required')
      return
    }
    if (!profile) return
    setSubmitting(true)
    setError('')

    try {
      // Check if shop already exists by name + city
      const { data: existing } = await supabase
        .from('coffee_shops')
        .select('id, name, city, is_verified')
        .ilike('name', name.trim())
        .ilike('city', city.trim())
        .maybeSingle()

      if (existing) {
        setError(`"${existing.name}" in ${existing.city} is already in Social Brew`)
        setSubmitting(false)
        return
      }

      // Insert new community shop
      const { data: newShop, error: insertErr } = await supabase
        .from('coffee_shops')
        .insert({
          name: name.trim(),
          address: address.trim() || null,
          city: city.trim(),
          state: state.trim() || null,
          website: website.trim() || null,
          opening_hours: hours.trim() || null,
          is_verified: false,
          is_active: true,
          avg_rating: 0,
          total_ratings: 0,
          weekly_visits: 0,
          vibes: [],
          added_by: profile.id,
        })
        .select()
        .single()

      if (insertErr) throw insertErr

      onShopCreated(newShop)
    } catch (err: any) {
      setError('Something went wrong. Please try again.')
      console.error(err)
    }
    setSubmitting(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(8,4,1,0.9)' }}
    >
      <div className="w-full max-w-sm bg-white rounded-t-3xl animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-cream-200">
          <div>
            <h3 className="font-display font-bold text-coffee-800 text-lg">Add a Coffee Shop</h3>
            <p className="text-coffee-400 text-xs mt-0.5">It'll be available immediately for everyone to rate</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-cream-100 flex items-center justify-center text-coffee-500"
          >
            <X size={15} />
          </button>
        </div>

        {/* Form */}
        <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto pb-8">

          {/* Name — required */}
          <div>
            <label className="text-coffee-600 text-xs font-semibold block mb-1">
              Shop Name <span className="text-red-400">*</span>
            </label>
            <div className="flex items-center bg-cream-50 rounded-xl border border-cream-200 focus-within:border-caramel px-3 py-2.5 gap-2">
              <Coffee size={14} className="text-coffee-400 flex-shrink-0" />
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Methodical Coffee"
                className="flex-1 bg-transparent text-coffee-800 text-sm focus:outline-none placeholder-coffee-300"
                autoFocus
              />
            </div>
          </div>

          {/* City — required */}
          <div>
            <label className="text-coffee-600 text-xs font-semibold block mb-1">
              City <span className="text-red-400">*</span>
            </label>
            <div className="flex items-center bg-cream-50 rounded-xl border border-cream-200 focus-within:border-caramel px-3 py-2.5 gap-2">
              <MapPin size={14} className="text-coffee-400 flex-shrink-0" />
              <input
                value={city}
                onChange={e => setCity(e.target.value)}
                placeholder="e.g. Greenville"
                className="flex-1 bg-transparent text-coffee-800 text-sm focus:outline-none placeholder-coffee-300"
              />
            </div>
          </div>

          {/* State */}
          <div>
            <label className="text-coffee-600 text-xs font-semibold block mb-1">State / Region</label>
            <input
              value={state}
              onChange={e => setState(e.target.value)}
              placeholder="e.g. SC"
              className="w-full bg-cream-50 text-coffee-800 rounded-xl border border-cream-200 focus:border-caramel focus:outline-none px-3 py-2.5 text-sm placeholder-coffee-300"
            />
          </div>

          {/* Address */}
          <div>
            <label className="text-coffee-600 text-xs font-semibold block mb-1">Address</label>
            <input
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="e.g. 101 N Main St"
              className="w-full bg-cream-50 text-coffee-800 rounded-xl border border-cream-200 focus:border-caramel focus:outline-none px-3 py-2.5 text-sm placeholder-coffee-300"
            />
          </div>

          {/* Website */}
          <div>
            <label className="text-coffee-600 text-xs font-semibold block mb-1">Website</label>
            <div className="flex items-center bg-cream-50 rounded-xl border border-cream-200 focus-within:border-caramel px-3 py-2.5 gap-2">
              <Globe size={14} className="text-coffee-400 flex-shrink-0" />
              <input
                value={website}
                onChange={e => setWebsite(e.target.value)}
                placeholder="https://..."
                className="flex-1 bg-transparent text-coffee-800 text-sm focus:outline-none placeholder-coffee-300"
              />
            </div>
          </div>

          {/* Hours */}
          <div>
            <label className="text-coffee-600 text-xs font-semibold block mb-1">Hours</label>
            <div className="flex items-center bg-cream-50 rounded-xl border border-cream-200 focus-within:border-caramel px-3 py-2.5 gap-2">
              <Clock size={14} className="text-coffee-400 flex-shrink-0" />
              <input
                value={hours}
                onChange={e => setHours(e.target.value)}
                placeholder="e.g. Mon-Fri 7am-5pm"
                className="flex-1 bg-transparent text-coffee-800 text-sm focus:outline-none placeholder-coffee-300"
              />
            </div>
          </div>

          {error && (
            <p className="text-red-500 text-xs bg-red-50 rounded-xl px-3 py-2">{error}</p>
          )}

          {/* Community note */}
          <div className="bg-amber-50 rounded-xl px-3 py-2.5 border border-amber-100">
            <p className="text-amber-700 text-xs">
              🌱 Community added shops get a <strong>Social Brew Verified</strong> badge automatically after 5 people rate them.
            </p>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || !city.trim() || submitting}
            className="w-full py-3.5 rounded-2xl text-white font-bold text-sm disabled:opacity-40 transition-all active:scale-95"
            style={{ background: 'linear-gradient(135deg, #c8853a, #9b5e1a)', boxShadow: '0 4px 16px rgba(200,133,58,0.3)' }}
          >
            {submitting ? 'Adding shop...' : 'Add to Social Brew ☕'}
          </button>
        </div>
      </div>
    </div>
  )
}
