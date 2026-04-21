import { useEffect, useRef, useState } from 'react'

interface OAuthCallbackProps {
  onSuccess: (token: string) => void
  onError: (msg: string) => void
}

export function OAuthCallback({ onSuccess, onError }: OAuthCallbackProps) {
  const [status, setStatus] = useState('Figma ile bağlantı kuruluyor…')
  const called = useRef(false)

  useEffect(() => {
    // Prevent double-execution in React StrictMode
    if (called.current) return
    called.current = true

    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const error = params.get('error')

    if (error) {
      onError(`Figma yetkilendirme hatası: ${error}`)
      return
    }

    if (!code) {
      onError('Geçersiz callback — kod bulunamadı.')
      return
    }

    setStatus('Token alınıyor…')

    fetch('/api/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
      .then((r) => r.json())
      .then((data: { access_token?: string; error?: string }) => {
        if (data.error) throw new Error(data.error)
        if (!data.access_token) throw new Error('Token alınamadı.')
        window.history.replaceState({}, '', '/')
        onSuccess(data.access_token)
      })
      .catch((err: Error) => onError(err.message))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="animate-spin w-10 h-10 border-2 border-slate-700 border-t-violet-500 rounded-full mx-auto" />
        <p className="text-slate-400 text-sm">{status}</p>
      </div>
    </div>
  )
}
