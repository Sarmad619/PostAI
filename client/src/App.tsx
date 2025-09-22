import React, { useState } from 'react'
import axios from 'axios'
import Logo from './assets/logo.svg'

type LogEntry = { step: string; message: string; timestamp: string }

export default function App() {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [linkedin, setLinkedin] = useState('')
  const [xpost, setXpost] = useState('')
  const [log, setLog] = useState<LogEntry[]>([])
  const [showLog, setShowLog] = useState(false)

  async function handleGenerate() {
    setLoading(true)
    setLinkedin('')
    setXpost('')
    setLog([])
    try {
      const base = (import.meta.env.VITE_API_BASE_URL as string) || '/api'
      const resp = await axios.post(`${base}/generate`, { prompt })
      setLinkedin(resp.data.linkedin)
      setXpost(resp.data.x)
      setLog(resp.data.log || [])
      setShowLog(true)
    } catch (err: any) {
      setLog([{ step: 'Error', message: err?.message || String(err), timestamp: new Date().toISOString() }])
      setShowLog(true)
    } finally {
      setLoading(false)
    }
  }

  // Start SSE streaming generation
  function handleGenerateStream() {
    setLoading(true)
    setLinkedin('')
    setXpost('')
    setLog([])

    const base = (import.meta.env.VITE_API_BASE_URL as string) || '/api'
    const url = `${base}/generate/stream?prompt=${encodeURIComponent(prompt)}`
    const es = new EventSource(url)

    es.addEventListener('log', (e: any) => {
      try {
        const data = JSON.parse(e.data)
        setLog(l=>[...l, data])
      } catch {}
    })
    es.addEventListener('linkedin', (e: any) => {
      try { const d = JSON.parse(e.data); setLinkedin(d.text) } catch {}
    })
    es.addEventListener('x', (e: any) => {
      try { const d = JSON.parse(e.data); setXpost(d.text) } catch {}
    })
    es.addEventListener('done', (e: any) => {
      try { const d = JSON.parse(e.data); setLinkedin(d.linkedin || ''); setXpost(d.x || '') } catch {}
      setLoading(false)
      es.close()
    })
    es.addEventListener('error', (e: any) => {
      try { const d = JSON.parse(e.data) ; setLog(l=>[...l, { step: 'Error', message: d.message, timestamp: new Date().toISOString() }]) } catch {}
      setLoading(false)
      es.close()
    })
  }

  // Token-level streaming (real-time tokens)
  function handleGenerateTokenStream() {
    setLoading(true)
    setLinkedin('')
    setXpost('')
    setLog([])
    const base = (import.meta.env.VITE_API_BASE_URL as string) || '/api'
    const url = `${base}/generate/stream-tokens?prompt=${encodeURIComponent(prompt)}`

    let attempts = 0
    const maxAttempts = 5

    const openStream = () => {
      const es = new EventSource(url)

      es.addEventListener('token', (e: any) => {
        try {
          const data = JSON.parse(e.data)
          if (data.which === 'linkedin') setLinkedin(s=>s+data.token)
          if (data.which === 'x') setXpost(s=>s+data.token)
        } catch {}
      })
      es.addEventListener('linkedin_done', (e: any) => { try { const d = JSON.parse(e.data); setLinkedin(d.text || '') } catch {} })
      es.addEventListener('x_done', (e: any) => { try { const d = JSON.parse(e.data); setXpost(d.text || '') } catch {} })
      es.addEventListener('done', (e: any) => { try { const d = JSON.parse(e.data); setLinkedin(d.linkedin || ''); setXpost(d.x || '') } catch {} ; setLoading(false); es.close() })
      es.addEventListener('error', async (e: any) => {
        // attempt reconnect with backoff; if max attempts exceeded, fallback to batch fetch
        attempts += 1
        es.close()
        if (attempts <= maxAttempts) {
          const backoff = Math.min(30000, 500 * Math.pow(2, attempts))
          setLog(l=>[...l, { step: 'Reconnect', message: `Stream error — reconnecting in ${backoff}ms (attempt ${attempts})`, timestamp: new Date().toISOString() }])
          setTimeout(openStream, backoff)
        } else {
          setLog(l=>[...l, { step: 'Fallback', message: 'Stream failed repeatedly — fetching final result', timestamp: new Date().toISOString() }])
          try {
            const base2 = (import.meta.env.VITE_API_BASE_URL as string) || '/api'
            const resp = await axios.post(`${base2}/generate`, { prompt })
            setLinkedin(resp.data.linkedin)
            setXpost(resp.data.x)
            setLog(resp.data.log || [])
          } catch (err: any) {
            setLog(l=>[...l, { step: 'Error', message: err?.message || String(err), timestamp: new Date().toISOString() }])
          } finally {
            setLoading(false)
          }
        }
      })
    }

    openStream()
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
  }

  // Simple, safe renderer: escape HTML, convert **bold** to <strong>, preserve line breaks
  function escapeHtml(s: string) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function mdBoldToHtml(s: string) {
    if (!s) return '';
    const escaped = escapeHtml(s);
    // Replace **bold** (non-greedy) with strong tags
    const bolded = escaped.replace(/\*\*(.+?)\*\*/gs, '<strong>$1</strong>');
    // Preserve line breaks
    return bolded.replace(/\n/g, '<br/>');
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-3xl mx-auto">
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full book-cover flex items-center justify-center text-xl font-bold">
                <img src={Logo} alt="PostAI" width={28} height={28} />
              </div>
            <div>
              <h1 className="text-3xl emboss mb-0">PostAI</h1>
              <div className="text-sm text-muted">Social post writer</div>
            </div>
          </div>
          <div className="text-sm text-muted">v0.1</div>
        </header>

        <div className="mb-4">
          <textarea value={prompt} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPrompt(e.target.value)} rows={4}
            className="w-full p-4 vintage-card" placeholder={"Example: Launching a new AI tool for social teams that automates caption writing and post scheduling — focus on productivity, ROI, and a call-to-action."} />
          <div className="mt-3 flex gap-3">
            <button onClick={handleGenerateTokenStream} disabled={loading || !prompt}
              className="wax-btn-primary glass vignette" aria-label="Generate post">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="inline-block mr-2" aria-hidden><path d="M5 12h14M12 5l7 7-7 7" stroke="#2b1f14" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                {loading? 'Generating...' : 'Generate'}
            </button>
            <button onClick={()=>{ setPrompt(''); setLinkedin(''); setXpost(''); setLog([]) }}
              className="px-4 py-2 bg-white border rounded text-sm" aria-label="Reset form">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="inline-block mr-2" aria-hidden><path d="M12 5v0M12 19v0M5 12h0M19 12h0" stroke="#333" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Reset
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="book-cover p-4">
            <div className="flex justify-between items-start">
              <h2 className="emboss">LinkedIn Post</h2>
              <button onClick={()=>copy(linkedin)} className="text-sm" style={{color:'var(--brass)'}} aria-label="Copy LinkedIn post">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M9 12h7v7H9z" stroke="#b28740" strokeWidth="1.2"/><path d="M7 7h10v10" stroke="#b28740" strokeWidth="1.2"/></svg>
              </button>
            </div>
            <div className="mt-2 text-sm text-gray-800" aria-live="polite">
              {linkedin ? (
                <div dangerouslySetInnerHTML={{ __html: mdBoldToHtml(linkedin) }} />
              ) : <div className="text-muted">No output yet</div>}
            </div>
          </div>

          <div className="book-cover p-4">
            <div className="flex justify-between items-start">
              <h2 className="emboss">X / Twitter Post</h2>
              <button onClick={()=>copy(xpost)} className="text-sm" style={{color:'var(--brass)'}} aria-label="Copy X post">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M5 12c2 2 4 3 7 3 4 0 7-3 7-8 0-.2 0-.4 0-.6" stroke="#b28740" strokeWidth="1.2"/></svg>
              </button>
            </div>
            <div className="mt-2 text-sm text-gray-800" aria-live="polite">
              {xpost ? (
                <div dangerouslySetInnerHTML={{ __html: mdBoldToHtml(xpost) }} />
              ) : <div className="text-muted">No output yet</div>}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex justify-between items-center">
            <button onClick={()=>setShowLog(s=>!s)} className="text-sm text-muted">{showLog? 'Hide' : 'Show'} Agent Log</button>
          </div>
          {showLog && (
            <div className="mt-2 parchment-panel max-h-64 overflow-auto text-sm">
              {log.length===0 && <div className="text-muted">No log entries</div>}
              {log.map((l, i)=>(
                <div key={i} className="mb-3">
                  <div className="font-mono text-xs text-muted">[{new Date(l.timestamp).toLocaleTimeString()}] {l.step}</div>
                  <div className="text-sm">{l.message}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <footer className="site-footer">
          <div className="flex justify-between items-center">
            <div>Made by Sarmad — <span className="emboss">PostAI</span></div>
            <div className="text-sm text-muted">API powered by OpenAI</div>
          </div>
        </footer>

      </div>
    </div>
  )
}
