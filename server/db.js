import dayjs from 'dayjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 兼容 ESM：在 ES Module 中没有 __dirname，这里自定义
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 统一数据目录：优先使用 CLIPSTUDY_DATA_DIR；否则固定为项目根的 data/
// 注意不要使用 process.cwd()，以避免不同启动方式导致数据目录不一致
const baseDir = process.env.CLIPSTUDY_DATA_DIR
  ? path.resolve(process.env.CLIPSTUDY_DATA_DIR)
  : path.resolve(__dirname, '..', 'data');
const dataDir = baseDir;
const jsonPath = path.join(dataDir, 'db.json');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize JSON storage
function load() {
  if (!fs.existsSync(jsonPath)) {
    fs.writeFileSync(jsonPath, JSON.stringify({ entries: [], seq: 1 }, null, 2));
  }
  try {
    const raw = fs.readFileSync(jsonPath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { entries: [], seq: 1 };
  }
}

function save(db) {
  fs.writeFileSync(jsonPath, JSON.stringify(db, null, 2));
}

export function createEntry(entry) {
  const db = load();
  const now = dayjs();
  const date = entry.date || now.format('YYYY-MM-DD');
  const created_at = entry.created_at || now.format('HH:mm');
  const id = db.seq++;
  const row = {
    id,
    date,
    created_at,
    source_type: entry.source_type || null,
    source_image_path: entry.source_image_path || null,
    original_text: entry.original_text || '',
    translated_text: entry.translated_text || '',
    tokens: entry.tokens || null,
    tags: entry.tags || null,
    status: entry.status || 'normal',
    remarks: entry.remarks || ''
  };
  db.entries.push(row);
  save(db);
  return id;
}

export function updateEntry(id, patch) {
  const db = load();
  const idx = db.entries.findIndex(e => e.id === Number(id));
  if (idx === -1) return false;
  const merged = { ...db.entries[idx], ...patch };
  db.entries[idx] = merged;
  save(db);
  return true;
}

export function deleteEntry(id) {
  const db = load();
  const before = db.entries.length;
  db.entries = db.entries.filter(e => e.id !== Number(id));
  save(db);
  return db.entries.length < before;
}

export function getEntryById(id) {
  const db = load();
  return db.entries.find(e => e.id === Number(id)) || null;
}

export function listEntriesByDate(date) {
  const db = load();
  const rows = db.entries.filter(e => e.date === date);
  rows.sort((a, b) => (a.created_at.localeCompare(b.created_at)) || (a.id - b.id));
  return rows;
}

export function searchEntries({ keyword, tag }) {
  const db = load();
  let rows = db.entries.slice();
  if (keyword) {
    const kw = String(keyword).toLowerCase();
    rows = rows.filter(e => (e.original_text || '').toLowerCase().includes(kw) || (e.translated_text || '').toLowerCase().includes(kw) || (e.remarks || '').toLowerCase().includes(kw));
  }
  if (tag) {
    const tg = String(tag).toLowerCase();
    rows = rows.filter(e => Array.isArray(e.tags) && e.tags.some(t => String(t).toLowerCase().includes(tg)));
  }
  rows.sort((a, b) => (b.date.localeCompare(a.date)) || (b.created_at.localeCompare(a.created_at)));
  return rows;
}

// 一次性迁移：把 MIGRATE_FROM_DIR 下的 db.json 合并到当前数据目录
// 主要用于之前试验阶段将数据写入到了用户目录，避免“昨天的数据不见了”
function migrateFromLegacyDir() {
  try {
    const candidateDirs = [];
    if (process.env.MIGRATE_FROM_DIR) {
      candidateDirs.push(path.resolve(process.env.MIGRATE_FROM_DIR));
    }
    // 兼容之前版本：曾使用 server/data 作为数据目录
    const serverDataDir = path.resolve(__dirname, 'data');
    if (serverDataDir !== dataDir) candidateDirs.push(serverDataDir);
    for (const legacyDir of candidateDirs) {
      if (!legacyDir || legacyDir === dataDir) continue;
      const legacyJson = path.join(legacyDir, 'db.json');
      if (!fs.existsSync(legacyJson)) continue;
      const legacy = JSON.parse(fs.readFileSync(legacyJson, 'utf-8'));
      if (!legacy || !Array.isArray(legacy.entries) || legacy.entries.length === 0) continue;
      const db = load();
      const existingKeys = new Set(db.entries.map(e => `${e.date}|${e.created_at}|${(e.original_text || '').slice(0, 64)}`));
      let migratedCount = 0;
      for (const e of legacy.entries) {
        const key = `${e.date}|${e.created_at}|${(e.original_text || '').slice(0, 64)}`;
        if (existingKeys.has(key)) continue; // 简单去重：日期+时间+原文前缀
        const row = { ...e, id: db.seq++ };
        db.entries.push(row);
        migratedCount++;
      }
      if (migratedCount > 0) {
        save(db);
        try {
          fs.writeFileSync(path.join(dataDir, 'migration.log'), `Migrated ${migratedCount} entries from ${legacyDir} on ${new Date().toISOString()}\n`, { flag: 'a' });
        } catch {}
        console.log(`[db] migrated ${migratedCount} entries from legacy dir: ${legacyDir}`);
      }
    }
  } catch (e) {
    console.warn('[db] migrateFromLegacyDir failed:', e);
  }
}

// 模块加载时尝试进行一次迁移
migrateFromLegacyDir();