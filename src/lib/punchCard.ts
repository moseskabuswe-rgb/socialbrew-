import { supabase } from './supabase'

export interface PunchAwardResult {
  awarded: boolean
  newCount?: number
  required?: number
  rewardEarned?: boolean
}

export async function tryAwardPunch(shopId: string, userId: string): Promise<PunchAwardResult> {
  const { data: card } = await supabase
    .from('punch_cards')
    .select('id, punches_required')
    .eq('shop_id', shopId)
    .eq('is_active', true)
    .maybeSingle()

  if (!card) return { awarded: false }

  const { data: owner } = await supabase
    .from('shop_owners')
    .select('founding_partner, punches_issued_total, punches_issued_this_month, punch_quota_reset_at')
    .eq('shop_id', shopId)
    .maybeSingle()

  if (!owner) return { awarded: false }

  const now = new Date()
  const resetDate = owner.punch_quota_reset_at ? new Date(owner.punch_quota_reset_at) : null
  const monthlyUsed = resetDate && resetDate < now ? 0 : (owner.punches_issued_this_month || 0)
  const hasQuota = owner.founding_partner
    ? (owner.punches_issued_total || 0) < 50
    : monthlyUsed < 10

  if (!hasQuota) return { awarded: false }

  const { data: existing } = await supabase
    .from('user_punches')
    .select('id, current_count, total_earned')
    .eq('user_id', userId)
    .eq('shop_id', shopId)
    .maybeSingle()

  let newCount: number
  if (existing) {
    newCount = existing.current_count + 1
    await supabase.from('user_punches').update({
      current_count: newCount,
      total_earned: (existing.total_earned || 0) + 1,
      last_earned_at: now.toISOString(),
    }).eq('id', existing.id)
  } else {
    newCount = 1
    await supabase.from('user_punches').insert({
      user_id: userId,
      shop_id: shopId,
      current_count: 1,
      total_earned: 1,
      last_earned_at: now.toISOString(),
    })
  }

  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()
  if (owner.founding_partner) {
    await supabase.from('shop_owners').update({
      punches_issued_total: (owner.punches_issued_total || 0) + 1,
    }).eq('shop_id', shopId)
  } else if (resetDate && resetDate < now) {
    await supabase.from('shop_owners').update({
      punches_issued_this_month: 1,
      punch_quota_reset_at: nextMonth,
    }).eq('shop_id', shopId)
  } else {
    await supabase.from('shop_owners').update({
      punches_issued_this_month: monthlyUsed + 1,
      ...(!resetDate ? { punch_quota_reset_at: nextMonth } : {}),
    }).eq('shop_id', shopId)
  }

  return {
    awarded: true,
    newCount,
    required: card.punches_required,
    rewardEarned: newCount >= card.punches_required,
  }
}
