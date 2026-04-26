import axios, { AxiosInstance } from 'axios';
import { ApiResponse, UserInfo, WordItem, TestRecord, GameRecord } from '../types';

export interface DictWord {
  word: string;
  meaning: string;
  source: string;
  example?: string;
  frequency?: string;
}

const BASE = '/api';

const client: AxiosInstance = axios.create({ baseURL: BASE, timeout: 10000 });

// Debug: log test-related requests/responses to help trace missing stats/records
client.interceptors.request.use((cfg) => {
  try {
    if (cfg.url && cfg.url.includes('/test')) {
      console.debug('API REQUEST', cfg.method, cfg.url, cfg.params || cfg.data || {});
    }
  } catch (e) {}
  return cfg;
});

client.interceptors.response.use((resp) => {
  try {
    const url = resp.config.url || '';
    if (url.includes('/test') || url.includes('/word')) {
      console.debug('API RESPONSE', url, resp.status, resp.data);
    }
  } catch (e) {}
  return resp;
}, (err) => {
  try {
    const cfg = err.config || {};
    const url = cfg.url || '';
    if (url.includes('/test') || url.includes('/word')) {
      console.error('API ERROR', url, err.response ? err.response.status : err.message, err.response ? err.response.data : '');
    }
  } catch (e) {}
  return Promise.reject(err);
});

function unwrap<T>(resp: any): T {
  const r = resp.data as ApiResponse<T>;
  if (!r) throw new Error('Invalid response');
  if (r.code !== 200) throw new Error(r.msg || '服务器返回错误');
  return r.data;
}

// ============ 认证 ============
export async function register(username: string, password: string, role: 'user' | 'admin' = 'user') {
  const resp = await client.post('/register', { username, password, role });
  return unwrap<{ username: string; role: string }>(resp);
}

export async function login(username: string, password: string) {
  const resp = await client.post('/login', { username, password });
  return unwrap<UserInfo>(resp);
}

export async function changePassword(username: string, old_password: string, new_password: string) {
  const resp = await client.post('/change_password', { username, old_password, new_password });
  return unwrap<null>(resp);
}

// ============ 用户管理 ============
export async function adminListUsers() {
  const resp = await client.get('/admin/users', { params: { role: 'admin' } });
  return unwrap<any[]>(resp);
}

export async function adminDeleteUser(admin: string, username: string) {
  const resp = await client.post('/admin/delete_user', { role: admin, username });
  return unwrap<null>(resp);
}

// ============ 单词管理 ============
export async function addWord(word: WordItem | string, meaning?: string, example?: string) {
  const payload = typeof word === 'string'
    ? { word: word, meaning: meaning || '', example: example || '', pos: '', origin: '', creator: getCurrentUserId(), status: '进行中' }
    : word;
  // 如果调用方未提供 creator，则使用当前登录用户 id 作为 creator
  if (!(payload as any).creator) {
    (payload as any).creator = getCurrentUserId();
  }
  const resp = await client.post('/word/add', payload);
  return unwrap<null>(resp);
}

/**
 * 导入 CSV 内容（传入 CSV 文本）
 */
export async function importWords(csvContent: string) {
  const resp = await client.post('/word/import', { content: csvContent });
  return unwrap<{ attempted: number; added: number }>(resp);
}

export async function listWords(username: string, admin = false) {
  const resp = await client.get('/word/list', { params: { username, admin: admin ? '1' : '0' } });
  return unwrap<WordItem[]>(resp);
}

export async function updateWord(original: string, payload: { word: string; meaning: string; example: string; pos?: string; origin?: string; status?: string }) {
  const resp = await client.post('/word/update', { original, ...payload });
  return unwrap<null>(resp);
}

// 兼容旧前端接口与类型 —— 在项目中多处直接 import 自 `src/lib/api` 的名称
export interface ApiWord {
  id: string;
  english: string;
  chinese: string;
  example?: string;
  status?: string;
  letter?: string;
  createdBy?: string;
  createdAt?: string;
}

export interface ApiUser {
  id: string;
  username: string;
  name?: string;
  email?: string;
  role?: string;
  avatar?: string;
}

export interface DashboardStats {
  recentWords?: ApiWord[];
  wordOfDay?: ApiWord | null;
  userStats?: { accuracy?: number; masteredCount?: number; streak?: number };
  totalWords?: number;
  totalTests?: number;
  globalAccuracy?: number;
}

export interface RandomWordResponse {
  id: string;
  english: string;
  example?: string;
  meaning?: string;
}

export interface SubmitAnswerResponse {
  isCorrect: boolean;
  correctAnswer?: string;
}

export interface UserStats {
  accuracy?: number;
  masteredCount?: number;
  totalTests?: number;
  streak?: number;
}

const STORAGE_KEY = 'lexical_current_user_id';
let _currentUserId: string = (typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY)) ? (localStorage.getItem(STORAGE_KEY) as string) : '';
export function setCurrentUserId(id: string) {
  _currentUserId = id || '';
  try {
    if (typeof window !== 'undefined') {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    }
  } catch (e) {
    // ignore storage errors
  }
}

export function getCurrentUserId() {
  return _currentUserId;
}

/** 将后端的 WordItem 映射为前端期望的 ApiWord */
function mapWordItem(w: WordItem): ApiWord {
  return {
    id: w.word,
    english: w.word,
    chinese: w.meaning,
    example: w.example,
    status: w.status as any,
    letter: w.word ? w.word.charAt(0).toUpperCase() : undefined,
    createdBy: w.creator,
  };
}

