export function isAffiliatedWithShop(profile: any, shopId: string | null | undefined): boolean {
  if (!shopId) return false
  return profile?.shop_id === shopId || profile?.team_shop_id === shopId
}
