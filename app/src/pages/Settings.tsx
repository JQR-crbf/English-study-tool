const PRESETS: Record<string, { name: string; bg: string; primary?: string }> = {
  custom: { name: '自定义', bg: '#12161c' },
  aurora: { name: '极光蓝', bg: '#0f172a', primary: '#60a5fa' },
  royal: { name: '皇家紫', bg: '#1a102d', primary: '#a78bfa' },
  emerald: { name: '翡翠绿', bg: '#0b1f17', primary: '#34d399' },
  sunset: { name: '日落橙', bg: '#22120e', primary: '#fb923c' },
  neutral: { name: '中性灰', bg: '#1f2329', primary: '#a1a1aa' },
  paper: { name: '纸白', bg: '#f5f7fb', primary: '#2563eb' },
  space: { name: '深空', bg: '#0b1020', primary: '#8b9cf9' }
};

export default function SettingsPage() {
  const preferredEngine = localStorage.getItem('clipstudy.preferredEngine') || 'auto';
  const offlineOnly = localStorage.getItem('clipstudy.offlineOnly') === 'true';
  const saveImage = localStorage.getItem('clipstudy.saveImage') !== 'false';
  const bgColor = localStorage.getItem('clipstudy.bgColor') || localStorage.getItem('clipstudy.themeColor') || '#12161c';
  const currentPreset = localStorage.getItem('clipstudy.themePreset') || 'custom';

  function setPreferredEngine(v: string) {
    localStorage.setItem('clipstudy.preferredEngine', v);
    alert('已保存：翻译引擎偏好');
  }
  function setOfflineOnly(v: boolean) {
    localStorage.setItem('clipstudy.offlineOnly', String(v));
    alert('已保存：隐私模式');
  }
  function setSaveImage(v: boolean) {
    localStorage.setItem('clipstudy.saveImage', String(v));
    alert('已保存：图片保存策略');
  }
  function applyThemeFromBg(v: string) {
    // Generate palette and dynamic primary from background color
    function hexToRgb(hex: string) {
      const h = hex.replace('#','');
      const bigint = parseInt(h.length === 3 ? h.split('').map(x=>x+x).join('') : h, 16);
      const r = (bigint >> 16) & 255;
      const g = (bigint >> 8) & 255;
      const b = bigint & 255;
      return { r, g, b };
    }
    function rgbToHex(r: number, g: number, b: number) {
      const toHex = (n: number) => n.toString(16).padStart(2, '0');
      return `#${toHex(Math.round(r))}${toHex(Math.round(g))}${toHex(Math.round(b))}`;
    }
    function mix(hexA: string, hexB: string, t: number) {
      const a = hexToRgb(hexA); const b = hexToRgb(hexB);
      const r = a.r*(1-t) + b.r*t; const g = a.g*(1-t) + b.g*t; const bl = a.b*(1-t) + b.b*t;
      return rgbToHex(r,g,bl);
    }
    function rgbToHsl(r: number, g: number, b: number) {
      r /= 255; g /= 255; b /= 255;
      const max = Math.max(r,g,b), min = Math.min(r,g,b);
      let h = 0, s = 0, l = (max + min) / 2;
      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
          case g: h = (b - r) / d + 2; break;
          case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
      }
      return { h: h * 360, s, l };
    }
    function hslToHex(h: number, s: number, l: number) {
      s = Math.max(0, Math.min(1, s));
      l = Math.max(0, Math.min(1, l));
      const c = (1 - Math.abs(2*l - 1)) * s;
      const hh = h / 60;
      const x = c * (1 - Math.abs(hh % 2 - 1));
      let r = 0, g = 0, b = 0;
      if (hh >= 0 && hh < 1) { r = c; g = x; }
      else if (hh >= 1 && hh < 2) { r = x; g = c; }
      else if (hh >= 2 && hh < 3) { g = c; b = x; }
      else if (hh >= 3 && hh < 4) { g = x; b = c; }
      else if (hh >= 4 && hh < 5) { r = x; b = c; }
      else { r = c; b = x; }
      const m = l - c/2;
      return rgbToHex((r + m)*255, (g + m)*255, (b + m)*255);
    }
    function brightness(hex: string) {
      const { r, g, b } = hexToRgb(hex);
      return (0.299*r + 0.587*g + 0.114*b) / 255;
    }
    const isLight = brightness(v) > 0.7;
    const surface = isLight ? mix(v, '#000000', 0.04) : mix(v, '#ffffff', 0.08);
    const surface2 = isLight ? mix(v, '#000000', 0.08) : mix(v, '#ffffff', 0.14);
    const border = isLight ? mix(v, '#000000', 0.16) : mix(v, '#ffffff', 0.24);
    const text = isLight ? '#1c2128' : '#e6e8eb';
    const muted = isLight ? '#5b6675' : '#9aa4b2';
    // dynamic primary from background
    let primaryHex = '#4f8cff';
    try {
      const { r, g, b } = hexToRgb(v);
      const { h, s } = rgbToHsl(r, g, b);
      const accentH = (h + 35) % 360;
      const accentS = Math.max(0.55, Math.min(0.85, s + 0.25));
      const accentL = isLight ? 0.45 : 0.62;
      primaryHex = hslToHex(accentH, accentS, accentL);
    } catch {}
    const root = document.documentElement.style;
    root.setProperty('--bg', v);
    root.setProperty('--surface', surface);
    root.setProperty('--surface-2', surface2);
    root.setProperty('--border', border);
    root.setProperty('--text', text);
    root.setProperty('--muted', muted);
    root.setProperty('--primary', primaryHex);
    localStorage.setItem('clipstudy.bgColor', v);
    localStorage.setItem('clipstudy.primaryColor', primaryHex);
  }

  function setBgColor(v: string) {
    localStorage.setItem('clipstudy.themePreset', 'custom');
    applyThemeFromBg(v);
    alert('已保存：背景颜色');
  }

  function setThemePreset(p: string) {
    const conf = PRESETS[p] || PRESETS['custom'];
    localStorage.setItem('clipstudy.themePreset', p);
    applyThemeFromBg(conf.bg);
    alert('已保存：主题预设');
  }

  return (
    <div className="container">
      <h1 className="page-title">设置</h1>
      <div style={{ marginTop: 12 }}>
        <label>翻译引擎偏好：</label>
        <select className="input" defaultValue={preferredEngine} onChange={e => setPreferredEngine(e.target.value)}>
          <option value="auto">自动（智谱→硅基回退）</option>
          <option value="zhipu">智谱（仅用）</option>
          <option value="siliconflow">硅基流动（仅用）</option>
        </select>
      </div>
      <div style={{ marginTop: 12 }}>
        <label>
          <input type="checkbox" defaultChecked={offlineOnly} onChange={e => setOfflineOnly(e.target.checked)} /> 隐私模式（不调用在线翻译）
        </label>
      </div>
      <div style={{ marginTop: 12 }}>
        <label>
          <input type="checkbox" defaultChecked={saveImage} onChange={e => setSaveImage(e.target.checked)} /> 保存图片文件（关闭后仅保存文本，不保存图片）
        </label>
      </div>
      <div style={{ marginTop: 12 }}>
        <label>主题预设：</label>
        <select className="input" defaultValue={currentPreset} onChange={e => setThemePreset(e.target.value)}>
          {Object.entries(PRESETS).map(([key, v]) => (
            <option key={key} value={key}>{v.name}</option>
          ))}
        </select>
      </div>
      <div style={{ marginTop: 12 }}>
        <label>背景颜色：</label>
        <input className="input" type="color" defaultValue={bgColor} onChange={e => setBgColor(e.target.value)} />
        <div className="muted" style={{ marginTop: 6 }}>提示：背景颜色将驱动整体界面底色与卡片/边框的层次。主题和颜色仅在“设置”页面中进行调整。</div>
      </div>
      <div style={{ marginTop: 12 }} className="muted">
        <p>API Key：当前使用服务器 .env 配置（ZHIPU_API_KEY / SILICONFLOW_API_KEY）。</p>
        <p>每日 Markdown 路径：默认 data/notes/，后续支持自定义目录。</p>
        <p>快捷键与剪贴板监听：Web 原型暂不支持，原生版实现。</p>
      </div>
    </div>
  )
}