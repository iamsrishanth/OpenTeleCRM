'use client'

import { useEffect, useState } from 'react'
import { useAuth, type UserRole } from '@/lib/auth-context'
import { api } from '@/lib/api'

export interface MeInfo {
  memberId: string | null
  roleName: string
  name: string | null
  departmentId: string | null
  departmentName?: string | null
}

const ADMIN_ROLES = ['owner', 'admin', 'manager']

/**
 * Resolve the current member + role.
 */
export function useRole(): {
  me: MeInfo | null
  ready: boolean
  isAdmin: boolean
  isAgent: boolean
  userRole: UserRole
} {
  const { token, enterpriseId, userRole } = useAuth()
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

  const isAdmin = userRole === 'admin' || (me ? ADMIN_ROLES.includes(me.roleName.toLowerCase()) : false)
  const isAgent = userRole === 'agent'

  return { me, ready, isAdmin, isAgent, userRole }
}
