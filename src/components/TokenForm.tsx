const CLIENT_ID = import.meta.env.VITE_FIGMA_CLIENT_ID as string
const REDIRECT_URI = import.meta.env.VITE_FIGMA_REDIRECT_URI ?? 'http://localhost:5173/oauth/callback'

export function LoginScreen() {
  function handleOAuth() {
    const state = crypto.randomUUID()
    sessionStorage.setItem('oauth_state', state)

    const url = new URL('https://www.figma.com/oauth')
    url.searchParams.set('client_id', CLIENT_ID)
    url.searchParams.set('redirect_uri', REDIRECT_URI)
    url.searchParams.set('scope', 'current_user:read,file_content:read,file_metadata:read,projects:read')
    url.searchParams.set('state', state)
    url.searchParams.set('response_type', 'code')

    window.location.href = url.toString()
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-violet-600/20 border border-violet-500/30 mx-auto">
          <svg className="w-7 h-7 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" />
          </svg>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-slate-100">Watchtower</h1>
          <p className="text-slate-500 text-sm mt-1">Figma Branch RAM İzleme Paneli</p>
        </div>

        <button
          onClick={handleOAuth}
          className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-lg bg-[#1e1e1e] border border-slate-700 hover:border-slate-500 text-slate-100 font-medium transition-colors"
        >
          <FigmaIcon />
          Figma ile Giriş Yap
        </button>

        <p className="text-xs text-slate-600">
          Yalnızca okuma izni istenir. Token tarayıcınızda tutulur.
        </p>
      </div>
    </div>
  )
}

function FigmaIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 38 57" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M19 28.5C19 25.9804 20.0009 23.5641 21.7825 21.7825C23.5641 20.0009 25.9804 19 28.5 19C31.0196 19 33.4359 20.0009 35.2175 21.7825C36.9991 23.5641 38 25.9804 38 28.5C38 31.0196 36.9991 33.4359 35.2175 35.2175C33.4359 36.9991 31.0196 38 28.5 38C25.9804 38 23.5641 36.9991 21.7825 35.2175C20.0009 33.4359 19 31.0196 19 28.5Z" fill="#1ABCFE"/>
      <path d="M0 47.5C0 44.9804 1.00089 42.5641 2.78249 40.7825C4.56408 39.0009 6.98044 38 9.5 38H19V47.5C19 50.0196 17.9991 52.4359 16.2175 54.2175C14.4359 55.9991 12.0196 57 9.5 57C6.98044 57 4.56408 55.9991 2.78249 54.2175C1.00089 52.4359 0 50.0196 0 47.5Z" fill="#0ACF83"/>
      <path d="M19 0V19H28.5C31.0196 19 33.4359 17.9991 35.2175 16.2175C36.9991 14.4359 38 12.0196 38 9.5C38 6.98044 36.9991 4.56408 35.2175 2.78249C33.4359 1.00089 31.0196 0 28.5 0H19Z" fill="#FF7262"/>
      <path d="M0 9.5C0 12.0196 1.00089 14.4359 2.78249 16.2175C4.56408 17.9991 6.98044 19 9.5 19H19V0H9.5C6.98044 0 4.56408 1.00089 2.78249 2.78249C1.00089 4.56408 0 6.98044 0 9.5Z" fill="#F24E1E"/>
      <path d="M0 28.5C0 31.0196 1.00089 33.4359 2.78249 35.2175C4.56408 36.9991 6.98044 38 9.5 38H19V19H9.5C6.98044 19 4.56408 20.0009 2.78249 21.7825C1.00089 23.5641 0 25.9804 0 28.5Z" fill="#A259FF"/>
    </svg>
  )
}
