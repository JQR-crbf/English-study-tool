import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

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
}

export default function Entries() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [date, setDate] = useState<string>(today);
  const [list, setList] = useState<Entry[]>([]);
  const [keyword, setKeyword] = useState<string>('');
  const [tag, setTag] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [compact, setCompact] = useState<boolean>(false);
  const [tagPalette, setTagPalette] = useState<{ name: string; count: number }[]>([]);
  // 高级过滤
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [tagsMode, setTagsMode] = useState<'any' | 'all'>('any');
  const [keywords, setKeywords] = useState<string>(''); // 空格分隔
  const [keywordMode, setKeywordMode] = useState<'any' | 'all'>('any');
  const [hasRemarks, setHasRemarks] = useState<boolean>(false);
  const [hasImage, setHasImage] = useState<boolean>(false);
  const [newFilterTag, setNewFilterTag] = useState<string>('');

  async function fetchByDate(d: string) {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/entries?date=${encodeURIComponent(d)}`);
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [];
      setList(arr);
      buildTagPalette(arr);
    } finally {
      setLoading(false);
    }
  }

  async function doSearch() {
    setLoading(true);
    try {
      const qsParts: string[] = [];
      if (keyword.trim()) qsParts.push(`keyword=${encodeURIComponent(keyword.trim())}`);
      if (tag.trim()) qsParts.push(`tag=${encodeURIComponent(tag.trim())}`);
      const qs = qsParts.length ? `?${qsParts.join('&')}` : '';
      const res = await fetch(`${API_BASE}/api/entries${qs}`);
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [];
      setList(arr);
      buildTagPalette(arr);
    } finally {
      setLoading(false);
    }
  }

  async function loadAll() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/entries`);
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [];
      setList(arr);
      buildTagPalette(arr);
    } finally {
      setLoading(false);
    }
  }

  function buildTagPalette(arr: Entry[]) {
    const counter: Record<string, number> = {};
    for (const e of arr) {
      if (Array.isArray(e.tags)) {
        for (const t of e.tags) {
          const name = String(t).trim();
          if (!name) continue;
          counter[name] = (counter[name] || 0) + 1;
        }
      }
    }
    const palette = Object.entries(counter).map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 24);
    setTagPalette(palette);
  }

  useEffect(() => { fetchByDate(date); }, [date]);

  const filteredList = useMemo(() => {
    let rows = list.slice();
    // 日期范围
    if (startDate && endDate) {
      rows = rows.filter(e => e.date >= startDate && e.date <= endDate);
    }
    // 标签筛选
    if (filterTags.length) {
      rows = rows.filter(e => {
        const tags = Array.isArray(e.tags) ? e.tags.map(t => String(t)) : [];
        if (tagsMode === 'any') {
          return filterTags.some(t => tags.includes(t));
        } else {
          return filterTags.every(t => tags.includes(t));
        }
      });
    }
    // 多关键词
    const kws = keywords.split(/\s+/).map(s => s.trim()).filter(Boolean).map(s => s.toLowerCase());
    if (kws.length) {
      rows = rows.filter(e => {
        const hay = [e.original_text || '', e.translated_text || '', e.remarks || '', Array.isArray(e.tokens) ? e.tokens.join(' ') : '']
          .join(' ').toLowerCase();
        if (keywordMode === 'any') return kws.some(k => hay.includes(k));
        return kws.every(k => hay.includes(k));
      });
    }
    // 备注/图片
    if (hasRemarks) rows = rows.filter(e => (e.remarks || '').trim().length > 0);
    if (hasImage) rows = rows.filter(e => !!e.source_image_path);
    return rows;
  }, [list, startDate, endDate, filterTags, tagsMode, keywords, keywordMode, hasRemarks, hasImage]);

  return (
    <div className="container">
      <h1 className="page-title">条目列表</h1>
      <div className="card" style={{ marginBottom: 12 }}>
      <div className="grid-2">
        <div>
          <label>日期：</label>
          <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <button className="btn" onClick={() => fetchByDate(date)} disabled={loading}>{loading ? '加载中…' : '刷新'}</button>
          <button className="btn" onClick={() => { const t = new Date().toISOString().slice(0,10); setDate(t); fetchByDate(t); }}>今天</button>
          <button className="btn" onClick={loadAll} disabled={loading}>{loading ? '加载中…' : '加载全部'}</button>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
            <input type="checkbox" checked={compact} onChange={e => setCompact(e.target.checked)} /> 紧凑模式
          </label>
        </div>
      </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginTop: 12 }}>
          <input className="input" type="text" value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="关键字（原文/译文/备注）" />
          <input className="input" type="text" value={tag} onChange={e => setTag(e.target.value)} placeholder="标签（支持部分匹配）" />
          <button className="btn btn-primary" onClick={doSearch} disabled={loading}>{loading ? '搜索中…' : '搜索'}</button>
        </div>
        {tagPalette.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div className="muted" style={{ marginBottom: 6 }}>常用标签：</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {tagPalette.map(tg => (
                <button key={tg.name} className="chip" style={{ cursor: 'pointer' }} onClick={() => { setTag(tg.name); doSearch(); }} title={`${tg.count} 条`}>
                  {tg.name}
                </button>
              ))}
              <button className="btn" onClick={() => { setTag(''); doSearch(); }}>清除标签筛选</button>
            </div>
          </div>
        )}
        <div className="card" style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontWeight: 600 }}>高级过滤</label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={showAdvanced} onChange={e => setShowAdvanced(e.target.checked)} /> 显示
            </label>
          </div>
          {showAdvanced ? (
            <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label>日期范围：</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input className="input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                  <span>→</span>
                  <input className="input" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
              </div>
              <div>
                <label>多关键词（空格分隔）：</label>
                <input className="input" type="text" value={keywords} onChange={e => setKeywords(e.target.value)} placeholder="例如：时态 被动 语法" />
                <div className="muted" style={{ marginTop: 4 }}>
                  <label style={{ marginRight: 8 }}>
                    <input type="radio" name="kwmode" checked={keywordMode === 'any'} onChange={() => setKeywordMode('any')} /> 任意匹配
                  </label>
                  <label>
                    <input type="radio" name="kwmode" checked={keywordMode === 'all'} onChange={() => setKeywordMode('all')} /> 全部匹配
                  </label>
                </div>
              </div>
              <div>
                <label>标签过滤：</label>
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <input className="input" type="text" value={newFilterTag} onChange={e => setNewFilterTag(e.target.value)} placeholder="输入标签后添加" />
                  <button className="btn" onClick={() => { const t = newFilterTag.trim(); if (t && !filterTags.includes(t)) setFilterTags(prev => [...prev, t]); setNewFilterTag(''); }}>添加</button>
                  <button className="btn" onClick={() => setFilterTags([])}>清空</button>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                  {filterTags.map((t, i) => (
                    <span key={i} className="chip">{t} <button className="btn" style={{ marginLeft: 6 }} onClick={() => setFilterTags(prev => prev.filter(x => x !== t))}>移除</button></span>
                  ))}
                </div>
                <div className="muted" style={{ marginTop: 4 }}>
                  <label style={{ marginRight: 8 }}>
                    <input type="radio" name="tagmode" checked={tagsMode === 'any'} onChange={() => setTagsMode('any')} /> 任意包含
                  </label>
                  <label>
                    <input type="radio" name="tagmode" checked={tagsMode === 'all'} onChange={() => setTagsMode('all')} /> 全部包含
                  </label>
                </div>
              </div>
              <div>
                <label>其他：</label>
                <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                  <label>
                    <input type="checkbox" checked={hasRemarks} onChange={e => setHasRemarks(e.target.checked)} /> 仅含备注
                  </label>
                  <label>
                    <input type="checkbox" checked={hasImage} onChange={e => setHasImage(e.target.checked)} /> 仅含图片
                  </label>
                </div>
              </div>
            </div>
          ) : (
            <div className="card muted">已隐藏</div>
          )}
        </div>
      </div>
      <div>
        {filteredList.length === 0 && <div className="muted">暂无条目</div>}
        {filteredList.map(e => (
          <div key={e.id} className="card" style={{ marginBottom: 12, padding: compact ? 12 : undefined }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ fontWeight: 700 }}>{e.date}</div>
              <div className="muted">{e.created_at}</div>
              {e.status && <span className="tag" title="状态">{e.status}</span>}
              <div style={{ marginLeft: 'auto' }}>
                <Link to={`/entry/${e.id}`}>详情</Link>
              </div>
            </div>
            {!compact && e.tags && e.tags.length > 0 && (
              <div className="tags" style={{ marginTop: 8 }}>
                {e.tags.map((t, i) => (<span key={i} className="tag">#{t}</span>))}
              </div>
            )}
            <div className="grid-2" style={{ marginTop: 8 }}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>原文</div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{(e.original_text || '').split('\n')[0]}</div>
              </div>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>译文</div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{(e.translated_text || '').split('\n')[0]}</div>
              </div>
            </div>
            {!compact && (
              <div style={{ marginTop: 8, display: 'flex', gap: 12 }}>
                {e.source_image_path && (
                  <a href={`${API_BASE}/${e.source_image_path}`} target="_blank" rel="noreferrer">来源图片</a>
                )}
                <a href={`${API_BASE}/data/notes/${e.date}.md`} target="_blank" rel="noreferrer">当天 Markdown</a>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}