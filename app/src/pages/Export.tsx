import { useState } from 'react'
const API_BASE = 'http://localhost:3001';

export default function ExportPage() {
  const today = new Date().toISOString().slice(0,10);
  const [start, setStart] = useState<string>('');
  const [end, setEnd] = useState<string>('');
  const [type, setType] = useState<'md'|'csv'>('md');
  const [keyword, setKeyword] = useState<string>('');
  const [tag, setTag] = useState<string>(''); // 单标签（兼容服务器 searchEntries）
  const [tags, setTags] = useState<string>(''); // 多标签，逗号或分号分隔
  const [tagsMode, setTagsMode] = useState<'any'|'all'>('any');
  const [hasRemarks, setHasRemarks] = useState<boolean>(false);
  const [hasImage, setHasImage] = useState<boolean>(false);

  const buildRange = () => {
    const params: Record<string, string> = { type };
    if (start && end) { params.start = start; params.end = end; }
    if (keyword.trim()) params.keyword = keyword.trim();
    if (tag.trim()) params.tag = tag.trim();
    if (tags.trim()) { params.tags = tags.trim(); params.tagsMode = tagsMode; }
    if (hasRemarks) params.hasRemarks = 'true';
    if (hasImage) params.hasImage = 'true';
    const qs = Object.entries(params).map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    return `${API_BASE}/api/export?${qs}`;
  };

  return (
    <div className="container">
      <h1 className="page-title">导出</h1>
      <p className="muted">按 PRD 支持导出 Markdown / CSV；你可以直接点击以下示例链接预览或下载。</p>
      <div className="card">
        <ul>
          <li>
            今日 Markdown：
            <a href={`${API_BASE}/data/notes/${today}.md`} target="_blank" rel="noreferrer">打开</a>
          </li>
          <li>
            全部导出 Markdown：
            <a href={`${API_BASE}/api/export?type=md`} target="_blank" rel="noreferrer">下载</a>
          </li>
          <li>
            全部导出 CSV（含备注与标签）：
            <a href={`${API_BASE}/api/export?type=csv`} target="_blank" rel="noreferrer">下载</a>
          </li>
        </ul>
        <div style={{ marginTop: 12 }}>
          <label>按日期区间导出：</label>
          <input className="input" type="date" value={start} onChange={e => setStart(e.target.value)} />
          <span style={{ margin: '0 8px' }}>→</span>
          <input className="input" type="date" value={end} onChange={e => setEnd(e.target.value)} />
        </div>
        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label>格式：</label>
            <select value={type} onChange={e => setType(e.target.value as any)}>
              <option value="md">Markdown</option>
              <option value="csv">CSV</option>
            </select>
          </div>
          <div>
            <label>关键词：</label>
            <input className="input" type="text" value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="可选：原文/译文/备注中匹配" />
          </div>
          <div>
            <label>单标签：</label>
            <input className="input" type="text" value={tag} onChange={e => setTag(e.target.value)} placeholder="可选：部分匹配" />
          </div>
          <div>
            <label>多标签（逗号或分号分隔）：</label>
            <input className="input" type="text" value={tags} onChange={e => setTags(e.target.value)} placeholder="例如：学习/词汇; 语法/时态" />
            <div className="muted" style={{ marginTop: 4 }}>
              <label style={{ marginRight: 8 }}>
                <input type="radio" name="tagsMode" checked={tagsMode === 'any'} onChange={() => setTagsMode('any')} /> 任意包含
              </label>
              <label>
                <input type="radio" name="tagsMode" checked={tagsMode === 'all'} onChange={() => setTagsMode('all')} /> 全部包含
              </label>
            </div>
          </div>
          <div>
            <label>其他：</label>
            <div style={{ display: 'flex', gap: 12 }}>
              <label>
                <input type="checkbox" checked={hasRemarks} onChange={e => setHasRemarks(e.target.checked)} /> 仅含备注
              </label>
              <label>
                <input type="checkbox" checked={hasImage} onChange={e => setHasImage(e.target.checked)} /> 仅含图片
              </label>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <a className="btn btn-primary" href={buildRange()} target="_blank" rel="noreferrer">按以上条件导出</a>
        </div>
      </div>
    </div>
  )
}