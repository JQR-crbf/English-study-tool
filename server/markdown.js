import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 兼容 ESM：在 ES Module 中没有 __dirname，这里自定义
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 统一数据目录：优先使用 CLIPSTUDY_DATA_DIR；否则固定为项目根的 data/
const baseDir = process.env.CLIPSTUDY_DATA_DIR
  ? path.resolve(process.env.CLIPSTUDY_DATA_DIR)
  : path.resolve(__dirname, '..', 'data');
const notesDir = path.join(baseDir, 'notes');

export function ensureNotesDir() {
  if (!fs.existsSync(notesDir)) fs.mkdirSync(notesDir, { recursive: true });
}

export function renderDailyMarkdown(date, entries) {
  const lines = [];
  lines.push(`# ${date}`);
  lines.push('');
  for (const e of entries) {
    lines.push(`- ${e.created_at}${e.source_image_path ? `  来源: ${e.source_image_path}` : ''}`);
    lines.push('');
    lines.push(`  原文：`);
    for (const ln of (e.original_text || '').split('\n')) lines.push(`  ${ln}`);
    lines.push('');
    lines.push(`  译文：`);
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
  }
  return lines.join('\n');
}

export function writeDailyMarkdown(date, mdText) {
  ensureNotesDir();
  const filePath = path.join(notesDir, `${date}.md`);
  fs.writeFileSync(filePath, mdText, 'utf-8');
  return filePath;
}