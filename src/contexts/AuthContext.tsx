import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/supabase'
import { identifyUser, trackEvent, resetUser } from '../lib/analytics'

type AuthContextType = {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  signUp: (email: string, password: string, username: string, fullName: string) => Promise<{ error: any }>
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(userId: string, userEmail?: string) {
    // Get fresh auth user to check email confirmation status
    const { data: { user: authUser } } = await supabase.auth.getUser()
    const isVerified = !!authUser?.email_confirmed_at

    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (data) {
      // Sync email_verified if it changed
      if (data.email_verified !== isVerified) {
        await supabase.from('profiles').update({ email_verified: isVerified }).eq('id', userId)
        data.email_verified = isVerified
      }
      setProfile(data)
      identifyUser(userId, {
        username: data.username,
        email: userEmail,
        role: data.role,
        tokens: data.tokens,
      })
    }
  }

  async function refreshProfile() {
    if (user) await loadProfile(user.id, user.email)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user.id, session.user.email)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user.id, session.user.email)
      else setProfile(null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signUp(email: string, password: string, username: string, fullName: string) {
    // Check username not taken first
    const { data: existing } = await supabase.from('profiles').select('id').eq('username', username).single()
    if (existing) return { error: { message: 'That username is already taken. Please choose another.' } }

    const { error, data } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } })
    if (!error && data.user) {
      // Update profile with chosen username
      await supabase.from('profiles').update({ username, full_name: fullName }).eq('id', data.user.id)
      trackEvent('signed_up', { username, email })
      // Auto sign in after signup
      await supabase.auth.signInWithPassword({ email, password })
    }
    return { error }
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error) trackEvent('signed_in', { email })
    return { error }
  }

  async function signOut() {
    trackEvent('signed_out')
    await supabase.auth.signOut()
    setProfile(null)
    resetUser()
  }

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signUp, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
