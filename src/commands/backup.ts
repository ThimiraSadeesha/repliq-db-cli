import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const backupDir = path.resolve(process.env.BACKUP_DIR || './backups');
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

function formatValue(v: any) {
    if (v === null || v === undefined) return 'NULL';
    if (v instanceof Date) {
        const yyyy = v.getFullYear();
        const mm = String(v.getMonth() + 1).padStart(2, '0');
        const dd = String(v.getDate()).padStart(2, '0');
        const hh = String(v.getHours()).padStart(2, '0');
        const mi = String(v.getMinutes()).padStart(2, '0');
        const ss = String(v.getSeconds()).padStart(2, '0');
        return `'${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}'`;
    }
    return `'${v.toString().replace(/'/g,"\\'")}'`;
}

async function backupDatabase() {
    const host = process.env.SRC_DB_HOST!;
    const port = Number(process.env.SRC_DB_PORT!);
    const user = process.env.SRC_DB_USER!;
    const password = process.env.SRC_DB_PWD!;
    const database = process.env.SRC_DB_NAME!;
    const connection = await mysql.createConnection({ host, port, user, password, database, multipleStatements: true });
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `${database}_${dateStr}.sql`);
    const writeStream = fs.createWriteStream(backupFile, { flags: 'w' });
    console.log(`🔄 Starting backup of database: ${database}`);
    console.log(`📁 Backup location: ${backupFile}`);
    const [tables] = await connection.query<any[]>(`SHOW TABLES`);
    const tableKey = `Tables_in_${database}`;
    for (const table of tables) {
        const tableName = table[tableKey];
        console.log(`📦 Backing up table: ${tableName}`);
        const [createSQL] = await connection.query<any[]>(`SHOW CREATE TABLE \`${tableName}\``);
        writeStream.write(`${createSQL[0]['Create Table']};\n\n`);
        const [rows] = await connection.query<any[]>(`SELECT * FROM \`${tableName}\``);
        if (rows.length > 0) {
            const columns = Object.keys(rows[0]).map(c => `\`${c}\``).join(',');
            const chunkSize = 500;
            for (let i = 0; i < rows.length; i += chunkSize) {
                const chunk = rows.slice(i, i + chunkSize);
                const values = chunk.map(r => `(${Object.values(r).map(formatValue).join(',')})`).join(',');
                writeStream.write(`INSERT INTO \`${tableName}\` (${columns}) VALUES ${values};\n`);
            }
        }
        writeStream.write('\n');
    }
    writeStream.close();
    await connection.end();
    console.log('✅ Backup completed successfully!');
}

backupDatabase().catch(err => console.error('❌ Unexpected error:', err));
