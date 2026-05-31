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
    try {
      // Race against a 7s timeout so a hung network request never blocks the app
      const fetcher = Promise.all([
        supabase.auth.getUser(),
        supabase.from('profiles').select('*').eq('id', userId).single(),
      ])
      const timer = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('profile_timeout')), 7000)
      )
      const [{ data: authData }, { data }] = await Promise.race([fetcher, timer])
      if (data) {
        const isVerified = !!authData?.user?.email_confirmed_at
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
    } catch {
      // silently fail — profile load errors shouldn't crash the app
    }
  }

  async function refreshProfile() {
    if (user) await loadProfile(user.id, user.email ?? undefined)
  }

  useEffect(() => {
    // Hard safety net — never show the loading spinner for more than 10s on any device
    const safetyTimer = setTimeout(() => setLoading(false), 10000)

    // Check localStorage for a stored session.
    // Wrapped in try/catch: some Android browsers (restrictive WebViews, Samsung Internet
    // in certain modes) throw a SecurityError on localStorage access.
    let hasStoredSession = false
    try {
      hasStoredSession = Object.keys(localStorage).some(k => k.includes('-auth-token'))
    } catch {}

    if (!hasStoredSession) {
      // No stored session — no point waiting, show auth form immediately
      setLoading(false)
    }

    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        setSession(session)
        setUser(session?.user ?? null)
        // loadProfile has its own 7s internal timeout, but we keep safetyTimer alive
        // until the ENTIRE flow finishes — clearing it early was the bug causing
        // infinite loading when loadProfile hung on slow/Samsung Internet connections
        if (session?.user) await loadProfile(session.user.id, session.user.email ?? undefined)
        clearTimeout(safetyTimer)
        setLoading(false)
      })
      .catch(() => {
        // Network failure — clear spinner and show auth form
        clearTimeout(safetyTimer)
        setLoading(false)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) await loadProfile(session.user.id, session.user.email ?? undefined)
      else setProfile(null)
      setLoading(false)
    })

    return () => { subscription.unsubscribe(); clearTimeout(safetyTimer) }
  }, [])

  async function signUp(email: string, password: string, username: string, fullName: string) {
    // Check username not already taken
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle()

    if (existing) {
      return { error: { message: 'That username is already taken. Please choose another.' } }
    }

    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })

    if (error) return { error }

    if (data.user) {
      // Update profile with chosen username and full name
      await supabase
        .from('profiles')
        .update({ username, full_name: fullName })
        .eq('id', data.user.id)

      trackEvent('signed_up', { username, email })

      // Try to auto sign in — works when email confirmation is disabled
      // Silently ignore error if confirmation is required
      await supabase.auth.signInWithPassword({ email, password }).catch(() => null)
    }

    return { error: null }
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
