import { useAuth } from '../contexts/AuthContext'
import AdminLayout from './AdminLayout'

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-cream-50">
      <div className="w-8 h-8 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
    </div>
  )
}

export default function AdminApp() {
  const { profile, loading } = useAuth()
  if (loading) return <Spinner />
  if (!profile || !['admin', 'moderator'].includes(profile.role as string)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-50">
        <p className="text-coffee-400 text-sm">Access denied.</p>
      </div>
    )
  }
  return <AdminLayout profile={profile} />
}
