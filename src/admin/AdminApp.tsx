import { useEffect } from 'react'
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

  useEffect(() => {
    if (!loading && !profile) {
      window.location.href = '/'
    }
  }, [loading, profile])

  if (loading || !profile) return <Spinner />

  if (profile.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-50 flex-col gap-2">
        <p className="text-coffee-900 text-sm font-medium">Access denied</p>
        <p className="text-coffee-400 text-xs">Signed in as @{profile.username} ({profile.role})</p>
        <button onClick={() => { window.location.href = '/' }} className="mt-2 text-xs text-caramel underline">Back to app</button>
      </div>
    )
  }

  return <AdminLayout profile={profile} />
}
