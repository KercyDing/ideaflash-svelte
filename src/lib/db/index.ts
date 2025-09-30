import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';

// 初始化数据库连接
const sqlite = new Database('ideaflash.db');
export const db = drizzle(sqlite, { schema });
