import './App.css'
import { useEffect, useState } from 'react'
import { BrowserRouter, HashRouter, Link, Route, Routes } from 'react-router-dom'
import QuickCapture from './pages/QuickCapture.tsx'
import Entries from './pages/Entries.tsx'
import EntryDetail from './pages/EntryDetail.tsx'
import ExportPage from './pages/Export.tsx'
import SettingsPage from './pages/Settings.tsx'
import ReviewPage from './pages/Review.tsx'

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

export default function App() {
  const initialPreset = localStorage.getItem('clipstudy.themePreset') || 'custom';
  const initialBgColor = localStorage.getItem('clipstudy.bgColor') || PRESETS[initialPreset]?.bg || '#12161c';
  const [preset] = useState<string>(initialPreset);
  const [bgColor] = useState<string>(initialBgColor);

  useEffect(() => {
    // Helper functions for palette generation based on background color
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
    function brightness(hex: string) {
      const { r, g, b } = hexToRgb(hex);
      return (0.299*r + 0.587*g + 0.114*b) / 255; // 0..1
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

    const isLight = brightness(bgColor) > 0.7;
    const surface = isLight ? mix(bgColor, '#000000', 0.04) : mix(bgColor, '#ffffff', 0.08);
    const surface2 = isLight ? mix(bgColor, '#000000', 0.08) : mix(bgColor, '#ffffff', 0.14);
    const border = isLight ? mix(bgColor, '#000000', 0.16) : mix(bgColor, '#ffffff', 0.24);
    const text = isLight ? '#1c2128' : '#e6e8eb';
    const muted = isLight ? '#5b6675' : '#9aa4b2';

    // Dynamic primary accent derived from background for harmony & contrast
    let primaryHex = PRESETS[preset]?.primary || '#4f8cff';
    try {
      const { r, g, b } = hexToRgb(bgColor);
      const { h, s } = rgbToHsl(r, g, b);
      const accentH = (h + 35) % 360;
      const accentS = Math.max(0.55, Math.min(0.85, s + 0.25));
      const accentL = isLight ? 0.45 : 0.62;
      primaryHex = hslToHex(accentH, accentS, accentL);
    } catch {}

    const root = document.documentElement.style;
    root.setProperty('--bg', bgColor);
    root.setProperty('--surface', surface);
    root.setProperty('--surface-2', surface2);
    root.setProperty('--border', border);
    root.setProperty('--text', text);
    root.setProperty('--muted', muted);
    root.setProperty('--primary', primaryHex);
    localStorage.setItem('clipstudy.bgColor', bgColor);
    localStorage.setItem('clipstudy.primaryColor', primaryHex);
    localStorage.setItem('clipstudy.themePreset', preset);
  }, [bgColor, preset]);

  const isDesktop = typeof (window as any).api !== 'undefined';
  const Router = isDesktop ? HashRouter : BrowserRouter;

  const AppBody = () => {
    // 单窗口模式下在桌面端也始终显示导航
    const showNav = true;
    return (
      <div className="container">
        {showNav && (
          <nav className="nav">
            <Link to="/">快速捕获</Link>
            <Link to="/entries">条目列表</Link>
            <Link to="/review">复习对话</Link>
            <Link to="/export">导出</Link>
            <Link to="/settings">设置</Link>
            {/* 主题颜色设置已移至设置页面，不在顶部导航展示 */}
          </nav>
        )}
        <Routes>
          <Route path="/" element={<QuickCapture />} />
          <Route path="/entries" element={<Entries />} />
          <Route path="/entry/:id" element={<EntryDetail />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/export" element={<ExportPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </div>
    );
  };

  return (
    <Router>
      <AppBody />
    </Router>
  )
}
