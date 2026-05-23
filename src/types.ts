// 与后端 CSV/JSON 对应的 TypeScript 类型定义

export interface ApiResponse<T = any> {
  code: number; // 200 成功, 500 失败
  msg: string;
  data: T;
}

export type Role = 'admin' | 'user';

export interface UserInfo {
  username: string;
  role: Role;
  total_tests: number;
  correct: number;
  accuracy: number;
  streak: number;
}

export interface WordItem {
  word: string;
  meaning: string;
  example: string;
  pos: string;
  origin: string;
  creator: string;
  status: '已掌握' | '进行中';
}

export interface TestRecord {
  username: string;
  word: string;
  result: number; // 1 or 0
  time: number;
  skipped: number;
  ts: string;
}

export interface GameRecord {
  username: string;
  game_time: string;
  total_score: number;
  chain_len: number;
  used_words: string;
  duration: number;
}

export interface User {
  id: string;
  username: string;
  name: string;
  avatar: string;
  email: string;
  role: 'admin' | 'student' | string;
}

export type Page = 'login' | 'dashboard' | 'test' | 'entry' | 'game' | 'settings' | 'users' | 'dictionary' | 'dictionary_manage' | 'review' | 'users_manage' | 'game_records' | 'sys_config' | 'contribute' | 'community' | 'admin_community';

export interface DictEntry {
  word: string;
  meaning: string;
  source: string;
  example: string;
  frequency: string;
}

export interface AdminDashboardStats {
  total_users: number;
  total_words: number;
  today_new_words: number;
  today_tests: number;
  active_users: { username: string; test_count: number }[];
}

export interface ContributionItem {
  word: string;
  meaning: string;
  example: string;
  pos: string;
  creator: string;
  status: string;
}

export interface ReviewItem {
  word: string;
  meaning: string;
  example: string;
  pos: string;
  origin: string;
  creator: string;
  status: string;
}

export interface UserProfile {
  username: string;
  role: string;
  total_tests: number;
  correct: number;
  accuracy: number;
  streak: number;
  disabled: boolean;
  mastered_count: number;
  total_words_tested: number;
  errors: { word: string; ts: string }[];
}

export interface SystemConfig {
  announcement: string;
  maintenance_mode: boolean;
  maintenance_message: string;
}

export interface GameRecordItem {
  username: string;
  game_time: string;
  total_score: number;
  chain_len: number;
  used_words: string;
  duration: number;
}

export interface CommunityPost {
  id: string;
  author: string;
  content: string;
  type: 'post' | 'word_upload';
  word: string;
  meaning: string;
  example: string;
  created_at: string;
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
  is_fav: boolean;
}

export interface CommunityComment {
  id: string;
  post_id: string;
  author: string;
  content: string;
  created_at: string;
}

export interface FriendItem {
  username: string;
  since: string;
}

export interface FriendRequest {
  from: string;
  created_at: string;
}
