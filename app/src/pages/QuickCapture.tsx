import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Tesseract from 'tesseract.js'

const API_BASE = 'http://localhost:3001';

export default function QuickCapture() {
  const navigate = useNavigate();
  const dropRef = useRef<HTMLDivElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [originalText, setOriginalText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [ocrRunning, setOcrRunning] = useState(false);
  const [translateRunning, setTranslateRunning] = useState(false);
  const [saveRunning, setSaveRunning] = useState(false);
  const [toast, setToast] = useState<string>('');

  const handlePaste = useCallback(async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          setImageFile(file);
          setImagePreview(URL.createObjectURL(file));
          await runOcr(file);
        }
        break;
      }
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      await runOcr(file);
    }
  }, []);

  // importFromClipboard 依赖 runOcr，需在 runOcr 定义之后再声明（见下方）

  // 桌面端（Windows/macOS）使用本地 OCR 资源，避免 CDN 访问与路径问题
  const ocrOptionsRef = useRef<any>(null);
  const getOcrOptions = useCallback(async () => {
    if (ocrOptionsRef.current) return ocrOptionsRef.current;
    const api = (window as any).api;
    // 默认仅使用日志；在桌面端尝试设置本地路径
    const base = { logger: () => {} } as any;
    if (api && typeof api.getResourceUrl === 'function') {
      try {
        const workerPath = await api.getResourceUrl('tesseract/worker.min.js');
        const corePath = await api.getResourceUrl('tesseract-core');
        const langPath = await api.getResourceUrl('tessdata');
        if (workerPath) base.workerPath = workerPath;
        if (corePath) base.corePath = corePath; // 目录，包含 tesseract-core*.wasm.js
        if (langPath) base.langPath = langPath; // 目录，包含 eng.traineddata.gz
      } catch {}
    }
    ocrOptionsRef.current = base;
    return base;
  }, []);

  const runOcr = useCallback(async (file: File) => {
    setOcrRunning(true);
    setOriginalText('');
    try {
      const opts = await getOcrOptions();
      const result = await Tesseract.recognize(file, 'eng', opts);
      const text = (result.data.text || '').trim();
      setOriginalText(text);
      const auto = localStorage.getItem('clipstudy.autoTranslateOnImport') !== 'false';
      if (auto && text) {
        await doTranslate(text);
      }
    } catch (err) {
      console.error(err);
      setToast('OCR 识别失败，请重试');
    } finally {
      setOcrRunning(false);
    }
  }, [getOcrOptions]);

  const importFromClipboard = useCallback(async () => {
    const api = (window as any).api;
    if (!api || typeof api.readClipboard !== 'function') {
      setToast('当前环境不支持直接读取剪贴板，请在此处按 Cmd+V 粘贴');
      return;
    }
    try {
      const result = await api.readClipboard();
      const { text, imageDataUrl } = result || {};
      if (imageDataUrl) {
        const resp = await fetch(imageDataUrl);
        const blob = await resp.blob();
        const file = new File([blob], 'clipboard.png', { type: blob.type || 'image/png' });
        setImageFile(file);
        setImagePreview(imageDataUrl);
        await runOcr(file);
        return;
      }
      if ((text || '').trim()) {
        const t = (text || '').trim();
        setOriginalText(t);
        const auto = localStorage.getItem('clipstudy.autoTranslateOnImport') !== 'false';
        if (auto) {
          await doTranslate(t);
        }
        return;
      }
      setToast('剪贴板为空或不支持的内容类型');
    } catch (e) {
      setToast('读取剪贴板失败，可尝试在捕获区域按 Cmd+V 粘贴');
    }
  }, [runOcr]);

  const doTranslate = useCallback(async (textOverride?: string) => {
    const textToTranslate = (textOverride ?? originalText).trim();
    if (!textToTranslate) return;
    setTranslateRunning(true);
    setTranslatedText('');
    try {
      const preferredEngine = localStorage.getItem('clipstudy.preferredEngine') || 'auto';
      const offlineOnly = localStorage.getItem('clipstudy.offlineOnly') === 'true';
      const res = await fetch(`${API_BASE}/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToTranslate, preferredEngine, offlineOnly })
      });
      const data = await res.json();
      setTranslatedText((data?.translated || '').trim());
    } catch (e) {
      setToast('翻译失败，可稍后重试或检查 API Key');
    } finally {
      setTranslateRunning(false);
    }
  }, [originalText]);

  const uploadImage = async (file: File) => {
    const form = new FormData();
    form.append('image', file);
    const res = await fetch(`${API_BASE}/api/upload`, { method: 'POST', body: form });
    const data = await res.json();
    return data?.path as string;
  };

  const handleSave = useCallback(async () => {
    setSaveRunning(true);
    try {
      let imagePath: string | undefined;
      const saveImage = localStorage.getItem('clipstudy.saveImage') !== 'false';
      if (imageFile && saveImage) {
        imagePath = await uploadImage(imageFile);
      }
      const offlineOnly = localStorage.getItem('clipstudy.offlineOnly') === 'true';
      const payload = {
        source_type: imageFile ? 'file_drop' : 'clipboard',
        source_image_path: imagePath,
        original_text: originalText,
        translated_text: translatedText,
        status: offlineOnly ? 'no_translate' : (translatedText ? 'normal' : 'translate_failed')
      };
      const res = await fetch(`${API_BASE}/api/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      setToast(`保存成功（ID: ${data?.id}），已更新当日 Markdown`);
      return data?.id as number;
    } catch (e) {
      setToast('保存失败，请稍后重试');
      return undefined;
    } finally {
      setSaveRunning(false);
    }
  }, [imageFile, originalText, translatedText]);

  const handleSaveAndOpen = useCallback(async () => {
    const id = await handleSave();
    if (!id) return;
    // 优先走 Electron 的 IPC（两窗口协同），否则在 Web 原型中使用路由跳转
    const api = (window as any).api;
    if (api && typeof api.openEntry === 'function') {
      try { await api.openEntry(id); } catch { navigate(`/entry/${id}`); }
    } else {
      navigate(`/entry/${id}`);
    }
  }, [handleSave, navigate]);

  const copyTranslated = useCallback(async () => {
    const text = (translatedText || '').trim();
    if (!text) { setToast('译文为空，无法复制'); return; }
    await navigator.clipboard.writeText(text);
    setToast('已复制译文到剪贴板');
  }, [translatedText]);

  const copyBilingual = useCallback(async () => {
    const lines: string[] = [];
    lines.push('原文：');
    lines.push(originalText || '');
    lines.push('');
    lines.push('译文：');
    lines.push(translatedText || '');
    const text = lines.join('\n');
    await navigator.clipboard.writeText(text);
    setToast('已复制英汉对照到剪贴板');
  }, [originalText, translatedText]);

  useEffect(() => {
    const api = (window as any).api;
    if (api && typeof api.onPasteShortcut === 'function') {
      api.onPasteShortcut(() => {
        importFromClipboard();
      });
    }
  }, [importFromClipboard]);

  return (
    <div className="container">
      <h1 className="page-title">ClipStudy 快速捕获（Web 原型）</h1>
      <p className="muted">粘贴截图到此处或拖拽图片文件，离线 OCR（英文）→ 在线翻译（按设置页偏好：智谱 / 硅基 / 自动；支持隐私开关）→ 保存并自动生成当日 Markdown。</p>
      <div
        ref={dropRef}
        onPaste={handlePaste}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className="dropzone card"
        style={{ padding: 24 }}
      >
        {imagePreview ? (
          <img src={imagePreview} alt="preview" style={{ maxWidth: '100%', maxHeight: 240 }} />
        ) : (
          <div>将图片拖拽到此或在此处按 Cmd+V 粘贴图片</div>
        )}
      </div>
      <div style={{ marginTop: 8 }}>
        <button className="btn" onClick={() => importFromClipboard()}>从剪贴板导入</button>
      </div>
      <div className="grid-2" style={{ marginTop: 16 }}>
        <div>
          <label>原文（可编辑）</label>
          <textarea className="textarea input" value={originalText} onChange={e => setOriginalText(e.target.value)} rows={12} />
          <div style={{ marginTop: 8 }}>
        <button className="btn" onClick={() => imageFile && runOcr(imageFile)} disabled={!imageFile || ocrRunning}>
          {ocrRunning ? 'OCR 识别中…' : '重新识别'}
        </button>
          </div>
        </div>
        <div>
          <label>中文译文</label>
          <textarea className="textarea input" value={translatedText} onChange={e => setTranslatedText(e.target.value)} rows={12} />
          <div style={{ marginTop: 8 }}>
            <button className="btn btn-primary" onClick={() => doTranslate()} disabled={!originalText.trim() || translateRunning}>
              {translateRunning ? '翻译中…' : '翻译'}
            </button>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 16 }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saveRunning || !originalText.trim()}>
          {saveRunning ? '保存中…' : '保存（并更新当日 Markdown）'}
        </button>
        <button className="btn" style={{ marginLeft: 8 }} onClick={handleSaveAndOpen} disabled={saveRunning || !originalText.trim()}>
          {saveRunning ? '处理中…' : '保存并打开详情'}
        </button>
        <button className="btn" style={{ marginLeft: 8 }} onClick={copyTranslated} disabled={!translatedText.trim()}>
          复制译文
        </button>
        <button className="btn" style={{ marginLeft: 8 }} onClick={copyBilingual} disabled={!originalText.trim()}>
          复制英汉对照
        </button>
      </div>
      {toast && (
        <div className="toast">{toast}</div>
      )}
      <div className="muted" style={{ marginTop: 24 }}>
        提示：可在设置页选择翻译引擎（智谱/硅基/自动）、开启隐私模式（不调用在线翻译），以及切换“仅保存文本”（不保存图片文件）。
      </div>
    </div>
  )
}