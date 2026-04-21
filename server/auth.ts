import { db } from './db/index.js'
import { oauthTokens } from './db/schema.js'
import { desc } from 'drizzle-orm'

const TOKEN_URLS = [
  'https://api.figma.com/v1/oauth/token',
  'https://www.figma.com/api/oauth/token',
]

interface FigmaTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in?: number
  error?: string
  error_description?: string
}

async function exchangeOrRefresh(body: URLSearchParams): Promise<FigmaTokenResponse> {
  const clientId = process.env.FIGMA_CLIENT_ID!
  const clientSecret = process.env.FIGMA_CLIENT_SECRET!
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  for (const url of TOKEN_URLS) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: body.toString(),
    })
    const raw = await res.text()
    if (res.status === 404) continue
    try {
      return JSON.parse(raw) as FigmaTokenResponse
    } catch {
      throw new Error(`Figma returned non-JSON (${res.status}): ${raw}`)
    }
  }
  throw new Error('No Figma token endpoint responded successfully.')
}

export async function exchangeCode(code: string): Promise<void> {
  const redirectUri = process.env.FIGMA_REDIRECT_URI!
  const body = new URLSearchParams({
    client_id: process.env.FIGMA_CLIENT_ID!,
    client_secret: process.env.FIGMA_CLIENT_SECRET!,
    redirect_uri: redirectUri,
    code,
    grant_type: 'authorization_code',
  })

  const data = await exchangeOrRefresh(body)
  if (!data.access_token) throw new Error(data.error_description ?? data.error ?? 'No access_token in response')

  await storeToken(data)
}

async function storeToken(data: FigmaTokenResponse): Promise<void> {
  const expiresAt = data.expires_in
    ? Date.now() + data.expires_in * 1000
    : Date.now() + 90 * 24 * 60 * 60 * 1000 // fallback: 90 days

  await db.insert(oauthTokens).values({
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt,
    updatedAt: Date.now(),
  })
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const body = new URLSearchParams({
    client_id: process.env.FIGMA_CLIENT_ID!,
    client_secret: process.env.FIGMA_CLIENT_SECRET!,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  })

  const data = await exchangeOrRefresh(body)
  if (!data.access_token) throw new Error(data.error_description ?? 'Token refresh failed')

  // Preserve the existing refresh_token if not returned
  await storeToken({ ...data, refresh_token: data.refresh_token ?? refreshToken })
  return data.access_token
}

export async function getValidToken(): Promise<string> {
  const [latest] = await db
    .select()
    .from(oauthTokens)
    .orderBy(desc(oauthTokens.id))
    .limit(1)

  if (!latest) throw new Error('NOT_CONNECTED')

  // If token expires within 10 minutes, refresh it
  if (latest.expiresAt < Date.now() + 10 * 60 * 1000) {
    if (!latest.refreshToken) throw new Error('TOKEN_EXPIRED_NO_REFRESH')
    return refreshAccessToken(latest.refreshToken)
  }

  return latest.accessToken
}

export async function isConnected(): Promise<boolean> {
  try {
    await getValidToken()
    return true
  } catch {
    return false
  }
}
