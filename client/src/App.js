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
    // Token-level streaming (real-time tokens)
    function handleGenerateTokenStream() {
        setLoading(true);
        setLinkedin('');
        setXpost('');
        setLog([]);
        const base = import.meta.env.VITE_API_BASE_URL || '/api';
        const url = `${base}/generate/stream-tokens?prompt=${encodeURIComponent(prompt)}`;
        let attempts = 0;
        const maxAttempts = 5;
        const openStream = () => {
            const es = new EventSource(url);
            es.addEventListener('token', (e) => {
                try {
                    const data = JSON.parse(e.data);
                    if (data.which === 'linkedin')
                        setLinkedin(s => s + data.token);
                    if (data.which === 'x')
                        setXpost(s => s + data.token);
                }
                catch { }
            });
            es.addEventListener('linkedin_done', (e) => { try {
                const d = JSON.parse(e.data);
                setLinkedin(d.text || '');
            }
            catch { } });
            es.addEventListener('x_done', (e) => { try {
                const d = JSON.parse(e.data);
                setXpost(d.text || '');
            }
            catch { } });
            es.addEventListener('done', (e) => { try {
                const d = JSON.parse(e.data);
                setLinkedin(d.linkedin || '');
                setXpost(d.x || '');
            }
            catch { } ; setLoading(false); es.close(); });
            es.addEventListener('error', async (e) => {
                // attempt reconnect with backoff; if max attempts exceeded, fallback to batch fetch
                attempts += 1;
                es.close();
                if (attempts <= maxAttempts) {
                    const backoff = Math.min(30000, 500 * Math.pow(2, attempts));
                    setLog(l => [...l, { step: 'Reconnect', message: `Stream error — reconnecting in ${backoff}ms (attempt ${attempts})`, timestamp: new Date().toISOString() }]);
                    setTimeout(openStream, backoff);
                }
                else {
                    setLog(l => [...l, { step: 'Fallback', message: 'Stream failed repeatedly — fetching final result', timestamp: new Date().toISOString() }]);
                    try {
                        const base2 = import.meta.env.VITE_API_BASE_URL || '/api';
                        const resp = await axios.post(`${base2}/generate`, { prompt });
                        setLinkedin(resp.data.linkedin);
                        setXpost(resp.data.x);
                        setLog(resp.data.log || []);
                    }
                    catch (err) {
                        setLog(l => [...l, { step: 'Error', message: err?.message || String(err), timestamp: new Date().toISOString() }]);
                    }
                    finally {
                        setLoading(false);
                    }
                }
            });
        };
        openStream();
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
    // Simple, safe renderer: escape HTML, convert **bold** to <strong>, preserve line breaks
    function escapeHtml(s) {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function mdBoldToHtml(s) {
        if (!s)
            return '';
        const escaped = escapeHtml(s);
        // Replace **bold** (non-greedy) with strong tags
        const bolded = escaped.replace(/\*\*(.+?)\*\*/gs, '<strong>$1</strong>');
        // Preserve line breaks
        return bolded.replace(/\n/g, '<br/>');
    }
    return (_jsx("div", { className: "min-h-screen p-6", children: _jsxs("div", { className: "max-w-3xl mx-auto", children: [_jsxs("header", { className: "mb-6 flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "w-12 h-12 rounded-full book-cover flex items-center justify-center text-xl font-bold", children: _jsxs("svg", { width: "28", height: "28", viewBox: "0 0 24 24", fill: "none", xmlns: "http://www.w3.org/2000/svg", "aria-hidden": true, children: [_jsx("path", { d: "M3 5h18v14H3z", fill: "#f3e6cf", stroke: "#d6b98a" }), _jsx("path", { d: "M7 8h10v2H7z", fill: "#b28740" })] }) }), _jsxs("div", { children: [_jsx("h1", { className: "text-3xl emboss mb-0", children: "PostAI" }), _jsx("div", { className: "text-sm text-muted", children: "Social post writer" })] })] }), _jsx("div", { className: "text-sm text-muted", children: "v0.1" })] }), _jsxs("div", { className: "mb-4", children: [_jsx("textarea", { value: prompt, onChange: (e) => setPrompt(e.target.value), rows: 4, className: "w-full p-4 vintage-card", placeholder: "Example: Launching a new AI tool for social teams that automates caption writing and post scheduling — focus on productivity, ROI, and a call-to-action." }), _jsxs("div", { className: "mt-3 flex gap-3", children: [_jsxs("button", { onClick: handleGenerateTokenStream, disabled: loading || !prompt, className: "wax-btn-primary glass vignette", "aria-label": "Generate post", children: [_jsx("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", className: "inline-block mr-2", "aria-hidden": true, children: _jsx("path", { d: "M5 12h14M12 5l7 7-7 7", stroke: "#2b1f14", strokeWidth: "1.6", strokeLinecap: "round", strokeLinejoin: "round" }) }), loading ? 'Generating...' : 'Generate'] }), _jsxs("button", { onClick: () => { setPrompt(''); setLinkedin(''); setXpost(''); setLog([]); }, className: "px-4 py-2 bg-white border rounded text-sm", "aria-label": "Reset form", children: [_jsx("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", className: "inline-block mr-2", "aria-hidden": true, children: _jsx("path", { d: "M12 5v0M12 19v0M5 12h0M19 12h0", stroke: "#333", strokeWidth: "1.6", strokeLinecap: "round", strokeLinejoin: "round" }) }), "Reset"] })] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { className: "book-cover p-4", children: [_jsxs("div", { className: "flex justify-between items-start", children: [_jsx("h2", { className: "emboss", children: "LinkedIn Post" }), _jsx("button", { onClick: () => copy(linkedin), className: "text-sm", style: { color: 'var(--brass)' }, "aria-label": "Copy LinkedIn post", children: _jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", "aria-hidden": true, children: [_jsx("path", { d: "M9 12h7v7H9z", stroke: "#b28740", strokeWidth: "1.2" }), _jsx("path", { d: "M7 7h10v10", stroke: "#b28740", strokeWidth: "1.2" })] }) })] }), _jsx("div", { className: "mt-2 text-sm text-gray-800", "aria-live": "polite", children: linkedin ? (_jsx("div", { dangerouslySetInnerHTML: { __html: mdBoldToHtml(linkedin) } })) : _jsx("div", { className: "text-muted", children: "No output yet" }) })] }), _jsxs("div", { className: "book-cover p-4", children: [_jsxs("div", { className: "flex justify-between items-start", children: [_jsx("h2", { className: "emboss", children: "X / Twitter Post" }), _jsx("button", { onClick: () => copy(xpost), className: "text-sm", style: { color: 'var(--brass)' }, "aria-label": "Copy X post", children: _jsx("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", "aria-hidden": true, children: _jsx("path", { d: "M5 12c2 2 4 3 7 3 4 0 7-3 7-8 0-.2 0-.4 0-.6", stroke: "#b28740", strokeWidth: "1.2" }) }) })] }), _jsx("div", { className: "mt-2 text-sm text-gray-800", "aria-live": "polite", children: xpost ? (_jsx("div", { dangerouslySetInnerHTML: { __html: mdBoldToHtml(xpost) } })) : _jsx("div", { className: "text-muted", children: "No output yet" }) })] })] }), _jsxs("div", { className: "mt-4", children: [_jsx("div", { className: "flex justify-between items-center", children: _jsxs("button", { onClick: () => setShowLog(s => !s), className: "text-sm text-muted", children: [showLog ? 'Hide' : 'Show', " Agent Log"] }) }), showLog && (_jsxs("div", { className: "mt-2 parchment-panel max-h-64 overflow-auto text-sm", children: [log.length === 0 && _jsx("div", { className: "text-muted", children: "No log entries" }), log.map((l, i) => (_jsxs("div", { className: "mb-3", children: [_jsxs("div", { className: "font-mono text-xs text-muted", children: ["[", new Date(l.timestamp).toLocaleTimeString(), "] ", l.step] }), _jsx("div", { className: "text-sm", children: l.message })] }, i)))] }))] }), _jsx("footer", { className: "site-footer", children: _jsxs("div", { className: "flex justify-between items-center", children: [_jsxs("div", { children: ["Made by Sarmad \u2014 ", _jsx("span", { className: "emboss", children: "PostAI" })] }), _jsx("div", { className: "text-sm text-muted", children: "API powered by OpenAI" })] }) })] }) }));
}