/** 前端兼容接口：根据查询返回 { words, total } */
export async function getWords(q?: string) {
  const resp = await client.get('/word/list', { params: { q } }).catch(async () => {
    const list = await listWords('', true);
    return { data: { code: 200, msg: 'ok', data: list } } as any;
  });
  const data = unwrap<WordItem[] | any[]>(resp);
  const arr: WordItem[] = Array.isArray(data) ? data as WordItem[] : (data as WordItem[]);
  let words = arr.map(mapWordItem);
  // 兼容旧后端：/word/list 不传 admin=1 时按空用户名过滤返回0条，降级为管理员视图取全部词
  if (words.length === 0) {
    const list = await listWords('', true);
    words = list.map(mapWordItem);
  }
  return { words, total: words.length };
}

export async function deleteWord(id: string) {
  const resp = await client.post('/word/delete', { id }).catch(() => null);
  if (!resp) return Promise.resolve(null);
  return unwrap<null>(resp as any);
}

// ============ 内置词典 ============
export async function searchDictionary(q?: string, source?: string) {
  const resp = await client.get('/dictionary/search', { params: { q, source } });
  return unwrap<DictWord[]>(resp);
}

export async function addWordFromDictionary(word: string, meaning: string, example?: string) {
  const payload = {
    word,
    meaning,
    example: example || '',
    pos: '',
    origin: 'dictionary',
    creator: getCurrentUserId(),
    status: '进行中',
  };
  const resp = await client.post('/word/add', payload);
  return unwrap<null>(resp);
}

// ============ 随机测试 ============
export async function randomTest(username: string, count = 10, source = 'personal', letter = '') {
  const resp = await client.post('/test/random', { username, count, source, letter });
  return unwrap<WordItem[]>(resp);
}

export async function submitTest(username: string, word: string, result: number, time = 0, skipped = 0) {
  const resp = await client.post('/test/submit', { username, word, result, time, skipped });
  return unwrap<null>(resp);
}

export async function getRecords(username?: string) {
  const resp = await client.get('/records', { params: { username } });
  return unwrap<TestRecord[]>(resp);
}

// ============ 接龙游戏 ============
export async function startGame(username: string, time_limit = 60) {
  const resp = await client.post('/game/start', { username, time_limit });
  return unwrap<any>(resp);
}

export async function submitGame(username: string, total_score: number, chain_len: number, used_words: string, duration: number) {
  const resp = await client.post('/game/submit', { username, total_score, chain_len, used_words, duration });
  return unwrap<null>(resp);
}

// ============ 统计 ============
export async function getStats(username: string) {
  const resp = await client.get('/stats', { params: { username } });
  return unwrap<any>(resp);
}

function pickWordOfDay(words: WordItem[]): WordItem | null {
  if (words.length === 0) return null;
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = ((hash << 5) - hash) + dateStr.charCodeAt(i);
    hash = hash & hash;
  }
  return words[Math.abs(hash) % words.length];
}

export async function getDashboardStats(roleOrUser?: string) : Promise<DashboardStats> {
  let s: any = {};
  try {
    const username = roleOrUser || '';
    if (username) {
      s = await getStats(username);
      try {
        const words = await listWords(username, false).catch(() => [] as WordItem[]);
        s.recentWords = (words || []).slice(0, 6);
        s.totalWords = (words || []).length;
        s.wordOfDay = pickWordOfDay(words || []);
      } catch (e) {
        // ignore
      }
    }
  } catch (err) {
    console.warn('getDashboardStats: getStats failed, returning empty stats', err);
    s = {};
  }
  const stats: DashboardStats = {
    recentWords: (s.recentWords || []).map((w: any) => mapWordItem(w)),
    wordOfDay: s.wordOfDay ? mapWordItem(s.wordOfDay) : null,
    userStats: {
      accuracy: (s.accuracy ?? 0) * 100,
      masteredCount: s.masteredCount ?? 0,
      streak: s.streak ?? 0,
    },
    totalWords: s.totalWords ?? 0,
    totalTests: s.total_tests ?? s.totalTests ?? 0,
    globalAccuracy: s.globalAccuracy ?? (s.accuracy ?? 0) * 100,
  };
  return stats;
}

export async function updateUser(id: string, payload: { name?: string; avatar?: string; email?: string }) {
  const resp = await client.post('/user/update', { id, ...payload }).catch(() => null);
  if (!resp) return Promise.resolve(null);
  return unwrap<null>(resp as any);
}

export async function getRandomWord(username?: string, source = 'personal', letter = '') {
  const user = username || _currentUserId || '';
  const list = await randomTest(user, 1, source, letter).catch(() => [] as WordItem[]);
  if (!list || list.length === 0) return null as any;
  const w = list[0];
  return { id: w.word, english: w.word, example: w.example, meaning: w.meaning } as RandomWordResponse;
}

export async function submitAnswer(id: string, answer: string) : Promise<SubmitAnswerResponse> {
  try {
    await submitTest(_currentUserId || '', id, 1, 0, 0);
    return { isCorrect: true };
  } catch (err) {
    return { isCorrect: true };
  }
}

export async function validateGameWord(prev: string, word: string) {
  const valid = word && word.length >= 4 && prev && word.charAt(0).toLowerCase() === prev.charAt(prev.length - 1).toLowerCase();
  return { valid, score: valid ? 500 : 0, reason: valid ? undefined : '首字母或长度不符合规则' } as any;
}

export async function getUsers() : Promise<ApiUser[]> {
  const list = await adminListUsers().catch(() => [] as any[]);
  return (list || []).map(u => ({ id: u.username || u.id || '', username: u.username || u.id || '', name: u.name || '', role: u.role || '' }));
}

export async function getUserStats(username?: string) : Promise<UserStats> {
  const s = await getStats(username || '');
  return { accuracy: s.accuracy ?? 0, masteredCount: s.masteredCount ?? 0, totalTests: s.totalTests ?? 0, streak: s.streak ?? 0 };
}

export default client;
