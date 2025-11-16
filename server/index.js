import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import dayjs from 'dayjs';
import { fileURLToPath } from 'url';
import { createEntry, updateEntry, deleteEntry, getEntryById, listEntriesByDate, searchEntries } from './db.js';
import { extractWords, chatReview } from './review.js';
import { translateEnToZh } from './translate.js';
import { renderDailyMarkdown, writeDailyMarkdown } from './markdown.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
// 兼容 ESM：在 ES Module 中没有 __dirname，这里自定义
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// 统一数据目录：优先使用 CLIPSTUDY_DATA_DIR；否则固定为项目根的 data/
// 不再依赖 process.cwd()，避免不同启动方式导致写入到不同目录
const pathBase = process.env.CLIPSTUDY_DATA_DIR
  ? path.resolve(process.env.CLIPSTUDY_DATA_DIR)
  : path.resolve(__dirname, '..', 'data');

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use('/data', express.static(pathBase));

// Storage for uploaded images under data/media/YYYY-MM-DD
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dateFolder = dayjs().format('YYYY-MM-DD');
    const dest = path.resolve(pathBase, 'media', dateFolder);
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const ts = dayjs().format('HHmmss');
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `${ts}-${Math.random().toString(36).slice(2)}${ext}`);
  }
});
const upload = multer({ storage });

// Health
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// Upload image
app.post('/api/upload', upload.single('image'), (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file' });
  const dateFolder = path.basename(path.dirname(file.path));
  const relPath = path.posix.join('data', 'media', dateFolder, path.basename(file.path));
  res.json({ path: relPath, date: dateFolder });
});

// Translate
app.post('/api/translate', async (req, res) => {
  const { text, preferredEngine = 'auto', offlineOnly = false } = req.body;
  if (!text || !text.trim()) return res.json({ translated: '' });
  try {
    const translated = await translateEnToZh(text.trim(), { preferredEngine, offlineOnly });
    res.json({ translated });
  } catch (e) {
    res.json({ translated: '' });
  }
});

// Entries CRUD
app.post('/api/entries', (req, res) => {
  const id = createEntry(req.body || {});
  const date = req.body?.date || dayjs().format('YYYY-MM-DD');
  const entries = listEntriesByDate(date);
  const md = renderDailyMarkdown(date, entries);
  writeDailyMarkdown(date, md);
  res.json({ id });
});

app.get('/api/entries', (req, res) => {
  const { date, keyword, tag } = req.query;
  if (date) {
    const entries = listEntriesByDate(String(date));
    return res.json(entries);
  }
  const entries = searchEntries({ keyword: keyword ? String(keyword) : undefined, tag: tag ? String(tag) : undefined });
  res.json(entries);
});

app.get('/api/entries/:id', (req, res) => {
  const id = Number(req.params.id);
  const row = getEntryById(id);
  if (!row) return res.status(404).json({ error: 'not_found' });
  res.json(row);
});

app.put('/api/entries/:id', (req, res) => {
  const id = Number(req.params.id);
  const ok = updateEntry(id, req.body || {});
  const date = req.body?.date;
  // Mirror markdown only if date is provided or can be inferred from existing row
  const targetDate = date || getEntryById(id)?.date;
  if (targetDate) {
    const entries = listEntriesByDate(targetDate);
    const md = renderDailyMarkdown(targetDate, entries);
    writeDailyMarkdown(targetDate, md);
  }
  res.json({ ok });
});

app.delete('/api/entries/:id', (req, res) => {
  const id = Number(req.params.id);
  const row = getEntryById(id);
  const ok = deleteEntry(id);
  if (row?.date) {
    const entries = listEntriesByDate(row.date);
    const md = renderDailyMarkdown(row.date, entries);
    writeDailyMarkdown(row.date, md);
  }
  res.json({ ok });
});

// Export endpoints (Markdown / CSV)
app.get('/api/export', (req, res) => {
  const { type = 'md', date, start, end, keyword, tag, tags, tagsMode = 'any', hasRemarks, hasImage } = req.query;
  const fmt = String(type);
  // Base selection: keyword/tag search
  let entries = searchEntries({ keyword: keyword ? String(keyword) : undefined, tag: tag ? String(tag) : undefined });
  // Date or range filter
  if (date) entries = entries.filter(e => e.date === String(date));
  if (start && end) entries = entries.filter(e => e.date >= String(start) && e.date <= String(end));
  // Advanced filters
  const tagList = typeof tags === 'string' ? String(tags).split(/[;,]/).map(s => s.trim()).filter(Boolean) : [];
  if (tagList.length) {
    entries = entries.filter(e => {
      const set = new Set(Array.isArray(e.tags) ? e.tags.map(t => String(t)) : []);
      if (String(tagsMode).toLowerCase() === 'all') return tagList.every(t => set.has(t));
      return tagList.some(t => set.has(t));
    });
  }
  if (String(hasRemarks || '').toLowerCase() === 'true') entries = entries.filter(e => (e.remarks || '').trim().length > 0);
  if (String(hasImage || '').toLowerCase() === 'true') entries = entries.filter(e => !!e.source_image_path);
  if (fmt === 'md') {
    // Group by date and concatenate markdown to support跨天导出
    const byDate = new Map();
    for (const e of entries) {
      if (!byDate.has(e.date)) byDate.set(e.date, []);
      byDate.get(e.date).push(e);
    }
    const parts = [];
    const sortedDates = Array.from(byDate.keys()).sort();
    for (const d of sortedDates) {
      const list = byDate.get(d);
      const md = renderDailyMarkdown(d, list);
      parts.push(md);
    }
    const content = parts.length ? parts.join('\n\n') : '# 导出为空';
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    return res.send(content);
  } else {
    const lines = ['date,created_at,original_text,translated_text,source_image_path,tags,remarks'];
    for (const e of entries) {
      const orig = JSON.stringify(e.original_text || '').slice(1, -1);
      const trans = JSON.stringify(e.translated_text || '').slice(1, -1);
      const src = JSON.stringify(e.source_image_path || '').slice(1, -1);
      const tags = Array.isArray(e.tags) ? JSON.stringify(e.tags.join(';')).slice(1, -1) : '';
      const remarks = JSON.stringify(e.remarks || '').slice(1, -1);
      lines.push(`${e.date},${e.created_at},"${orig}","${trans}","${src}","${tags}","${remarks}"`);
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    return res.send(lines.join('\n'));
  }
});

// Review context: extract vocabulary from entries (by date or date range)
app.get('/api/review/words', (req, res) => {
  const { date, start, end, limit = '50' } = req.query;
  const result = extractWords({ date: date ? String(date) : undefined, start: start ? String(start) : undefined, end: end ? String(end) : undefined, limit: Number(limit) || 50 });
  res.json(result);
});

// Chat-based review assistant
app.post('/api/review/chat', async (req, res) => {
  const { messages = [], date, start, end, limit = 50, level = 'N5-N4', encouragement = true } = req.body || {};
  try {
    const reply = await chatReview({ messages, date, start, end, limit, level, encouragement });
    res.json({ reply });
  } catch (e) {
    res.status(500).json({ error: 'chat_failed' });
  }
});

app.listen(PORT, () => {
  console.log(`ClipStudy API listening on http://localhost:${PORT}`);
});