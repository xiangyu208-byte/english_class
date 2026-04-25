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

export type Page = 'login' | 'dashboard' | 'test' | 'entry' | 'game' | 'settings' | 'users' | 'dictionary';
