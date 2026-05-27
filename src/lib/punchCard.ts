import { supabase } from './supabase'

export interface PunchAwardResult {
  awarded: boolean
  newCount?: number
  required?: number
  rewardEarned?: boolean
}

export async function tryAwardPunch(shopId: string, userId: string): Promise<PunchAwardResult> {
  const { data, error } = await supabase.rpc('award_punch', {
    p_shop_id: shopId,
    p_user_id: userId,
  })
  if (error || !data) return { awarded: false }
  return {
    awarded: data.awarded,
    newCount: data.new_count,
    required: data.required,
    rewardEarned: data.reward_earned,
  }
}
