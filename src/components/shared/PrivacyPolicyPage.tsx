import { ArrowLeft } from 'lucide-react'

export default function PrivacyPolicyPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="fixed inset-0 z-[400] bg-cream-100 flex flex-col">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-cream-200 bg-white">
        <button onClick={onBack} className="text-coffee-500"><ArrowLeft size={22} /></button>
        <h2 className="font-display text-xl font-bold text-coffee-800">Privacy Policy</h2>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5 pb-20">
        <p className="text-coffee-400 text-xs">Last updated: June 2026 · Version 1.1</p>

        <section className="space-y-2">
          <h3 className="text-coffee-800 font-semibold text-base">1. Who We Are</h3>
          <p className="text-coffee-600 text-sm leading-relaxed">Social Brew is a mobile application that helps coffee lovers discover shops, log their visits, and connect with other coffee enthusiasts. Contact: <span className="text-caramel">privacy@socialbrewapp.com</span></p>
        </section>

        <section className="space-y-2">
          <h3 className="text-coffee-800 font-semibold text-base">2. What We Collect</h3>
          <ul className="text-coffee-600 text-sm leading-relaxed space-y-1.5 list-none">
            <li><span className="font-medium">Account info:</span> email address, username, display name, profile photo, bio</li>
            <li><span className="font-medium">Content you create:</span> coffee shop ratings, captions, photos, wishlist items, stories</li>
            <li><span className="font-medium">Social activity:</span> follows, likes, comments, messages</li>
            <li><span className="font-medium">Shop data:</span> coffee shop locations, names, and details you add or edit</li>
            <li><span className="font-medium">Device data:</span> push notification token (only if you enable notifications)</li>
            <li><span className="font-medium">Usage data:</span> in-app events (pages visited, features used) via PostHog analytics</li>
            <li><span className="font-medium">Loyalty data:</span> punch card progress and redemption history at participating shops</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h3 className="text-coffee-800 font-semibold text-base">3. How We Use Your Data</h3>
          <ul className="text-coffee-600 text-sm leading-relaxed space-y-1.5 list-none">
            <li>To provide and improve the Social Brew service</li>
            <li>To show your content to your followers and the community</li>
            <li>To send push notifications you have opted into</li>
            <li>To understand how the app is used so we can improve it</li>
            <li>To manage punch card loyalty programs with partner shops</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h3 className="text-coffee-800 font-semibold text-base">4. Third Parties</h3>
          <ul className="text-coffee-600 text-sm leading-relaxed space-y-1.5 list-none">
            <li><span className="font-medium">Supabase</span> — database and authentication (US servers)</li>
            <li><span className="font-medium">Cloudflare Pages</span> — hosting and CDN</li>
            <li><span className="font-medium">Firebase / Google</span> — push notifications</li>
            <li><span className="font-medium">PostHog</span> — anonymised usage analytics</li>
            <li><span className="font-medium">OpenStreetMap / Nominatim</span> — address geocoding when adding shops</li>
          </ul>
          <p className="text-coffee-600 text-sm leading-relaxed">We do not sell your personal data to third parties.</p>
        </section>

        <section className="space-y-2">
          <h3 className="text-coffee-800 font-semibold text-base">5. Your Rights</h3>
          <ul className="text-coffee-600 text-sm leading-relaxed space-y-1.5 list-none">
            <li><span className="font-medium">Access & correction:</span> edit your profile at any time in Settings</li>
            <li><span className="font-medium">Deletion:</span> delete your account and all associated data from Settings → Delete Account</li>
            <li><span className="font-medium">Notifications:</span> disable push notifications at any time in Settings</li>
            <li><span className="font-medium">Data requests:</span> email privacy@socialbrewapp.com</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h3 className="text-coffee-800 font-semibold text-base">6. Data Retention</h3>
          <p className="text-coffee-600 text-sm leading-relaxed">Your data is retained while your account is active. Notifications are automatically deleted after 60 days. When you delete your account, all personal data is permanently removed within 30 days.</p>
        </section>

        <section className="space-y-2">
          <h3 className="text-coffee-800 font-semibold text-base">7. Age Requirement</h3>
          <p className="text-coffee-600 text-sm leading-relaxed">Social Brew is intended for users aged 13 and older. If you are under 13, please do not use this app.</p>
        </section>

        <section className="space-y-2">
          <h3 className="text-coffee-800 font-semibold text-base">8. Changes to This Policy</h3>
          <p className="text-coffee-600 text-sm leading-relaxed">We may update this policy as the service evolves. You will be notified in-app when a new version requires your acceptance.</p>
        </section>

        <p className="text-coffee-400 text-xs text-center pt-2">Questions? Email privacy@socialbrewapp.com</p>
      </div>
    </div>
  )
}
