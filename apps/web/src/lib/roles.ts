'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { api } from '@/lib/api'

export interface MeInfo {
  memberId: string | null
  roleName: string
  name: string | null
  departmentId: string | null
  departmentName?: string | null
}

const ADMIN_ROLES = ['owner', 'admin']

/**
 * Resolve the current member + role via GET /enterprise/{eid}/me.
 * `ready` flips true once the fetch settles (or there's no session) so
 * callers can gate renders without a flash of admin UI.
 */
export function useRole(): { me: MeInfo | null; ready: boolean; isAdmin: boolean } {
  const { token, enterpriseId } = useAuth()
  const [me, setMe] = useState<MeInfo | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!token || !enterpriseId) {
      setMe(null)
      setReady(true)
      return
    }
    setReady(false)
    api
      .get<MeInfo>('/me')
      .then((data) => {
        if (!cancelled) setMe(data)
      })
      .catch(() => {
        if (!cancelled) setMe(null)
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [token, enterpriseId])

  return { me, ready, isAdmin: me ? ADMIN_ROLES.includes(me.roleName) : false }
}
