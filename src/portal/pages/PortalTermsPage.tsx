import { ArrowLeft } from 'lucide-react'

export default function PortalTermsPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="fixed inset-0 z-[400] bg-cream-50 flex flex-col">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-cream-200 bg-white">
        <button onClick={onBack} className="text-coffee-500"><ArrowLeft size={22} /></button>
        <h2 className="font-display text-xl font-bold text-coffee-800">Portal Terms of Service</h2>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5 pb-20">
        <p className="text-coffee-400 text-xs">Last updated: June 2026 · Version 1.0</p>

        <section className="space-y-2">
          <h3 className="text-coffee-800 font-semibold text-base">1. About the Portal</h3>
          <p className="text-coffee-600 text-sm leading-relaxed">The Social Brew Shop Owner Portal is a business tool that lets you manage your coffee shop's presence on the Social Brew platform — including your listing, posts, punch card loyalty program, and customer interactions.</p>
        </section>

        <section className="space-y-2">
          <h3 className="text-coffee-800 font-semibold text-base">2. Eligibility</h3>
          <p className="text-coffee-600 text-sm leading-relaxed">You must be authorised by the shop owner to use this portal. By requesting access, you confirm you have the right to represent the business and manage its presence on Social Brew. Misrepresentation may result in immediate access revocation.</p>
        </section>

        <section className="space-y-2">
          <h3 className="text-coffee-800 font-semibold text-base">3. Your Responsibilities</h3>
          <ul className="text-coffee-600 text-sm leading-relaxed space-y-1 list-none">
            <li>Keep your shop information accurate and up to date</li>
            <li>Do not post misleading, false, or promotional content that misrepresents your shop</li>
            <li>Respond to customer feedback professionally and in good faith</li>
            <li>Keep your portal credentials secure and do not share them with unauthorised individuals</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h3 className="text-coffee-800 font-semibold text-base">4. Shop Content & Social Media</h3>
          <p className="text-coffee-600 text-sm leading-relaxed">You own the content you post through the portal (shop updates, announcements, photos). By posting, you grant Social Brew a worldwide, royalty-free licence to display and reshare your content on the platform and on Social Brew's social media accounts (such as Instagram and TikTok) to promote your shop and the Social Brew community. We will credit your shop when resharing your content.</p>
        </section>

        <section className="space-y-2">
          <h3 className="text-coffee-800 font-semibold text-base">5. Punch Card Programs</h3>
          <p className="text-coffee-600 text-sm leading-relaxed">You are responsible for honouring rewards issued through your punch card program. Social Brew facilitates the loyalty system but is not liable for the fulfilment of rewards. It is your responsibility to ensure your program terms are clearly communicated to customers.</p>
        </section>

        <section className="space-y-2">
          <h3 className="text-coffee-800 font-semibold text-base">6. Customer Data</h3>
          <p className="text-coffee-600 text-sm leading-relaxed">Through the portal you can access aggregated review data and follower information for your shop. This data may only be used to improve your shop's service and engagement on Social Brew. You may not export, sell, or misuse customer data for purposes unrelated to your shop's presence on the platform.</p>
        </section>

        <section className="space-y-2">
          <h3 className="text-coffee-800 font-semibold text-base">7. Termination</h3>
          <p className="text-coffee-600 text-sm leading-relaxed">Social Brew may suspend or revoke portal access at any time for violations of these terms, misrepresentation, or conduct deemed harmful to the platform or its users. You may request account closure by emailing hello@socialbrewapp.com.</p>
        </section>

        <section className="space-y-2">
          <h3 className="text-coffee-800 font-semibold text-base">8. Changes</h3>
          <p className="text-coffee-600 text-sm leading-relaxed">We may update these terms as the portal evolves. Continued use of the portal after notice of changes constitutes your acceptance of the updated terms.</p>
        </section>

        <p className="text-coffee-400 text-xs text-center pt-2">Questions? Email hello@socialbrewapp.com</p>
      </div>
    </div>
  )
}
