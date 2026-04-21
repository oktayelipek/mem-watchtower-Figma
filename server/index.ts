import 'dotenv/config'
import express from 'express'
import cors from 'cors'

const app = express()
app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173' }))
app.use(express.json())

const TOKEN_URLS = [
  'https://api.figma.com/v1/oauth/token',
  'https://www.figma.com/api/oauth/token',
]

app.post('/api/oauth/token', async (req, res) => {
  const { code } = req.body as { code?: string }
  if (!code) {
    res.status(400).json({ error: 'Missing code' })
    return
  }

  const clientId = process.env.FIGMA_CLIENT_ID
  const clientSecret = process.env.FIGMA_CLIENT_SECRET
  const redirectUri = process.env.FIGMA_REDIRECT_URI ?? 'http://localhost:5173/oauth/callback'

  if (!clientId || !clientSecret) {
    res.status(500).json({ error: 'FIGMA_CLIENT_ID veya FIGMA_CLIENT_SECRET eksik' })
    return
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
    grant_type: 'authorization_code',
  })

  // Basic Auth header (some OAuth servers require this)
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  for (const url of TOKEN_URLS) {
    console.log(`Trying token endpoint: ${url}`)

    const figmaRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: body.toString(),
    })

    const rawText = await figmaRes.text()
    console.log(`→ ${figmaRes.status}: ${rawText.slice(0, 300)}`)

    if (figmaRes.status === 404) continue  // try next URL

    let data: Record<string, string> = {}
    try {
      data = JSON.parse(rawText)
    } catch {
      res.status(502).json({ error: `Figma API hatası (${figmaRes.status}): ${rawText}` })
      return
    }

    if (!figmaRes.ok) {
      res.status(400).json({ error: data.error_description ?? data.error ?? `HTTP ${figmaRes.status}` })
      return
    }

    res.json({ access_token: data.access_token })
    return
  }

  res.status(502).json({ error: 'Figma token endpoint bulunamadı. Lütfen konsolу kontrol et.' })
})

app.get('/api/debug/branches/:fileKey', async (req, res) => {
  const token = req.headers['x-figma-token'] as string
  if (!token) { res.status(400).json({ error: 'x-figma-token header missing' }); return }

  const { fileKey } = req.params
  const url = `https://api.figma.com/v1/files/${fileKey}/branches`
  console.log(`DEBUG branches: GET ${url}`)

  const figmaRes = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` },
  })
  const text = await figmaRes.text()
  console.log(`DEBUG branches response ${figmaRes.status}:`, text.slice(0, 500))
  res.status(figmaRes.status).send(text)
})

const port = Number(process.env.PORT ?? 3001)
app.listen(port, () => console.log(`OAuth server: http://localhost:${port}`))
