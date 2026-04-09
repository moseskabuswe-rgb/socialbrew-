// src/components/home/HomeTab.tsx
import { useState } from 'react';
import { Coffee, Camera } from 'lucide-react';
import ShopSelector from './ShopSelector';
import MugRating from './MugRating';
import ShareMoment from './ShareMoment';
import Wishlist from './Wishlist';
import MessagesPanel from './MessagesPanel';
import { useAuth } from '../../contexts/AuthContext';
import type { CoffeeShop } from '../../lib/supabase';

type HomeTabProps = { shop?: CoffeeShop; onClose?: () => void; onComplete?: () => void; refresh?: number };

export default function HomeTab({ shop, onClose, onComplete }: HomeTabProps) {
  const { profile } = useAuth();
  const [selectedShop, setSelectedShop] = useState<CoffeeShop | null>(shop || null);
  const [showShopSelector, setShowShopSelector] = useState(false);
  const [showShareMoment, setShowShareMoment] = useState(false);
  const [showMugRating, setShowMugRating] = useState(false);

  if (!profile) return null;

  return (
    <div className="p-5 space-y-6">
      {/* Header */}
      <header className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-coffee-800">Welcome, {profile.username}</h1>
        <div className="flex gap-3">
          <button
            onClick={() => setShowShopSelector(true)}
            className="p-2 rounded-full bg-cream-100 hover:bg-cream-200 transition"
          >
            <Coffee size={20} />
          </button>
          <button
            onClick={() => setShowShareMoment(true)}
            className="p-2 rounded-full bg-cream-100 hover:bg-cream-200 transition"
          >
            <Camera size={20} />
          </button>
        </div>
      </header>

      {/* Selected Shop */}
      {selectedShop && (
        <div className="bg-cream-50 p-4 rounded-xl shadow-sm">
          <h2 className="text-coffee-800 font-semibold">{selectedShop.name}</h2>
          {selectedShop.address && (
            <p className="text-coffee-400 text-sm">
              {[selectedShop.address, selectedShop.city, selectedShop.state].filter(Boolean).join(', ')}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setShowMugRating(true)}
              className="px-4 py-2 bg-caramel text-white rounded-lg"
            >
              Rate Your Mug
            </button>
            <button
              onClick={() => setSelectedShop(null)}
              className="px-4 py-2 bg-coffee-200 text-white rounded-lg"
            >
              Deselect
            </button>
          </div>
        </div>
      )}

      {/* Wishlist Section */}
      <section className="mt-6">
        <h2 className="text-coffee-800 font-semibold text-lg mb-2">Your Wishlist</h2>
        <Wishlist />
      </section>

      {/* Messages Panel */}
      <MessagesPanel onClose={() => {}} />

      {/* Modals */}
      {showShopSelector && (
        <ShopSelector
          onSelect={shop => {
            setSelectedShop(shop);
            setShowShopSelector(false);
          }}
          onClose={() => setShowShopSelector(false)}
        />
      )}

      {showShareMoment && (
        <ShareMoment
          onClose={() => setShowShareMoment(false)}
          onComplete={() => setShowShareMoment(false)}
        />
      )}

      {showMugRating && selectedShop && (
        <MugRating
          shop={selectedShop}
          onClose={() => setShowMugRating(false)}
          onComplete={() => setShowMugRating(false)}
        />
      )}
    </div>
  );
}
