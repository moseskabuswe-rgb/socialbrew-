import { ArrowLeft } from 'lucide-react'

export default function PortalPrivacyPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="fixed inset-0 z-[400] bg-cream-50 flex flex-col">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-cream-200 bg-white">
        <button onClick={onBack} className="text-coffee-500"><ArrowLeft size={22} /></button>
        <h2 className="font-display text-xl font-bold text-coffee-800">Portal Privacy Policy</h2>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5 pb-20">
        <p className="text-coffee-400 text-xs">Last updated: June 2026 · Version 1.0</p>

        <section className="space-y-2">
          <h3 className="text-coffee-800 font-semibold text-base">1. Who We Are</h3>
          <p className="text-coffee-600 text-sm leading-relaxed">Social Brew operates the Shop Owner Portal, a business management tool for coffee shops listed on the Social Brew platform. Contact: <span className="text-caramel">hello@socialbrewapp.com</span></p>
        </section>

        <section className="space-y-2">
          <h3 className="text-coffee-800 font-semibold text-base">2. What We Collect</h3>
          <ul className="text-coffee-600 text-sm leading-relaxed space-y-1.5 list-none">
            <li><span className="font-medium">Business contact info:</span> your name, email address, and role at the shop</li>
            <li><span className="font-medium">Shop data:</span> name, address, hours, photos, and other listing details you provide or edit</li>
            <li><span className="font-medium">Portal activity:</span> posts, announcements, punch card program configuration, and team member management</li>
            <li><span className="font-medium">Access request details:</span> information submitted when requesting portal access, including verification details</li>
            <li><span className="font-medium">Usage data:</span> in-portal activity for analytics and platform improvement via PostHog</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h3 className="text-coffee-800 font-semibold text-base">3. How We Use Your Data</h3>
          <ul className="text-coffee-600 text-sm leading-relaxed space-y-1.5 list-none">
            <li>To verify your identity and authorisation to manage a shop</li>
            <li>To provide and operate the Shop Owner Portal</li>
            <li>To display your shop's listing and content to Social Brew users</li>
            <li>To send you notification digests and alerts about your shop's activity</li>
            <li>To facilitate your punch card loyalty program</li>
            <li>To improve the portal and platform based on how it is used</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h3 className="text-coffee-800 font-semibold text-base">4. Third Parties</h3>
          <ul className="text-coffee-600 text-sm leading-relaxed space-y-1.5 list-none">
            <li><span className="font-medium">Supabase</span> — database and authentication (US servers)</li>
            <li><span className="font-medium">Cloudflare Pages</span> — hosting and CDN</li>
            <li><span className="font-medium">Resend</span> — transactional email notifications</li>
            <li><span className="font-medium">PostHog</span> — anonymised usage analytics</li>
          </ul>
          <p className="text-coffee-600 text-sm leading-relaxed">We do not sell your personal or business data to third parties.</p>
        </section>

        <section className="space-y-2">
          <h3 className="text-coffee-800 font-semibold text-base">5. Data Shared With You</h3>
          <p className="text-coffee-600 text-sm leading-relaxed">Through the portal you can access review data, follower counts, punch card analytics, and customer interaction data for your shop only. This data is provided to help you understand and improve your shop's presence on Social Brew.</p>
        </section>

        <section className="space-y-2">
          <h3 className="text-coffee-800 font-semibold text-base">6. Your Rights</h3>
          <ul className="text-coffee-600 text-sm leading-relaxed space-y-1.5 list-none">
            <li><span className="font-medium">Access & correction:</span> update your shop info and contact details directly in the portal</li>
            <li><span className="font-medium">Notifications:</span> manage email notification preferences in Settings</li>
            <li><span className="font-medium">Account closure:</span> email hello@socialbrewapp.com to request removal of your portal access and associated data</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h3 className="text-coffee-800 font-semibold text-base">7. Data Retention</h3>
          <p className="text-coffee-600 text-sm leading-relaxed">Your portal account data is retained while your account is active. Upon closure, personal contact data is removed within 30 days. Shop listing data (name, address, etc.) may be retained as part of the Social Brew directory.</p>
        </section>

        <section className="space-y-2">
          <h3 className="text-coffee-800 font-semibold text-base">8. Changes to This Policy</h3>
          <p className="text-coffee-600 text-sm leading-relaxed">We may update this policy as the portal evolves. We will notify you of material changes via email or an in-portal notice.</p>
        </section>

        <p className="text-coffee-400 text-xs text-center pt-2">Questions? Email hello@socialbrewapp.com</p>
      </div>
    </div>
  )
}
