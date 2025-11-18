import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import {formatValue} from "../utils/utill";

dotenv.config();

async function copyDatabase() {
    const src = await mysql.createConnection({
        host: process.env.SRC_DB_HOST!,
        port: Number(process.env.SRC_DB_PORT!),
        user: process.env.SRC_DB_USER!,
        password: process.env.SRC_DB_PWD!,
        database: process.env.SRC_DB_NAME!,
        multipleStatements: true
    });
    const tgt = await mysql.createConnection({
        host: process.env.TGT_DB_HOST!,
        port: Number(process.env.TGT_DB_PORT!),
        user: process.env.TGT_DB_USER!,
        password: process.env.TGT_DB_PWD!,
        database: process.env.TGT_DB_NAME!,
        multipleStatements: true
    });
    console.log('🔄 Starting database copy...');
    await tgt.query('SET FOREIGN_KEY_CHECKS=0;');
    const [tables] = await src.query<any[]>(`SHOW TABLES`);
    const tableKey = `Tables_in_${process.env.SRC_DB_NAME}`;
    for (const table of tables) {
        const tableName = table[tableKey];
        console.log(`📦 Copying table: ${tableName}`);
        try {
            const [createSQL] = await src.query<any[]>(`SHOW CREATE TABLE \`${tableName}\``);
            const sql = createSQL[0]['Create Table'];
            await tgt.query(`DROP TABLE IF EXISTS \`${tableName}\``);
            await tgt.query(sql);
            const [rows] = await src.query<any[]>(`SELECT *
                                                   FROM \`${tableName}\``);
            if (rows.length > 0) {
                const columns = Object.keys(rows[0]).map(c => `\`${c}\``).join(',');
                const chunkSize = 500;
                for (let i = 0; i < rows.length; i += chunkSize) {
                    const chunk = rows.slice(i, i + chunkSize);
                    const values = chunk.map(r =>
                        `(${Object.values(r).map(formatValue).join(',')})`
                    ).join(',');
                    await tgt.query(`INSERT INTO \`${tableName}\` (${columns})
                                     VALUES ${values}`);
                }
            }
        } catch (err: any) {
            console.error(`❌ Error copying table ${tableName}:`, err.message);
        }
    }
    await tgt.query('SET FOREIGN_KEY_CHECKS=1;');
    console.log('✅ Database copy completed successfully!');
    await src.end();
    await tgt.end();
}

copyDatabase().catch(err => console.error('❌ Unexpected error during database copy:', err));
