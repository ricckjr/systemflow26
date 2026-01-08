export const decodeJwt = (token: string | null | undefined): any | null => {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    return payload
  } catch {
    return null
  }
}

export const isJwtExpired = (token: string | null | undefined): boolean | null => {
  const payload = decodeJwt(token)
  if (!payload || typeof payload.exp !== 'number') return null
  const nowSec = Math.floor(Date.now() / 1000)
  return payload.exp <= nowSec
}
