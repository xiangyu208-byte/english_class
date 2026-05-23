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

// ============ Admin: Dashboard ============
export async function getAdminDashboard() {
  const resp = await client.get('/admin/dashboard', { params: { role: 'admin' } });
  return unwrap<import('../types').AdminDashboardStats>(resp);
}

// ============ Admin: Dictionary Management ============
export async function listDictEntries(params: { q?: string; source?: string; page?: number; page_size?: number }) {
  const resp = await client.get('/dictionary/list', { params: { ...params, role: 'admin' } });
  return unwrap<{ total: number; items: import('../types').DictEntry[] }>(resp);
}

export async function addDictEntry(entry: import('../types').DictEntry) {
  const resp = await client.post('/dictionary/add', entry);
  return unwrap<null>(resp);
}

export async function updateDictEntry(original_word: string, original_source: string, entry: import('../types').DictEntry) {
  const resp = await client.post('/dictionary/update', { original_word, original_source, ...entry });
  return unwrap<null>(resp);
}

export async function deleteDictEntry(word: string, source: string) {
  const resp = await client.post('/dictionary/delete', { word, source });
  return unwrap<null>(resp);
}

// ============ Word Contribution (to global dictionary) ============
export async function submitContribution(payload: { word: string; meaning: string; example: string; creator: string }) {
  const resp = await client.post('/word/contribute', payload);
  return unwrap<null>(resp);
}

export async function listContributions(params: { status?: string; page?: number; page_size?: number }) {
  const resp = await client.get('/admin/contributions/list', { params: { ...params, role: 'admin' } });
  return unwrap<{ total: number; items: import('../types').ContributionItem[] }>(resp);
}

export async function approveContribution(word: string, creator: string, meaning: string, example: string, pos: string) {
  const resp = await client.post('/admin/contributions/approve', { role: 'admin', word, creator, meaning, example, pos });
  return unwrap<null>(resp);
}

export async function rejectContribution(word: string, creator: string) {
  const resp = await client.post('/admin/contributions/reject', { role: 'admin', word, creator });
  return unwrap<null>(resp);
}

// ============ Community: Posts ============
export async function createPost(payload: { username: string; content: string; type?: string; word?: string; meaning?: string; example?: string }) {
  const resp = await client.post('/community/post/create', payload);
  return unwrap<{ id: string; created_at: string }>(resp);
}

export async function listCommunityPosts(params: { page?: number; page_size?: number; type?: string; username?: string }) {
  const resp = await client.get('/community/posts', { params });
  return unwrap<{ total: number; items: import('../types').CommunityPost[] }>(resp);
}

export async function deleteCommunityPost(post_id: string, username: string) {
  const resp = await client.post('/community/post/delete', { post_id, username });
  return unwrap<null>(resp);
}

// ============ Community: Comments ============
export async function createComment(payload: { post_id: string; username: string; content: string }) {
  const resp = await client.post('/community/comment/create', payload);
  return unwrap<{ id: string; created_at: string }>(resp);
}

export async function listComments(post_id: string) {
  const resp = await client.get('/community/comments', { params: { post_id } });
  return unwrap<import('../types').CommunityComment[]>(resp);
}

export async function deleteComment(comment_id: string, username: string) {
  const resp = await client.post('/community/comment/delete', { comment_id, username });
  return unwrap<null>(resp);
}

// ============ Community: Likes & Favorites ============
export async function toggleLike(post_id: string, username: string) {
  const resp = await client.post('/community/toggle_like', { post_id, username });
  return unwrap<{ liked: boolean; likes_count: number }>(resp);
}

export async function toggleFavorite(post_id: string, username: string) {
  const resp = await client.post('/community/toggle_favorite', { post_id, username });
  return unwrap<{ favorited: boolean }>(resp);
}

export async function listFavoritePosts(username: string, page = 1) {
  const resp = await client.get('/community/my_favorites', { params: { username, page } });
  return unwrap<{ total: number; items: import('../types').CommunityPost[] }>(resp);
}

// ============ Community: Friends ============
export async function sendFriendRequest(from_user: string, to_user: string) {
  const resp = await client.post('/community/friend/request', { from_user, to_user });
  return unwrap<null>(resp);
}

export async function acceptFriendRequest(from_user: string, to_user: string) {
  const resp = await client.post('/community/friend/accept', { from_user, to_user });
  return unwrap<null>(resp);
}

export async function removeFriend(user1: string, user2: string) {
  const resp = await client.post('/community/friend/remove', { user1, user2 });
  return unwrap<null>(resp);
}

export async function listFriends(username: string) {
  const resp = await client.get('/community/friends', { params: { username } });
  return unwrap<import('../types').FriendItem[]>(resp);
}

