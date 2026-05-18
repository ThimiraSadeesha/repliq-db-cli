const PORTABLE_UTF8MB4_COLLATION = 'utf8mb4_unicode_ci';

export function normalizeMysqlCollations(ddl: string): string {
    let s = ddl;
    s = s.replace(/\butf8mb4_uca1400_[a-z0-9_]+\b/gi, PORTABLE_UTF8MB4_COLLATION);
    s = s.replace(/\butf8mb4_0900_[a-z0-9_]+\b/gi, PORTABLE_UTF8MB4_COLLATION);
    s = s.replace(/\butf8mb4_[a-z0-9_]+_0900_[a-z0-9_]+\b/gi, PORTABLE_UTF8MB4_COLLATION);
    return s;
}
