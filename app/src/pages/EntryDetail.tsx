import { useEffect, useMemo, useRef, useState } from 'react'
import { marked } from 'marked'
import { useNavigate, useParams } from 'react-router-dom'

const API_BASE = 'http://localhost:3001';

type Entry = {
  id: number
  date: string
  created_at: string
  source_type?: string | null
  source_image_path?: string | null
  original_text: string
  translated_text: string
  tokens?: string[] | null
  tags?: string[] | null
  status?: string
  remarks?: string | null
  alignment_map?: { orig: number; trans: number }[] | null
}

export default function EntryDetail() {
  const params = useParams();
  const id = Number(params.id);
  const nav = useNavigate();
  const [entry, setEntry] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [linkScroll, setLinkScroll] = useState(true);
  const [showRemarksPreview, setShowRemarksPreview] = useState(true);
  const origRef = useRef<HTMLTextAreaElement>(null);
  const transRef = useRef<HTMLTextAreaElement>(null);
  const [splitRatio, setSplitRatio] = useState<number>(50);
  const [origSegMode, setOrigSegMode] = useState<'line' | 'sentence'>('sentence');
  const [transSegMode, setTransSegMode] = useState<'line' | 'sentence'>('sentence');
  const [curIdx, setCurIdx] = useState<number>(0);
  const remarksRef = useRef<HTMLTextAreaElement>(null);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [showTagTree, setShowTagTree] = useState<boolean>(false);
  const [alignmentMap, setAlignmentMap] = useState<{ orig: number; trans: number }[]>([]);
  const [mapOrigSel, setMapOrigSel] = useState<number>(0);
  const [mapTransSel, setMapTransSel] = useState<number>(0);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/entries/${id}`);
      if (res.status === 404) {
        setEntry(null);
      } else {
        const data = await res.json();
        setEntry(data);
        const map = Array.isArray(data?.alignment_map) ? data.alignment_map.map((p: any) => ({ orig: Number(p.orig||0), trans: Number(p.trans||0) })) : [];
        setAlignmentMap(map);
      }
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!entry) return;
    setSaving(true);
    try {
      const payload = {
        original_text: entry.original_text,
        translated_text: entry.translated_text,
        tags: entry.tags || [],
        remarks: entry.remarks || '',
        alignment_map: alignmentMap
      };
      const res = await fetch(`${API_BASE}/api/entries/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data?.ok) setToast('保存成功，已更新当天 Markdown');
      else setToast('保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm('确认删除此条目？')) return;
    const res = await fetch(`${API_BASE}/api/entries/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data?.ok) nav('/entries');
  }

  useEffect(() => { load(); }, [id]);

  // Two-window协同：同步滚动
  function syncScroll(from: 'orig' | 'trans') {
    if (!linkScroll) return;
    const a = from === 'orig' ? origRef.current : transRef.current;
    const b = from === 'orig' ? transRef.current : origRef.current;
    if (!a || !b) return;
    const maxA = a.scrollHeight - a.clientHeight;
    const maxB = b.scrollHeight - b.clientHeight;
    const ratio = maxA > 0 ? (a.scrollTop / maxA) : 0;
    b.scrollTop = ratio * maxB;
  }

  // Sentence segmentation helpers (inside component)
  type Segment = { text: string; start: number; end: number };
  function segmentLines(text: string): Segment[] {
    const arr: Segment[] = [];
    let pos = 0;
    const parts = text.split('\n');
    for (let i = 0; i < parts.length; i++) {
      const t = parts[i];
      const start = pos;
      const end = start + t.length;
      arr.push({ text: t, start, end });
      pos = end + 1; // account for \n
    }
    return arr.filter(s => s.text.trim().length > 0);
  }
  function segmentByRegex(text: string, regex: RegExp): Segment[] {
    const segs: Segment[] = [];
    for (const m of text.matchAll(regex) as any) {
      const str = String(m[0]);
      const idx = Number(m.index || 0);
      const start = idx;
      const end = idx + str.length;
      if (str.trim().length > 0) segs.push({ text: str, start, end });
    }
    return segs;
  }
  function segmentOriginalText(text: string, mode: 'line' | 'sentence'): Segment[] {
    if (mode === 'line') return segmentLines(text);
    // English sentence enders: . ! ?
    const re = /[^.!?\n]+(?:[.!?]+|\n|$)/g;
    return segmentByRegex(text, re);
  }
  function segmentTranslatedText(text: string, mode: 'line' | 'sentence'): Segment[] {
    if (mode === 'line') return segmentLines(text);
    // Chinese sentence enders: 。 ！ ？
    const re = /[^。！？\n]+(?:[。！？]+|\n|$)/g;
    return segmentByRegex(text, re);
  }

  const origSegs = useMemo(() => segmentOriginalText(entry?.original_text || '', origSegMode), [entry?.original_text, origSegMode]);
  const transSegs = useMemo(() => segmentTranslatedText(entry?.translated_text || '', transSegMode), [entry?.translated_text, transSegMode]);

  useEffect(() => {
    // When text or modes change, ensure current index is within bounds
    const maxIdx = Math.max(0, Math.min(origSegs.length - 1, transSegs.length - 1));
    setCurIdx(i => Math.max(0, Math.min(i, maxIdx)));
  }, [origSegs.length, transSegs.length]);

  function selectSegment(ref: React.RefObject<HTMLTextAreaElement | null>, seg?: Segment) {
    const el = ref.current;
    if (!el || !seg) return;
    el.focus();
    try {
      el.setSelectionRange(seg.start, seg.end);
    } catch {}
  }
  function gotoPrev() { setCurIdx(i => Math.max(0, i - 1)); }
  function gotoNext() { setCurIdx(i => Math.min(Math.max(origSegs.length - 1, transSegs.length - 1), i + 1)); }
  function alignSelection() {
    // Use mapping if available: find pair where orig === curIdx
    const pair = alignmentMap.find(p => p.orig === curIdx);
    const transIndex = pair ? pair.trans : curIdx;
    selectSegment(origRef, origSegs[curIdx]);
    selectSegment(transRef, transSegs[Math.max(0, Math.min(transSegs.length - 1, transIndex))]);
  }

  // Current mapped index for display
  const mappedTransIdx = useMemo(() => {
    const pair = alignmentMap.find(p => p.orig === curIdx);
    return pair ? pair.trans : curIdx;
  }, [alignmentMap, curIdx]);

  function addMapping() {
    const o = Math.max(0, Math.min(origSegs.length - 1, mapOrigSel));
    const t = Math.max(0, Math.min(transSegs.length - 1, mapTransSel));
    setAlignmentMap(prev => {
      const filtered = prev.filter(p => p.orig !== o);
      return [...filtered, { orig: o, trans: t }].sort((a, b) => a.orig - b.orig);
    });
  }
  function removeMapping(origIndex: number) {
    setAlignmentMap(prev => prev.filter(p => p.orig !== origIndex));
  }

  // Tag suggestions from all entries
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/entries`);
        if (res.ok) {
          const list = await res.json();
          const set = new Set<string>();
          for (const it of list || []) {
            const ts = Array.isArray(it.tags) ? it.tags : [];
            for (const t of ts) set.add(String(t));
          }
          setTagSuggestions(Array.from(set).sort());
        }
      } catch {}
    })();
  }, []);

  // Markdown toolbar helpers for remarks
  function updateRemarksText(next: string) {
    setEntry({ ...(entry as Entry), remarks: next });
  }
  function wrapSelection(ref: React.RefObject<HTMLTextAreaElement | null>, before: string, after: string, placeholder = '') {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const value = entry?.remarks || '';
    const selected = value.slice(start, end) || placeholder;
    const next = value.slice(0, start) + before + selected + after + value.slice(end);
    updateRemarksText(next);
    const caret = start + before.length + selected.length;
    requestAnimationFrame(() => {
      el.focus();
      try { el.setSelectionRange(caret, caret); } catch {}
    });
  }
  function prefixLines(ref: React.RefObject<HTMLTextAreaElement | null>, prefix: string) {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const value = entry?.remarks || '';
    const before = value.slice(0, start);
    const target = value.slice(start, end);
    const after = value.slice(end);
    const lines = (target || '').split('\n');
    const prefixed = lines.map(l => (l.trim().length ? prefix + l : l)).join('\n');
    const next = before + prefixed + after;
    updateRemarksText(next);
    const caret = start + prefixed.length;
    requestAnimationFrame(() => {
      el.focus();
      try { el.setSelectionRange(caret, caret); } catch {}
    });
  }

  function insertInlineCode() { wrapSelection(remarksRef, '`', '`', '代码'); }
  function insertCodeBlock() {
    const el = remarksRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const value = entry?.remarks || '';
    const selected = value.slice(start, end) || '代码块';
    const block = `\n\n\`\`\`\n${selected}\n\`\`\`\n\n`;
    const next = value.slice(0, start) + block + value.slice(end);
    updateRemarksText(next);
    requestAnimationFrame(() => { el.focus(); });
  }
  function insertLink() {
    const url = window.prompt('输入链接 URL：', 'https://');
    if (!url) return;
    const el = remarksRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const value = entry?.remarks || '';
    const selected = value.slice(start, end) || '链接文本';
    const next = value.slice(0, start) + `[${selected}](${url})` + value.slice(end);
    updateRemarksText(next);
    const caret = start + selected.length + url.length + 4; // rough
    requestAnimationFrame(() => { try { el.setSelectionRange(caret, caret); } catch {} el.focus(); });
  }
  function insertHeading(level: 1 | 2 | 3) {
    prefixLines(remarksRef, `${'#'.repeat(level)} `);
  }

  // Build tag hierarchy tree from suggestions (split by '/')
  type TagNode = { name: string; children: Map<string, TagNode> };
  const tagTree = useMemo(() => {
    const root: TagNode = { name: '', children: new Map() };
    for (const t of tagSuggestions) {
      const parts = t.split('/').map(s => s.trim()).filter(Boolean);
      let cur = root;
      for (const p of parts) {
        if (!cur.children.has(p)) cur.children.set(p, { name: p, children: new Map() });
        cur = cur.children.get(p)!;
      }
    }
    return root;
  }, [tagSuggestions]);

  function renderTagTree(node: TagNode, path: string[] = []) {
    const entries = Array.from(node.children.values());
    if (!entries.length) return null;
    return (
      <ul style={{ listStyle: 'none', paddingLeft: 12 }}>
        {entries.map(child => {
          const nextPath = [...path, child.name];
          const full = nextPath.join('/');
          return (
            <li key={full}>
              <button className="chip" onClick={() => {
                const cur = Array.isArray(entry?.tags) ? entry!.tags! : [];
                if (!cur.includes(full)) setEntry({ ...(entry as Entry), tags: [...cur, full] });
              }}>{child.name}</button>
              {renderTagTree(child, nextPath)}
            </li>
          );
        })}
      </ul>
    );
  }

  function renderEntryMarkdown(e: Entry) {
    const lines: string[] = [];
    lines.push(`# ${e.date}`);
    lines.push('');
    lines.push(`- ${e.created_at}${e.source_image_path ? `  来源: ${e.source_image_path}` : ''}`);
    lines.push('');
    lines.push('  原文：');
    for (const ln of (e.original_text || '').split('\n')) lines.push(`  ${ln}`);
    lines.push('');
    lines.push('  译文：');
    for (const ln of (e.translated_text || '').split('\n')) lines.push(`  ${ln}`);
    if (e.remarks) {
      lines.push('');
      lines.push('  备注：');
      for (const ln of (e.remarks || '').split('\n')) lines.push(`  ${ln}`);
    }
    if (e.tags && Array.isArray(e.tags) && e.tags.length) {
      lines.push('');
      lines.push(`  标签： ${e.tags.join(', ')}`);
    }
    if (e.tokens && Array.isArray(e.tokens) && e.tokens.length) {
      lines.push('');
      lines.push(`  词汇： ${e.tokens.join(', ')}`);
    }
    lines.push('');
    return lines.join('\n');
  }

  async function copyMarkdown() {
    if (!entry) return;
    const md = renderEntryMarkdown(entry);
    await navigator.clipboard.writeText(md);
    setToast('已复制 Markdown');
  }

  function downloadMarkdown() {
    if (!entry) return;
    const md = renderEntryMarkdown(entry);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${entry.date}-${entry.created_at.replace(':','')}-entry.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  if (loading) return <div className="container">加载中…</div>;
  if (!entry) return <div className="container">未找到条目</div>;

  const tagsStr = Array.isArray(entry.tags) ? entry.tags.join(', ') : '';
  const remarksHtml = marked.parse(entry.remarks || '', { breaks: true }) as string;

  return (
    <div className="container">
      <h1 className="page-title">条目详情</h1>
      <div className="muted">{entry.date} {entry.created_at} {entry.source_image_path ? `来源: ${entry.source_image_path}` : ''}</div>
      <div className="card" style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={linkScroll} onChange={e => setLinkScroll(e.target.checked)} /> 联动滚动（两窗口同步）
        </label>
        <button className="btn" onClick={() => nav('/')}>返回快速捕获</button>
        <button className="btn" onClick={copyMarkdown}>复制 Markdown</button>
        <button className="btn" onClick={downloadMarkdown}>下载 .md</button>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <label>原文分段：</label>
          <select value={origSegMode} onChange={e => setOrigSegMode(e.target.value as any)}>
            <option value="sentence">按句（英文）</option>
            <option value="line">按换行</option>
          </select>
          <label style={{ marginLeft: 8 }}>译文分段：</label>
          <select value={transSegMode} onChange={e => setTransSegMode(e.target.value as any)}>
            <option value="sentence">按句（中文）</option>
            <option value="line">按换行</option>
          </select>
        </div>
        <div className="muted">句数：原文 {origSegs.length} / 译文 {transSegs.length}</div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <button className="btn" onClick={gotoPrev} disabled={curIdx <= 0}>上一句</button>
          <span className="muted">第 {curIdx + 1} 句</span>
          <button className="btn" onClick={gotoNext} disabled={curIdx >= Math.max(origSegs.length - 1, transSegs.length - 1)}>下一句</button>
          <button className="btn btn-primary" onClick={alignSelection} disabled={origSegs.length === 0 && transSegs.length === 0}>对齐并高亮</button>
        </div>
      </div>
      <div className="grid-2" style={{ marginTop: 16, display: 'grid', gridTemplateColumns: `${splitRatio}% ${100 - splitRatio}%`, gap: 12 }}>
        <div>
          <label>原文 <span className="muted" style={{ marginLeft: 8 }}>当前句索引：{curIdx + 1}</span></label>
          <textarea ref={origRef} onScroll={() => syncScroll('orig')} className="textarea input" value={entry.original_text} onChange={e => setEntry({ ...(entry as Entry), original_text: e.target.value })} rows={14} />
        </div>
        <div>
          <label>译文 <span className="muted" style={{ marginLeft: 8 }}>当前句索引：{Math.min(transSegs.length, Math.max(1, mappedTransIdx + 1))}</span></label>
          <textarea ref={transRef} onScroll={() => syncScroll('trans')} className="textarea input" value={entry.translated_text} onChange={e => setEntry({ ...(entry as Entry), translated_text: e.target.value })} rows={14} />
        </div>
      </div>
      <div className="card" style={{ marginTop: 8 }}>
        <label>窗口宽度比例：</label>
        <input type="range" min={30} max={70} value={splitRatio} onChange={e => setSplitRatio(Number(e.target.value))} />
      </div>
      <div style={{ marginTop: 12 }}>
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <label>手动句对绑定：</label>
              <select value={mapOrigSel} onChange={e => setMapOrigSel(Number(e.target.value))}>
                {origSegs.map((_, i) => (<option key={i} value={i}>原文 第 {i + 1} 句</option>))}
              </select>
              <span>→</span>
              <select value={mapTransSel} onChange={e => setMapTransSel(Number(e.target.value))}>
                {transSegs.map((_, i) => (<option key={i} value={i}>译文 第 {i + 1} 句</option>))}
              </select>
              <button className="btn" onClick={addMapping}>添加映射</button>
            </div>
            <div className="muted">当前导航句：原文 {curIdx + 1} → 译文 {Math.min(transSegs.length, Math.max(1, mappedTransIdx + 1))}</div>
          </div>
          {alignmentMap.length ? (
            <div style={{ marginTop: 8 }}>
              <div className="muted" style={{ marginBottom: 6 }}>已绑定映射：</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {alignmentMap.map(p => (
                  <span key={`${p.orig}-${p.trans}`} className="chip">
                    原 {p.orig + 1} → 译 {p.trans + 1}
                    <button className="btn" style={{ marginLeft: 6 }} onClick={() => removeMapping(p.orig)}>移除</button>
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <label>标签（逗号分隔；支持层级：用 / 表示，如 学习/词汇/动词）</label>
        <input className="input" type="text" value={tagsStr} placeholder="例如：学习/词汇/动词, 语法/时态" onChange={e => setEntry({ ...(entry as Entry), tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
        <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(entry.tags || []).map((t, i) => (
            <span key={i} className="chip">{t}</span>
          ))}
        </div>
        {tagSuggestions.length ? (
          <div style={{ marginTop: 8 }}>
            <div className="muted" style={{ marginBottom: 6 }}>常用标签：</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {tagSuggestions.map((t) => (
                <button key={t} className="chip" onClick={() => {
                  const cur = Array.isArray(entry.tags) ? entry.tags : [];
                  if (!cur.includes(t)) setEntry({ ...(entry as Entry), tags: [...cur, t] });
                }}>{t}</button>
              ))}
            </div>
          </div>
        ) : null}
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontWeight: 600 }}>标签层级选择器</label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={showTagTree} onChange={e => setShowTagTree(e.target.checked)} /> 显示层级树
            </label>
          </div>
          {showTagTree ? (
            <div style={{ marginTop: 8 }}>
              {renderTagTree(tagTree)}
            </div>
          ) : (
            <div className="card muted">已隐藏</div>
          )}
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <label>备注（支持轻量 Markdown）</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '6px 0' }}>
          <button className="btn" onClick={() => wrapSelection(remarksRef, '**', '**', '加粗文本')}>粗体</button>
          <button className="btn" onClick={() => wrapSelection(remarksRef, '*', '*', '斜体文本')}>斜体</button>
          <button className="btn" onClick={() => prefixLines(remarksRef, '- ')}>• 列表</button>
          <button className="btn" onClick={() => prefixLines(remarksRef, '1. ')}>1. 列表</button>
          <button className="btn" onClick={() => prefixLines(remarksRef, '> ')}>引用</button>
          <button className="btn" onClick={insertInlineCode}>` 内联代码</button>
          <button className="btn" onClick={insertCodeBlock}>``` 代码块</button>
          <button className="btn" onClick={() => insertHeading(1)}># H1</button>
          <button className="btn" onClick={() => insertHeading(2)}>## H2</button>
          <button className="btn" onClick={() => insertHeading(3)}>### H3</button>
          <button className="btn" onClick={insertLink}>插入链接</button>
        </div>
        <div className="grid-2">
          <textarea ref={remarksRef} className="textarea input" value={entry.remarks || ''} onChange={e => setEntry({ ...(entry as Entry), remarks: e.target.value })} rows={8} />
          {showRemarksPreview ? (
            <div className="card" style={{ overflow: 'auto' }}>
              <div dangerouslySetInnerHTML={{ __html: remarksHtml }} />
            </div>
          ) : (
            <div className="card muted">预览已隐藏</div>
          )}
        </div>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
          <input type="checkbox" checked={showRemarksPreview} onChange={e => setShowRemarksPreview(e.target.checked)} /> 显示备注预览
        </label>
      </div>
      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? '保存中…' : '保存'}</button>
        <button className="btn btn-danger" onClick={remove}>删除</button>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}