import ShopQRDisplay from '../../components/shops/ShopQRDisplay'

interface Props {
  shop: { id: string; name: string }
  userId: string
}

export default function PortalScanner({ shop }: Props) {
  return (
    <div className="max-w-sm mx-auto py-4">
      <ShopQRDisplay shopId={shop.id} />
    </div>
  )
}
