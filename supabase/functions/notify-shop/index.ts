import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_KEY = Deno.env.get('RESEND_API_KEY') || ''
const FROM = 'Moses from Social Brew <moses@socialbrewapp.com>'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TIER_LABELS: Record<string, string> = {
  basic: 'Basic',
  middle: 'Growth',
  premium: 'Premium',
  founding: 'Founding Partner',
}

function wrap(title: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5efe6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:520px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
    <div style="background:linear-gradient(135deg,#c8853a,#9b5e1a);padding:28px 40px;text-align:center">
      <p style="margin:0;font-size:30px">☕</p>
      <p style="margin:6px 0 0;color:#ffffff;font-size:17px;font-weight:700;letter-spacing:-0.2px">Social Brew</p>
    </div>
    <div style="padding:32px 40px">
      <h1 style="margin:0 0 14px;font-size:20px;font-weight:700;color:#2c1a0e;line-height:1.3">${title}</h1>
      ${body}
      <div style="margin-top:32px;padding-top:20px;border-top:1px solid #f0e8d8;text-align:center">
        <p style="margin:0;font-size:12px;color:#9b7a55">Questions? Reply to this email or message us on Social Brew.</p>
      </div>
    </div>
  </div>
</body>
</html>`
}

function p(text: string): string {
  return `<p style="font-size:15px;color:#5a3e2b;line-height:1.65;margin:0 0 14px">${text}</p>`
}

function pill(text: string, color = '#c8853a'): string {
  return `<span style="display:inline-block;background:${color}1a;color:${color};font-size:13px;font-weight:700;padding:4px 12px;border-radius:100px;border:1px solid ${color}33">${text}</span>`
}

function buildEmail(type: string, data: Record<string, any>): { subject: string; html: string } | null {
  const name = data.shop_name || 'your shop'

  if (type === 'founding_partner_granted') {
    return {
      subject: `⭐ ${name} is now a Founding Partner on Social Brew`,
      html: wrap('You\'re a Founding Partner!', [
        p(`Congratulations — <strong>${name}</strong> has been granted ${pill('⭐ Founding Partner')} status on Social Brew.`),
        p('As a Founding Partner you receive a lifetime punch card allocation — our way of saying thank you for being one of the first shops to join the Social Brew community.'),
        p('This badge is shown on your shop profile and sets you apart as one of the originals. We\'re excited to grow with you. ☕'),
      ].join('')),
    }
  }

  if (type === 'founding_partner_revoked') {
    return {
      subject: `Founding Partner status update for ${name}`,
      html: wrap('Founding Partner status update', [
        p(`The Founding Partner status for <strong>${name}</strong> has been removed from your account.`),
        p('If you think this is a mistake or have questions, please reply to this email and we\'ll look into it right away.'),
      ].join('')),
    }
  }

  if (type === 'tier_changed') {
    const tierLabel = TIER_LABELS[data.new_tier] || data.new_tier
    const billing = data.billing_cycle === 'annual' ? 'Annual' : 'Monthly'
    return {
      subject: `Your Social Brew plan has been updated — ${name}`,
      html: wrap('Your plan has been updated', [
        p(`Your Social Brew plan for <strong>${name}</strong> has been updated to ${pill(tierLabel)} on a <strong>${billing}</strong> billing cycle.`),
        p('Your new plan is active immediately. Log in to your portal to see what\'s included.'),
        p('If you have any questions about your plan, just reply to this email.'),
      ].join('')),
    }
  }

  if (type === 'addon_approved') {
    const qty = data.quantity ? ` (×${data.quantity})` : ''
    return {
      subject: `✅ Add-on approved for ${name}`,
      html: wrap('Your add-on request was approved', [
        p(`Great news! Your request for <strong>${data.addon_type}${qty}</strong> has been approved for <strong>${name}</strong>.`),
        p('The add-on has been applied to your account and is active now.'),
        p('Log in to your portal to see the updated details. Thanks for being part of Social Brew!'),
      ].join('')),
    }
  }

  if (type === 'addon_declined') {
    return {
      subject: `Add-on request update for ${name}`,
      html: wrap('Your add-on request was not approved', [
        p(`Unfortunately your request for <strong>${data.addon_type}</strong> for <strong>${name}</strong> was not approved at this time.`),
        p('If you have questions or would like to discuss alternatives, please reply to this email and we\'ll be happy to help.'),
      ].join('')),
    }
  }

  if (type === 'verified_granted') {
    return {
      subject: `✓ ${name} is now verified on Social Brew`,
      html: wrap(`${name} is now verified!`, [
        p(`<strong>${name}</strong> has been granted ${pill('✓ Verified')} status on Social Brew.`),
        p('Your verified badge is now showing on your shop profile — it lets customers know you\'re an official, authenticated presence on Social Brew.'),
        p('Thanks for being part of the community. See you out there! ☕'),
      ].join('')),
    }
  }

  return null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { type, data } = await req.json()
    const emails: string[] = (data?.emails || []).filter(Boolean)

    if (!emails.length) {
      return new Response('no recipients', { headers: CORS })
    }

    const email = buildEmail(type, data)
    if (!email) {
      return new Response('unknown type', { headers: CORS })
    }

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_KEY}`,
      },
      body: JSON.stringify({
        from: FROM,
        to: emails,
        subject: email.subject,
        html: email.html,
      }),
    })

    return new Response('ok', { headers: CORS })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