export async function listFriendRequests(username: string) {
  const resp = await client.get('/community/friend/requests', { params: { username } });
  return unwrap<import('../types').FriendRequest[]>(resp);
}

// ============ Admin: Community Management ============
export async function adminListCommunityPosts(params: { page?: number; page_size?: number }) {
  const resp = await client.get('/admin/community/posts', { params: { ...params, role: 'admin' } });
  return unwrap<{ total: number; items: import('../types').CommunityPost[] }>(resp);
}

export async function adminDeleteCommunityPost(post_id: string) {
  const resp = await client.post('/admin/community/post/delete', { role: 'admin', post_id });
  return unwrap<null>(resp);
}

export async function adminDeleteComment(comment_id: string) {
  const resp = await client.post('/admin/community/comment/delete', { role: 'admin', comment_id });
  return unwrap<null>(resp);
}

// ============ Admin: Review Center ============
export async function listReviewItems(params: { status?: string; page?: number; page_size?: number }) {
  const resp = await client.get('/admin/review/list', { params: { ...params, role: 'admin' } });
  return unwrap<{ total: number; items: import('../types').ReviewItem[] }>(resp);
}

export async function approveReviewWord(word: string, creator: string) {
  const resp = await client.post('/admin/review/approve', { role: 'admin', word, creator });
  return unwrap<null>(resp);
}

export async function rejectReviewWord(word: string, creator: string) {
  const resp = await client.post('/admin/review/reject', { role: 'admin', word, creator });
  return unwrap<null>(resp);
}

// ============ Admin: User Management ============
export async function adminDisableUser(username: string) {
  const resp = await client.post('/admin/user/disable', { role: 'admin', username });
  return unwrap<null>(resp);
}

export async function adminEnableUser(username: string) {
  const resp = await client.post('/admin/user/enable', { role: 'admin', username });
  return unwrap<null>(resp);
}

export async function adminResetPassword(username: string, new_password = '123456') {
  const resp = await client.post('/admin/user/reset_password', { role: 'admin', username, new_password });
  return unwrap<null>(resp);
}

export async function adminGetUserProfile(username: string) {
  const resp = await client.get('/admin/user/profile', { params: { role: 'admin', username } });
  return unwrap<import('../types').UserProfile>(resp);
}

// ============ Admin: Game Records ============
export async function adminListGameRecords(params: { page?: number; page_size?: number }) {
  const resp = await client.get('/admin/game_records', { params: { ...params, role: 'admin' } });
  return unwrap<{ total: number; items: import('../types').GameRecordItem[] }>(resp);
}

export async function adminDeleteGameRecord(username: string, game_time: string) {
  const resp = await client.post('/admin/game_records/delete', { role: 'admin', username, game_time });
  return unwrap<null>(resp);
}

// ============ Admin: System Config ============
export async function adminGetConfig() {
  const resp = await client.get('/admin/config', { params: { role: 'admin' } });
  return unwrap<import('../types').SystemConfig>(resp);
}

export async function adminUpdateConfig(cfg: Partial<import('../types').SystemConfig>) {
  const resp = await client.post('/admin/config', { role: 'admin', ...cfg });
  return unwrap<null>(resp);
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

export type WordBank = 'global' | 'personal' | 'cet4' | 'cet6';

export async function validateGameWord(prev: string, word: string, wordBank: WordBank = 'global', personalWords?: string[]) {
  if (!word || word.length < 4) {
    return { valid: false, score: 0, reason: '单词长度至少 4 个字符' };
  }
  if (!prev || word.charAt(0).toLowerCase() !== prev.charAt(prev.length - 1).toLowerCase()) {
    return { valid: false, score: 0, reason: '首字母与上一个单词末尾字母不一致' };
  }

  if (wordBank === 'personal') {
    if (personalWords && personalWords.some(w => w.toLowerCase() === word.toLowerCase())) {
      return { valid: true, score: 500, inDictionary: true };
    }
    return { valid: false, score: 0, reason: `"${word}" 不在你的个人词库中` };
  }

  if (wordBank === 'cet4' || wordBank === 'cet6') {
    try {
      const results = await searchDictionary(word, wordBank);
      if (results.length > 0) {
        return { valid: true, score: 500, inDictionary: true };
      }
      return { valid: false, score: 0, reason: `"${word}" 不在${wordBank === 'cet4' ? '四级' : '六级'}词库中` };
    } catch {
      return { valid: false, score: 0, reason: '词典服务不可用，请稍后再试' };
    }
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (resp.ok) {
      return { valid: true, score: 700, reason: undefined, inDictionary: true };
    }

    return { valid: false, score: 0, reason: `"${word}" 不是有效单词` };
  } catch {
    return { valid: true, score: 500, reason: undefined, inDictionary: false, warning: '词典服务不可用，仅校验基本规则' };
  }
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
