'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { setApiCtx } from './api'
import { getApiBase } from './config'

const TOKEN_KEY = 'opentelecrm.token'
const EID_KEY = 'opentelecrm.enterpriseId'
const ROLE_KEY = 'opentelecrm.userRole'

export type UserRole = 'admin' | 'agent'

interface AuthState {
  token: string | null
  enterpriseId: string | null
  userRole: UserRole
  isAdmin: boolean
  isAgent: boolean
  /** True once localStorage has been hydrated on mount. */
  isReady: boolean
  login: (enterpriseId: string, secret: string, role?: UserRole) => Promise<void>
  setRole: (role: UserRole) => void
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [enterpriseId, setEnterpriseId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<UserRole>('admin')
  const [isReady, setIsReady] = useState(false)

  // Hydrate from localStorage on mount.
  useEffect(() => {
    try {
      const t = localStorage.getItem(TOKEN_KEY)
      const e = localStorage.getItem(EID_KEY)
      const r = localStorage.getItem(ROLE_KEY) as UserRole | null
      if (t && e) {
        setToken(t)
        setEnterpriseId(e)
        if (r === 'admin' || r === 'agent') {
          setUserRole(r)
        }
        setApiCtx({ token: t, enterpriseId: e })
      }
    } catch {
      // localStorage unavailable (private mode etc) — stay logged out.
    }
    setIsReady(true)
  }, [])

  const setRole = useCallback((role: UserRole) => {
    setUserRole(role)
    try {
      localStorage.setItem(ROLE_KEY, role)
    } catch {
      // ignore
    }
  }, [])

  const login = useCallback(async (eid: string, secret: string, role: UserRole = 'admin') => {
    let finalToken = secret.trim()
    if (!finalToken || !eid.trim()) {
      throw new Error('Enterprise ID and secret/token are required')
    }

    // Dev shortcut: if the secret looks like a JWT or dev token
    const segments = finalToken.split('.')
    if (segments.length !== 3) {
      // Otherwise exchange the enterprise secret for a sync token if backend available.
      try {
        const res = await fetch(`${getApiBase()}/enterprise/${eid.trim()}/auth/exchange`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secret: finalToken }),
        })
        if (res.ok) {
          const body = (await res.json()) as { token?: string }
          if (body.token) finalToken = body.token
        }
      } catch {
        // Dev fallback
      }
    }

    try {
      localStorage.setItem(TOKEN_KEY, finalToken)
      localStorage.setItem(EID_KEY, eid.trim())
      localStorage.setItem(ROLE_KEY, role)
    } catch {
      // ignore
    }

    setToken(finalToken)
    setEnterpriseId(eid.trim())
    setUserRole(role)
    setApiCtx({ token: finalToken, enterpriseId: eid.trim() })
  }, [])

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(EID_KEY)
      localStorage.removeItem(ROLE_KEY)
    } catch {
      // ignore
    }
    setToken(null)
    setEnterpriseId(null)
    setUserRole('admin')
    setApiCtx(null)
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      token,
      enterpriseId,
      userRole,
      isAdmin: userRole === 'admin',
      isAgent: userRole === 'agent',
      isReady,
      login,
      setRole,
      logout,
    }),
    [token, enterpriseId, userRole, isReady, login, setRole, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an <AuthProvider>')
  }
  return ctx
}
