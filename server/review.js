import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import dayjs from 'dayjs';
import { listEntriesByDate, searchEntries } from './db.js';

dotenv.config();

const ZHIPU_API_KEY = process.env.ZHIPU_API_KEY;
const SILICONFLOW_API_KEY = process.env.SILICONFLOW_API_KEY;
const MODEL_ZHIPU = process.env.MODEL_ZHIPU || 'glm-4.6';
const MODEL_SILICONFLOW = process.env.MODEL_SILICONFLOW || 'zai-org/GLM-4.6';

const zhipuUrl = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const siliconUrl = 'https://api.siliconflow.cn/v1/chat/completions';

// Extract candidate vocabulary from entries
export function extractWords({ date, start, end, limit = 50 }) {
  let entries = [];
  if (date) {
    entries = listEntriesByDate(String(date));
  } else {
    entries = searchEntries({}); // all entries
    if (start && end) {
      const s = String(start); const e = String(end);
      entries = entries.filter(x => x.date >= s && x.date <= e);
    }
  }
  const freq = new Map();
  const pushWord = (w) => {
    const ww = String(w).trim().toLowerCase();
    if (!ww) return;
    if (!/^[a-z\-']{2,}$/.test(ww)) return;
    freq.set(ww, (freq.get(ww) || 0) + 1);
  };
  for (const e of entries) {
    if (Array.isArray(e.tokens) && e.tokens.length) {
      for (const t of e.tokens) pushWord(t);
    } else {
      const text = String(e.original_text || '');
      const words = text.split(/[^A-Za-z\-']+/).filter(Boolean);
      for (const w of words) pushWord(w);
    }
  }
  const sorted = Array.from(freq.entries()).sort((a,b)=>b[1]-a[1]).map(([w,c])=>({ word: w, count: c }));
  const words = sorted.slice(0, limit).map(x => x.word);
  return { words, total: sorted.length, sourceCount: entries.length };
}

function buildSystemPrompt(words, opts = {}) {
  const target = opts.level || 'N5-N4';
  const encouragement = opts.encouragement !== false;
  const wordList = words && words.length ? `\n本次复习的重点词汇（仅供参考，可选择其中若干）：\n${words.map(w => `- ${w}`).join('\n')}` : '';
  return [
    '你是一位友好、耐心且鼓励性的英语学习教练，帮助我以对话的方式复习当天条目里的单词。',
    '要求：',
    '1) 用中文解释为主，结合英文例句；每次回复尽量简洁，控制在 6-10 句以内。',
    '2) 主动发起小测验：给出 2-3 个简短问题（选择或填空），引导我回答。',
    '3) 纠错时要温柔，给出正确示例，并点出易错点。',
    '4) 结合我给出的上下文词汇进行练习，不必一次覆盖全部。',
    '5) 每次结尾给出一句鼓励或学习建议。',
    `目标水平：${target}`,
    wordList
  ].join('\n');
}

async function callZhipu(messages, systemPrompt) {
  const res = await fetch(zhipuUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ZHIPU_API_KEY}` },
    body: JSON.stringify({ model: MODEL_ZHIPU, messages: [ { role: 'system', content: systemPrompt }, ...messages ], temperature: 0.6, stream: false })
  });
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (content && typeof content === 'string') return content.trim();
  throw new Error('Zhipu chat failed');
}

async function callSilicon(messages, systemPrompt) {
  const res2 = await fetch(siliconUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SILICONFLOW_API_KEY}` },
    body: JSON.stringify({ model: MODEL_SILICONFLOW, messages: [ { role: 'system', content: systemPrompt }, ...messages ], temperature: 0.6, stream: false })
  });
  const data2 = await res2.json();
  const content2 = data2?.choices?.[0]?.message?.content;
  if (content2 && typeof content2 === 'string') return content2.trim();
  throw new Error('SiliconFlow chat failed');
}

export async function chatReview({ messages = [], date, start, end, limit = 50, level = 'N5-N4', encouragement = true }) {
  const { words } = extractWords({ date, start, end, limit });
  const systemPrompt = buildSystemPrompt(words, { level, encouragement });
  try {
    if (ZHIPU_API_KEY) {
      try { return await callZhipu(messages, systemPrompt); } catch (_e) {}
    }
    if (SILICONFLOW_API_KEY) {
      try { return await callSilicon(messages, systemPrompt); } catch (_e) {}
    }
    // Fallback: rule-based simple coach
    const sample = words.slice(0, 8).map(w => `- ${w}`).join('\n');
    return [
      '我们来做一个小型单词复习，请先试着用下面的词造句或选择含义：',
      sample || '- (暂无词汇，上下文为空，可先告诉我你今天想复习的内容)',
      '小测验：',
      '1) 请用其中任意两个词造一个英文句子。',
      '2) 选择：下列哪个词表示“示例/样本”？ A) sample B) forget C) push',
      '3) 填空：Please ____ this word in a sentence.',
      '期待你的回答，我会根据你的回复给出纠正与讲解。加油，持续学习一定会看到进步！'
    ].join('\n');
  } catch (e) {
    return '抱歉，当前无法连接到对话服务。你可以先告诉我今天想复习的词汇或句子，我会用本地教练模式继续帮助你。';
  }
}