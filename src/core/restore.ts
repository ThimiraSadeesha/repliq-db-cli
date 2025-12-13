import fs from 'fs/promises';
import { getConnection } from '../utils/connection';
import { DBConfig } from '../types/types';


export async function restoreDatabase(config: DBConfig, backupFile: string): Promise<void> {
    const connection = await getConnection(config);

    try {
        const sql = await fs.readFile(backupFile, 'utf-8');
        const statements = sql
            .split(/;\s*\n/)
            .map(s => s.trim())
            .filter(Boolean);

        console.log(`Executing ${statements.length} statements on ${config.database}...`);
        await connection.query('SET FOREIGN_KEY_CHECKS=0;');

        for (const stmt of statements) {
            try {
                await connection.query(stmt);
            } catch (err) {
                console.error('Error executing statement:', stmt);
                console.error(err);
            }
        }
        await connection.query('SET FOREIGN_KEY_CHECKS=1;');
        console.log(`✅ Database ${config.database} restored successfully from ${backupFile}`);
    } finally {
        await connection.end();
    }
}
