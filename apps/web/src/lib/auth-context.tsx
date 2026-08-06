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
import { API_BASE } from './config'

const TOKEN_KEY = 'opentelecrm.token'
const EID_KEY = 'opentelecrm.enterpriseId'

interface AuthState {
  token: string | null
  enterpriseId: string | null
  /** True once localStorage has been hydrated on mount. */
  isReady: boolean
  login: (enterpriseId: string, secret: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [enterpriseId, setEnterpriseId] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)

  // Hydrate from localStorage on mount.
  useEffect(() => {
    try {
      const t = localStorage.getItem(TOKEN_KEY)
      const e = localStorage.getItem(EID_KEY)
      if (t && e) {
        setToken(t)
        setEnterpriseId(e)
        setApiCtx({ token: t, enterpriseId: e })
      }
    } catch {
      // localStorage unavailable (private mode etc) — stay logged out.
    }
    setIsReady(true)
  }, [])

  const login = useCallback(async (eid: string, secret: string) => {
    let finalToken = secret.trim()
    if (!finalToken || !eid.trim()) {
      throw new Error('Enterprise ID and secret/token are required')
    }

    // Dev shortcut: if the secret already looks like a JWT
    // (three dot-separated segments), use it directly as the Bearer token.
    const segments = finalToken.split('.')
    if (segments.length !== 3) {
      // Otherwise exchange the enterprise secret for a sync token.
      const res = await fetch(`${API_BASE}/enterprise/${eid.trim()}/api-tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: finalToken }),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(
          `API token creation failed (${res.status})${text ? `: ${text.slice(0, 200)}` : ''}`,
        )
      }
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
      finalToken =
        (data.token as string) ??
        (data.apiToken as string) ??
        (data.syncToken as string) ??
        (data.accessToken as string)
      if (!finalToken) throw new Error('No token in API response')
    }

    setToken(finalToken)
    setEnterpriseId(eid.trim())
    setApiCtx({ token: finalToken, enterpriseId: eid.trim() })
    try {
      localStorage.setItem(TOKEN_KEY, finalToken)
      localStorage.setItem(EID_KEY, eid.trim())
    } catch {
      // non-fatal
    }
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setEnterpriseId(null)
    try {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(EID_KEY)
    } catch {
      // non-fatal
    }
  }, [])

  const value = useMemo<AuthState>(
    () => ({ token, enterpriseId, isReady, login, logout }),
    [token, enterpriseId, isReady, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
