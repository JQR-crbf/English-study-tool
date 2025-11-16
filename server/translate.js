import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const ZHIPU_API_KEY = process.env.ZHIPU_API_KEY;
const SILICONFLOW_API_KEY = process.env.SILICONFLOW_API_KEY;
const MODEL_ZHIPU = process.env.MODEL_ZHIPU || 'glm-4.6';
const MODEL_SILICONFLOW = process.env.MODEL_SILICONFLOW || 'zai-org/GLM-4.6';

const zhipuUrl = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const siliconUrl = 'https://api.siliconflow.cn/v1/chat/completions';

const SYSTEM_PROMPT = '你是一个严谨的英语到中文翻译助手。请按句子进行翻译，尽量直译并保留关键英文术语（括注或保留英文词）。输出仅给中文译文，不要额外解释。';

export async function translateEnToZh(text, opts = {}) {
  const preferred = (opts.preferredEngine || 'auto').toLowerCase();
  const offlineOnly = Boolean(opts.offlineOnly);

  if (offlineOnly) {
    // 隐私模式：不调用在线翻译，返回空译文（允许用户仅保存原文或稍后手动翻译）
    return '';
  }

  async function callZhipu() {
    const res = await fetch(zhipuUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ZHIPU_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL_ZHIPU,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: text }
        ],
        temperature: 0.2,
        stream: false
      })
    });
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (content && typeof content === 'string') return content.trim();
    throw new Error('Zhipu translation failed');
  }

  async function callSilicon() {
    const res2 = await fetch(siliconUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SILICONFLOW_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL_SILICONFLOW,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: text }
        ],
        temperature: 0.2,
        stream: false
      })
    });
    const data2 = await res2.json();
    const content2 = data2?.choices?.[0]?.message?.content;
    if (content2 && typeof content2 === 'string') return content2.trim();
    throw new Error('SiliconFlow translation failed');
  }

  try {
    if (preferred === 'zhipu') {
      return await callZhipu();
    }
    if (preferred === 'siliconflow') {
      return await callSilicon();
    }
    // auto: zhipu -> silicon
    try {
      return await callZhipu();
    } catch (e) {
      return await callSilicon();
    }
  } catch (finalErr) {
    return '';
  }
}