// src/components/home/HomeTab.tsx
import { useState } from 'react';
import { Coffee, Camera } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

// Correct relative imports
import ShopSelector from '../shop/ShopSelector';
import MugRating from '../shop/MugRating';
import ShareMoment from '../shop/ShareMoment';
import Wishlist from './Wishlist';
import MessagesPanel from './MessagesPanel';

type HomeTabProps = {
  shop?: any;
  onClose?: () => void;
  onComplete?: () => void;
  refresh?: number;
};

export default function HomeTab({ shop, onClose, onComplete }: HomeTabProps) {
  const { profile } = useAuth();
  const [selectedShop, setSelectedShop] = useState(shop || null);
  const [showWishlist, setShowWishlist] = useState(false);

  if (!profile) return null;

  return (
    <div className="home-tab-container">
      <header className="home-tab-header">
        <h1>Welcome, {profile.username}</h1>
      </header>

      {/* Messages modal */}
      <MessagesPanel onClose={() => {}} />

      {/* Wishlist modal */}
      {showWishlist && <Wishlist onClose={() => setShowWishlist(false)} />}

      <section className="home-tab-content">
        {selectedShop ? (
          <>
            <div className="shop-info">
              <h2>{selectedShop.name}</h2>
              <p>{selectedShop.description}</p>
            </div>
            <MugRating shop={selectedShop} />
            <ShareMoment shop={selectedShop} />
          </>
        ) : (
          <p>No shop selected</p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setShowWishlist(true)}
            className="px-4 py-2 bg-caramel text-white rounded"
          >
            Wishlist
          </button>
          <button
            onClick={() => {
              setSelectedShop(null);
              onClose?.();
            }}
            className="px-4 py-2 bg-gray-300 rounded"
          >
            Close
          </button>
          <button
            onClick={() => onComplete?.()}
            className="px-4 py-2 bg-green-600 text-white rounded"
          >
            Complete Action
          </button>
        </div>
      </section>

      <footer className="home-tab-footer flex gap-4 mt-4">
        <Coffee size={24} />
        <Camera size={24} />
      </footer>
    </div>
  );
}
