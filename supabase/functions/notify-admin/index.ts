import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_KEY = Deno.env.get('RESEND_API_KEY') || Deno.env.get('RESEND_KEY') || ''
const ADMIN_EMAIL = Deno.env.get('ADMIN_EMAIL') || 'moses@socialbrewapp.com'
const FROM = Deno.env.get('FROM_EMAIL') || 'Social Brew <noreply@socialbrewapp.com>'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

async function sendEmail(to: string, subject: string, html: string, bcc?: string[]) {
  if (!RESEND_KEY) {
    console.error('[notify-admin] RESEND_API_KEY / RESEND_KEY not set — email skipped')
    return
  }
  console.log(`[notify-admin] Sending to ${to}: ${subject}`)
  const payload: Record<string, unknown> = { from: FROM, to, subject, html }
  if (bcc?.length) payload.bcc = bcc
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_KEY}` },
    body: JSON.stringify(payload),
  })
  const body = await res.text()
  if (!res.ok) {
    console.error(`[notify-admin] Resend error ${res.status}:`, body)
  } else {
    console.log(`[notify-admin] Resend OK:`, body)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  let body: any
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }

  const { type, data } = body
  if (!type) return new Response(JSON.stringify({ error: 'Missing type' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } })

  console.log(`[notify-admin] type=${type} key_set=${!!RESEND_KEY}`)

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    switch (type) {
      case 'claim': {
        const { shop_name, claimant_name, claimant_email, claimant_role, message } = data
        await sendEmail(
          ADMIN_EMAIL,
          `New shop claim: ${shop_name}`,
          `<p><b>${claimant_name}</b> (${claimant_email}) submitted a claim for <b>${shop_name}</b> as ${claimant_role}.</p>
           ${message ? `<p>Message: ${message}</p>` : ''}
           <p><a href="https://socialbrewapp.com/admin">Review in Admin Portal &rarr;</a></p>`,
        )
        break
      }

      case 'new_shop': {
        const { shop_name, city, state, added_by_username } = data
        await sendEmail(
          ADMIN_EMAIL,
          `New community shop: ${shop_name}`,
          `<p>@${added_by_username} added <b>${shop_name}</b> in ${city}${state ? `, ${state}` : ''}.</p>
           <p><a href="https://socialbrewapp.com/admin">Review in Admin Portal &rarr;</a></p>`,
        )
        break
      }

      case 'claim_approved': {
        const { claimant_email, shop_name, invite_link, punch_quota } = data
        if (!claimant_email) break
        await sendEmail(
          claimant_email,
          `Your claim for ${shop_name} is approved!`,
          `<p>Congratulations! Your claim for <b>${shop_name}</b> on Social Brew has been approved.</p>
           <p>Click below to set up your shop portal account:</p>
           <p><a href="${invite_link}" style="display:inline-block;padding:10px 20px;background:#c8853a;color:white;border-radius:8px;text-decoration:none;font-weight:bold;">Set Up Your Portal &rarr;</a></p>
           <p>Your starting punch card quota is <b>${punch_quota}</b> stamps/month.</p>
           <p>Welcome to Social Brew! &#9749;</p>`,
          ['elle@socialbrewapp.com'],
        )
        break
      }

      case 'claim_rejected': {
        const { claimant_email, shop_name, reason } = data
        if (!claimant_email) break
        await sendEmail(
          claimant_email,
          `Update on your claim for ${shop_name}`,
          `<p>Thank you for your interest in claiming <b>${shop_name}</b> on Social Brew.</p>
           <p>After review, we weren't able to approve this claim at this time.</p>
           ${reason ? `<p><b>Reason:</b> ${reason}</p>` : ''}
           <p>If you have questions, reply to this email or contact support@socialbrewapp.com.</p>`,
        )
        break
      }

      case 'punch_card': {
        const { shop_name, punches_required, reward_description, expiry_days, is_update } = data
        await sendEmail(
          ADMIN_EMAIL,
          `Punch card ${is_update ? 'updated' : 'submitted'}: ${shop_name}`,
          `<p><b>${shop_name}</b> has ${is_update ? 'updated' : 'submitted'} a punch card for review.</p>
           <ul>
             <li>Punches required: ${punches_required}</li>
             <li>Reward: ${reward_description}</li>
             ${expiry_days ? `<li>Expiry: ${expiry_days} days after earning</li>` : ''}
           </ul>
           <p><a href="https://socialbrewapp.com/admin">Review in Admin Portal &rarr;</a></p>`,
        )
        break
      }

      case 'punch_card_approved': {
        const { shop_id, shop_name, reward_description } = data
        const { data: owner } = await supabase.from('shop_owners').select('profile_id').eq('shop_id', shop_id).maybeSingle()
        if (owner?.profile_id) {
          const { data: authUser } = await supabase.auth.admin.getUserById(owner.profile_id)
          const ownerEmail = authUser?.user?.email
          if (ownerEmail) {
            await sendEmail(
              ownerEmail,
              `Your punch card for ${shop_name} is approved!`,
              `<p>Great news! Your punch card for <b>${shop_name}</b> has been approved and is now live.</p>
               <p>Reward: <b>${reward_description}</b></p>
               <p>Customers can now collect stamps. View your QR code in the <a href="https://socialbrewapp.com/portal">Shop Portal</a>.</p>`,
            )
          }
        }
        break
      }

      case 'punch_card_rejected': {
        const { shop_id, shop_name, rejection_reason } = data
        const { data: owner } = await supabase.from('shop_owners').select('profile_id').eq('shop_id', shop_id).maybeSingle()
        if (owner?.profile_id) {
          const { data: authUser } = await supabase.auth.admin.getUserById(owner.profile_id)
          const ownerEmail = authUser?.user?.email
          if (ownerEmail) {
            await sendEmail(
              ownerEmail,
              `Update on your punch card for ${shop_name}`,
              `<p>Your punch card request for <b>${shop_name}</b> was not approved at this time.</p>
               ${rejection_reason ? `<p><b>Reason:</b> ${rejection_reason}</p>` : ''}
               <p>You can update and resubmit from the <a href="https://socialbrewapp.com/portal">Shop Portal</a>.</p>`,
            )
          }
        }
        break
      }

      case 'quota_request': {
        const { shop_name, shop_id, quota_used, quota_max, is_founding_partner } = data
        await sendEmail(
          ADMIN_EMAIL,
          `Quota increase request: ${shop_name}`,
          `<p><b>${shop_name}</b> has requested more punch quota.</p>
           <ul>
             <li>Used: ${quota_used} / ${quota_max}</li>
             <li>Founding partner: ${is_founding_partner ? 'Yes' : 'No'}</li>
             <li>Shop ID: ${shop_id}</li>
           </ul>
           <p><a href="https://socialbrewapp.com/admin">Manage in Admin Portal &rarr;</a></p>`,
        )
        break
      }

      case 'new_addon_request':
      case 'low_fill_alert': {
        await sendEmail(ADMIN_EMAIL, `Social Brew alert: ${type}`, `<pre>${JSON.stringify(data, null, 2)}</pre>`)
        break
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown type: ${type}` }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('[notify-admin] error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }
})
