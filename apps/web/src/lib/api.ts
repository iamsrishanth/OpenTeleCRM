'use client'

import { getApiBase } from './config'

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`API ${status}`)
  }
}

interface ApiClientCtx {
  token: string
  enterpriseId: string
}

let _ctx: ApiClientCtx | null = null
let _listeners: Array<(() => void) | null> = []

/** Call once after login/dev-jwt is obtained. */
export function setApiCtx(ctx: ApiClientCtx) {
  _ctx = ctx
  for (const cb of _listeners) {
    cb?.()
  }
  _listeners = []
}

export function getApiCtx(): ApiClientCtx | null {
  return _ctx
}

export function onApiReady(cb: () => void) {
  if (_ctx) return cb()
  _listeners.push(cb)
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const ctx = _ctx
  if (!ctx) throw new ApiError(401, { error: 'not authenticated' })
  const url = `${getApiBase()}/enterprise/${ctx.enterpriseId}${path}`
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${ctx.token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text()
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = text
    }
    throw new ApiError(res.status, parsed)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
}