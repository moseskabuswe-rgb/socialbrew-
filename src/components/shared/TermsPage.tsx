import { ArrowLeft } from 'lucide-react'

export default function TermsPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="fixed inset-0 z-[400] bg-cream-100 flex flex-col">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-cream-200 bg-white">
        <button onClick={onBack} className="text-coffee-500"><ArrowLeft size={22} /></button>
        <h2 className="font-display text-xl font-bold text-coffee-800">Terms of Service</h2>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5 pb-20">
        <p className="text-coffee-400 text-xs">Last updated: June 2026 · Version 1.1</p>

        <section className="space-y-2">
          <h3 className="text-coffee-800 font-semibold text-base">1. Using Social Brew</h3>
          <p className="text-coffee-600 text-sm leading-relaxed">By creating an account you agree to these terms. Social Brew is for personal, non-commercial use. You must be at least 13 years old.</p>
        </section>

        <section className="space-y-2">
          <h3 className="text-coffee-800 font-semibold text-base">2. Your Content</h3>
          <p className="text-coffee-600 text-sm leading-relaxed">You own the content you post (ratings, photos, captions). By posting, you grant Social Brew a worldwide, royalty-free license to display, distribute, and reshare your content — including on Social Brew's social media accounts such as Instagram and TikTok — to celebrate the community and promote the platform. We will always credit you by username when resharing your content. You are responsible for ensuring your content does not infringe third-party rights.</p>
        </section>

        <section className="space-y-2">
          <h3 className="text-coffee-800 font-semibold text-base">3. Community Rules</h3>
          <p className="text-coffee-600 text-sm leading-relaxed">You agree not to:</p>
          <ul className="text-coffee-600 text-sm leading-relaxed space-y-1 list-none">
            <li>Post spam, abusive, harassing, or illegal content</li>
            <li>Impersonate another person or business</li>
            <li>Attempt to access accounts or systems you are not authorised to use</li>
            <li>Use the app to scrape data or build competing services</li>
            <li>Post fake shop reviews or manipulate ratings</li>
          </ul>
          <p className="text-coffee-600 text-sm leading-relaxed">Violations may result in account suspension or removal.</p>
        </section>

        <section className="space-y-2">
          <h3 className="text-coffee-800 font-semibold text-base">4. Punch Card Loyalty</h3>
          <p className="text-coffee-600 text-sm leading-relaxed">Punch cards are managed by participating coffee shops. Social Brew facilitates the loyalty system but is not responsible for the fulfilment of rewards. Rewards are subject to each shop's own terms.</p>
        </section>

        <section className="space-y-2">
          <h3 className="text-coffee-800 font-semibold text-base">5. Shop Listings</h3>
          <p className="text-coffee-600 text-sm leading-relaxed">Community-added shop data is provided in good faith. Social Brew does not guarantee the accuracy of shop information (hours, address, etc.). Please verify with the shop directly.</p>
        </section>

        <section className="space-y-2">
          <h3 className="text-coffee-800 font-semibold text-base">6. Disclaimers</h3>
          <p className="text-coffee-600 text-sm leading-relaxed">Social Brew is provided "as is" without warranties of any kind. We are not liable for any indirect or consequential damages arising from your use of the app.</p>
        </section>

        <section className="space-y-2">
          <h3 className="text-coffee-800 font-semibold text-base">7. Termination</h3>
          <p className="text-coffee-600 text-sm leading-relaxed">We may suspend or terminate accounts that violate these terms. You may delete your account at any time from Settings.</p>
        </section>

        <section className="space-y-2">
          <h3 className="text-coffee-800 font-semibold text-base">8. Changes</h3>
          <p className="text-coffee-600 text-sm leading-relaxed">We may update these terms. You will be notified in-app and asked to accept any material changes.</p>
        </section>

        <p className="text-coffee-400 text-xs text-center pt-2">Questions? Email privacy@socialbrewapp.com</p>
      </div>
    </div>
  )
}
