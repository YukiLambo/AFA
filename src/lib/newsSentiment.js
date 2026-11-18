// Headline sentiment for company news, used by the Stock Analysis trade plan.
// A small finance word list (in the spirit of the Loughran–McDonald dictionary) scores each headline
// from −1 to +1; recent headlines count more (3-day half-life). Severe events are flagged separately.

const POSITIVE = [
  'beat', 'beats', 'tops', 'record', 'surge', 'surges', 'soar', 'soars', 'jump', 'jumps', 'rally', 'rallies', 'gain', 'gains',
  'upgrade', 'upgraded', 'outperform', 'buy rating', 'raises guidance', 'raises forecast', 'raised guidance', 'boost', 'boosts',
  'strong', 'growth', 'profit rises', 'profit jumps', 'expands', 'expansion', 'partnership', 'deal', 'wins', 'approval', 'approved',
  'buyback', 'repurchase', 'dividend increase', 'hikes dividend', 'raises dividend', 'launch', 'launches', 'breakthrough',
  'rebound', 'rebounds', 'recovery', 'optimistic', 'bullish', 'higher', 'rises', 'climbs', 'upbeat', 'tailwind', 'milestone'
];
const NEGATIVE = [
  'miss', 'misses', 'falls', 'fall', 'drop', 'drops', 'plunge', 'plunges', 'slump', 'slumps', 'tumble', 'tumbles', 'sink', 'sinks',
  'downgrade', 'downgraded', 'underperform', 'sell rating', 'cuts guidance', 'cuts forecast', 'lowers guidance', 'warning',
  'weak', 'loss', 'losses', 'decline', 'declines', 'layoffs', 'job cuts', 'lawsuit', 'sued', 'probe', 'investigation', 'fine', 'fined',
  'penalty', 'ban', 'banned', 'crackdown', 'sanction', 'sanctions', 'tariff', 'tariffs', 'recall', 'delay', 'delays', 'halt',
  'concern', 'concerns', 'risk', 'bearish', 'lower', 'slides', 'slowdown', 'headwind', 'pressure', 'dispute', 'outage', 'hack', 'breach'
];
// Rare but serious: these push the plan away from buying regardless of the other signals
const SEVERE = [
  'fraud', 'accounting irregularities', 'delisting', 'delisted', 'trading halt', 'suspended trading', 'bankruptcy', 'insolvency',
  'default', 'liquidation', 'profit warning', 'criminal', 'arrested', 'restatement', 'short seller report'
];

const has = (text, phrase) => new RegExp(`(^|[^a-z])${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(text);

export function scoreHeadline(title = '', summary = '') {
  const text = `${title} ${summary}`.toLowerCase();
  let pos = 0, neg = 0;
  POSITIVE.forEach(w => { if (has(text, w)) pos++; });
  NEGATIVE.forEach(w => { if (has(text, w)) neg++; });
  const severe = SEVERE.filter(w => has(text, w));
  neg += severe.length * 2;
  const total = pos + neg;
  const score = total ? (pos - neg) / total : 0;
  return { score, label: score > 0.2 ? 'Positive' : score < -0.2 ? 'Negative' : 'Neutral', severe };
}

/**
 * @param items [{ title, summary, publishedAt (ms), source, url }]
 * @returns { score (−1…1) | null, count, positive, negative, severe: [{title, words}], scored: items with sentiment }
 */
export function aggregateNews(items = [], now = Date.now()) {
  const recent = items.filter(n => n.title && (!n.publishedAt || now - n.publishedAt < 30 * 86400000));
  if (recent.length === 0) return { score: null, count: 0, positive: 0, negative: 0, severe: [], scored: [] };
  let wSum = 0, sSum = 0;
  const scored = recent.map(n => {
    const s = scoreHeadline(n.title, n.summary);
    const ageDays = n.publishedAt ? (now - n.publishedAt) / 86400000 : 7;
    const w = Math.pow(0.5, ageDays / 3); // 3-day half-life
    wSum += w; sSum += w * s.score;
    return { ...n, sentiment: s };
  }).sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));
  const score = wSum > 0 ? sSum / wSum : 0;
  return {
    score: Math.max(-1, Math.min(1, score)),
    count: scored.length,
    positive: scored.filter(n => n.sentiment.label === 'Positive').length,
    negative: scored.filter(n => n.sentiment.label === 'Negative').length,
    severe: scored.filter(n => n.sentiment.severe.length && (!n.publishedAt || now - n.publishedAt < 14 * 86400000)).map(n => ({ title: n.title, words: n.sentiment.severe })),
    scored
  };
}

// "TENCENT HOLDINGS LTD" -> "Tencent Holdings"; used as the news search term
export function companySearchName(name = '', symbol = '') {
  const cleaned = String(name)
    .replace(/[-–]\s*[A-Z]{1,2}$/, '')
    .replace(/\b(inc|inc\.|corp|corp\.|corporation|co|co\.|ltd|ltd\.|limited|plc|group|holdings?|class [a-z]|-sw|-w|-s)\b/gi, '')
    .replace(/[^\w\s&.-]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^[\s.&-]+|[\s.&-]+$/g, '');
  const nice = cleaned ? cleaned.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : '';
  return nice || String(symbol).replace(/\.HK$/, '');
}
