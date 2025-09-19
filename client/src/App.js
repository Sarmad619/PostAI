import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import axios from 'axios';
export default function App() {
    const [prompt, setPrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const [linkedin, setLinkedin] = useState('');
    const [xpost, setXpost] = useState('');
    const [log, setLog] = useState([]);
    const [showLog, setShowLog] = useState(false);
    async function handleGenerate() {
        setLoading(true);
        setLinkedin('');
        setXpost('');
        setLog([]);
        try {
            const base = import.meta.env.VITE_API_BASE_URL || '/api';
            const resp = await axios.post(`${base}/generate`, { prompt });
            setLinkedin(resp.data.linkedin);
            setXpost(resp.data.x);
            setLog(resp.data.log || []);
            setShowLog(true);
        }
        catch (err) {
            setLog([{ step: 'Error', message: err?.message || String(err), timestamp: new Date().toISOString() }]);
            setShowLog(true);
        }
        finally {
            setLoading(false);
        }
    }
    // Start SSE streaming generation
    function handleGenerateStream() {
        setLoading(true);
        setLinkedin('');
        setXpost('');
        setLog([]);
        const base = import.meta.env.VITE_API_BASE_URL || '/api';
        const url = `${base}/generate/stream?prompt=${encodeURIComponent(prompt)}`;
        const es = new EventSource(url);
        es.addEventListener('log', (e) => {
            try {
                const data = JSON.parse(e.data);
                setLog(l => [...l, data]);
            }
            catch { }
        });
        es.addEventListener('linkedin', (e) => {
            try {
                const d = JSON.parse(e.data);
                setLinkedin(d.text);
            }
            catch { }
        });
        es.addEventListener('x', (e) => {
            try {
                const d = JSON.parse(e.data);
                setXpost(d.text);
            }
            catch { }
        });
        es.addEventListener('done', (e) => {
            try {
                const d = JSON.parse(e.data);
                setLinkedin(d.linkedin || '');
                setXpost(d.x || '');
            }
            catch { }
            setLoading(false);
            es.close();
        });
        es.addEventListener('error', (e) => {
            try {
                const d = JSON.parse(e.data);
                setLog(l => [...l, { step: 'Error', message: d.message, timestamp: new Date().toISOString() }]);
            }
            catch { }
            setLoading(false);
            es.close();
        });
    }
    const copy = async (text) => {
        try {
            await navigator.clipboard.writeText(text);
        }
        catch {
            const el = document.createElement('textarea');
            el.value = text;
            document.body.appendChild(el);
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);
        }
    };
    return (_jsx("div", { className: "min-h-screen bg-gray-50 p-6", children: _jsxs("div", { className: "max-w-3xl mx-auto", children: [_jsx("h1", { className: "text-3xl font-bold mb-4", children: "PostAI \u2014 Social Post Generator" }), _jsxs("div", { className: "mb-4", children: [_jsx("textarea", { value: prompt, onChange: (e) => setPrompt(e.target.value), rows: 4, className: "w-full p-3 border rounded", placeholder: "Example: Launching a new AI tool for social teams that automates caption writing and post scheduling — focus on productivity, ROI, and a call-to-action." }), _jsxs("div", { className: "mt-2 flex gap-2", children: [_jsx("button", { onClick: handleGenerate, disabled: loading || !prompt, className: "px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50", children: loading ? 'Generating...' : 'Generate' }), _jsx("button", { onClick: handleGenerateStream, disabled: loading || !prompt, className: "px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50", children: "Stream" }), _jsx("button", { onClick: () => { setPrompt(''); setLinkedin(''); setXpost(''); setLog([]); }, className: "px-4 py-2 bg-gray-200 rounded", children: "Reset" })] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { className: "bg-white p-4 rounded shadow", children: [_jsxs("div", { className: "flex justify-between items-start", children: [_jsx("h2", { className: "font-semibold", children: "LinkedIn Post" }), _jsx("button", { onClick: () => copy(linkedin), className: "text-sm text-blue-600", children: "Copy" })] }), _jsx("div", { className: "mt-2 whitespace-pre-wrap text-sm text-gray-800", children: linkedin || 'No output yet' })] }), _jsxs("div", { className: "bg-white p-4 rounded shadow", children: [_jsxs("div", { className: "flex justify-between items-start", children: [_jsx("h2", { className: "font-semibold", children: "X / Twitter Post" }), _jsx("button", { onClick: () => copy(xpost), className: "text-sm text-blue-600", children: "Copy" })] }), _jsx("div", { className: "mt-2 whitespace-pre-wrap text-sm text-gray-800", children: xpost || 'No output yet' })] })] }), _jsxs("div", { className: "mt-4", children: [_jsxs("button", { onClick: () => setShowLog(s => !s), className: "text-sm text-gray-700", children: [showLog ? 'Hide' : 'Show', " Agent Log"] }), showLog && (_jsxs("div", { className: "mt-2 bg-white p-3 rounded shadow max-h-64 overflow-auto text-xs", children: [log.length === 0 && _jsx("div", { className: "text-gray-500", children: "No log entries" }), log.map((l, i) => (_jsxs("div", { className: "mb-2", children: [_jsxs("div", { className: "font-mono text-xs text-gray-600", children: ["[", new Date(l.timestamp).toLocaleTimeString(), "] ", l.step] }), _jsx("div", { className: "text-sm", children: l.message })] }, i)))] }))] })] }) }));
}
