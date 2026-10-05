import Database from "better-sqlite3"; import fs from "node:fs"; import path from "node:path";
export type DB=Database.Database;
/**
 * Mở (hoặc tạo mới) file SQLite, bật khóa ngoại và chế độ WAL.
 * @param filename Đường dẫn file database; mặc định lấy từ `DATABASE_PATH`.
 */
export function openDb(filename=process.env.DATABASE_PATH || path.resolve(process.cwd(),"data/lexiloop.db")){fs.mkdirSync(path.dirname(filename),{recursive:true});const db=new Database(filename);db.pragma("foreign_keys = ON");db.pragma("journal_mode = WAL");return db;}
/** Chạy các file SQL trong thư mục `migrations` chưa được áp dụng, theo thứ tự tên file. */
export function migrate(db:DB){db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");const dir=path.resolve(__dirname,"../../migrations");for(const file of fs.readdirSync(dir).filter(x=>x.endsWith('.sql')).sort()){if(!db.prepare("SELECT 1 FROM schema_migrations WHERE version=?").get(file)){const sql=fs.readFileSync(path.join(dir,file),'utf8');db.transaction(()=>{db.exec(sql);db.prepare("INSERT OR IGNORE INTO schema_migrations(version) VALUES (?)").run(file)})();}}}
