import type { Connection } from 'mysql2/promise';

export const GENERAL_CI_COLLATION = 'utf8mb4_general_ci';

export function normalizeMysqlCollations(ddl: string): string {
    let s = ddl;
    s = s.replace(/\butf8mb4_[a-z0-9_]+\b/gi, GENERAL_CI_COLLATION);
    s = s.replace(
        /\bDEFAULT CHARSET=utf8mb4(?!\s+COLLATE)/gi,
        `DEFAULT CHARSET=utf8mb4 COLLATE=${GENERAL_CI_COLLATION}`
    );
    s = s.replace(/\butf8_(?!mb4)[a-z0-9_]+\b/gi, 'utf8_general_ci');
    return s;
}

export async function ensureGeneralCiSession(conn: Connection): Promise<void> {
    await conn.query(`SET NAMES utf8mb4 COLLATE ${GENERAL_CI_COLLATION}`);
    await conn.query(`SET collation_connection = ?`, [GENERAL_CI_COLLATION]);
}
