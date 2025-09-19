import React, { useState } from 'react'
import axios from 'axios'

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

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">PostAI — Social Post Generator</h1>

        <div className="mb-4">
          <textarea value={prompt} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPrompt(e.target.value)} rows={4}
            className="w-full p-3 border rounded" placeholder={"Example: Launching a new AI tool for social teams that automates caption writing and post scheduling — focus on productivity, ROI, and a call-to-action."} />
          <div className="mt-2 flex gap-2">
            <button onClick={handleGenerate} disabled={loading || !prompt}
              className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50">{loading? 'Generating...' : 'Generate'}</button>
            <button onClick={handleGenerateStream} disabled={loading || !prompt}
              className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50">Stream</button>
            <button onClick={()=>{ setPrompt(''); setLinkedin(''); setXpost(''); setLog([]) }}
              className="px-4 py-2 bg-gray-200 rounded">Reset</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded shadow">
            <div className="flex justify-between items-start">
              <h2 className="font-semibold">LinkedIn Post</h2>
              <button onClick={()=>copy(linkedin)} className="text-sm text-blue-600">Copy</button>
            </div>
            <div className="mt-2 whitespace-pre-wrap text-sm text-gray-800">{linkedin || 'No output yet'}</div>
          </div>

          <div className="bg-white p-4 rounded shadow">
            <div className="flex justify-between items-start">
              <h2 className="font-semibold">X / Twitter Post</h2>
              <button onClick={()=>copy(xpost)} className="text-sm text-blue-600">Copy</button>
            </div>
            <div className="mt-2 whitespace-pre-wrap text-sm text-gray-800">{xpost || 'No output yet'}</div>
          </div>
        </div>

        <div className="mt-4">
          <button onClick={()=>setShowLog(s=>!s)} className="text-sm text-gray-700">{showLog? 'Hide' : 'Show'} Agent Log</button>
          {showLog && (
            <div className="mt-2 bg-white p-3 rounded shadow max-h-64 overflow-auto text-xs">
              {log.length===0 && <div className="text-gray-500">No log entries</div>}
              {log.map((l, i)=>(
                <div key={i} className="mb-2">
                  <div className="font-mono text-xs text-gray-600">[{new Date(l.timestamp).toLocaleTimeString()}] {l.step}</div>
                  <div className="text-sm">{l.message}</div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
