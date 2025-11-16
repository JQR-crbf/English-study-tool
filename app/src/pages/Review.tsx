import { useEffect, useMemo, useState } from 'react';

const API_BASE = 'http://localhost:3001';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

export default function ReviewPage() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [date, setDate] = useState<string>(today);
  const [useRange, setUseRange] = useState<boolean>(false);
  const [start, setStart] = useState<string>('');
  const [end, setEnd] = useState<string>('');
  const [words, setWords] = useState<string[]>([]);
  const [encouragement, setEncouragement] = useState<boolean>(true);
  const [messages, setMessages] = useState<ChatMessage[]>([{
    role: 'assistant',
    content: '你好！我是你的英语学习教练。我们来复习今天的词汇吧，我会用简洁的中文解释配合英文例句，并穿插小测验帮你巩固。你可以告诉我想复习的主题，或直接输入“开始”。'
  }]);
  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  async function loadWords() {
    setLoading(true);
    try {
      const qs = useRange && start && end ? `?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&limit=50` : `?date=${encodeURIComponent(date)}&limit=50`;
      const res = await fetch(`${API_BASE}/api/review/words${qs}`);
      const data = await res.json();
      const arr = Array.isArray(data?.words) ? data.words : [];
      setWords(arr);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadWords(); }, [date, useRange, start, end]);

  async function send() {
    const content = input.trim() || '开始';
    const msg: ChatMessage = { role: 'user', content };
    const next = [...messages, msg];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const body: any = { messages: next, encouragement };
      if (useRange && start && end) { body.start = start; body.end = end; } else { body.date = date; }
      const res = await fetch(`${API_BASE}/api/review/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      const reply = String(data?.reply || '抱歉，暂时无法获取回复。');
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '抱歉，暂时无法连接到对话服务。你可以先告诉我今天想复习的词汇或句子。' }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <h1 className="page-title">复习对话</h1>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="grid-2">
          <div>
            <label>日期模式：</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <input type="radio" name="mode" checked={!useRange} onChange={() => setUseRange(false)} /> 单日
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <input type="radio" name="mode" checked={useRange} onChange={() => setUseRange(true)} /> 日期范围
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 12 }}>
                <input type="checkbox" checked={encouragement} onChange={e => setEncouragement(e.target.checked)} /> 鼓励模式
              </label>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            {!useRange ? (
              <>
                <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />
                <button className="btn" onClick={() => { const t = new Date().toISOString().slice(0,10); setDate(t); }}>今天</button>
                <button className="btn" onClick={() => { const d = new Date(); d.setDate(d.getDate() - 1); const y = d.toISOString().slice(0,10); setDate(y); }}>昨天</button>
              </>
            ) : (
              <>
                <input className="input" type="date" value={start} onChange={e => setStart(e.target.value)} placeholder="开始日期" />
                <span>→</span>
                <input className="input" type="date" value={end} onChange={e => setEnd(e.target.value)} placeholder="结束日期" />
              </>
            )}
            <button className="btn" onClick={loadWords} disabled={loading}>{loading ? '加载中…' : '重新加载词汇'}</button>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <div className="muted" style={{ marginBottom: 6 }}>上下文词汇（前50）：</div>
          {words.length === 0 ? (
            <div className="card muted">暂无词汇（该日期暂无条目）。你也可以直接输入“开始”，我会用通用模式引导你复习。</div>
          ) : (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {words.map((w, i) => (<span key={i} className="tag">{w}</span>))}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ minHeight: 280 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.map((m, i) => (
            <div key={i} className="card" style={{ background: 'var(--surface-2)' }}>
              <div style={{ fontWeight: 700 }}>{m.role === 'assistant' ? '教练' : '我'}</div>
              <div style={{ whiteSpace: 'pre-wrap', marginTop: 6 }}>{m.content}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <textarea
            className="input"
            rows={2}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                if (!e.shiftKey) {
                  e.preventDefault();
                  if (!loading) send();
                }
                // Shift+Enter: 保持换行默认行为
              }
            }}
            placeholder="输入你的回答或说“开始”（回车发送，Shift+回车换行）"
            style={{ flex: 1, resize: 'vertical' }}
          />
          <button className="btn btn-primary" onClick={send} disabled={loading}>{loading ? '发送中…' : '发送'}</button>
        </div>
      </div>
    </div>
  );
}