import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

export async function testConnection(host: string, port: number, user: string, password: string, database: string) {
    try {
        const connection = await mysql.createConnection({ host, port, user, password, database });
        await connection.ping();
        await connection.end();
        console.log(`✅ Connection successful: ${host}:${port} -> ${database}`);
        return true;
    } catch (err) {
        console.error(`❌ Connection failed: ${host}:${port} -> ${database}`);
        console.error(err);
        return false;
    }
}

(async () => {
    console.log('🔄 Testing source database...');
    const srcOk = await testConnection(
        process.env.SRC_DB_HOST!,
        Number(process.env.SRC_DB_PORT!),
        process.env.SRC_DB_USER!,
        process.env.SRC_DB_PWD!,
        process.env.SRC_DB_NAME!
    );

    console.log('🔄 Testing target database...');
    const tgtOk = await testConnection(
        process.env.TGT_DB_HOST!,
        Number(process.env.TGT_DB_PORT!),
        process.env.TGT_DB_USER!,
        process.env.TGT_DB_PWD!,
        process.env.TGT_DB_NAME!
    );
    if (srcOk && tgtOk) {
        console.log('🎯 Both databases are reachable. Ready to copy!');
    } else {
        console.log('⚠️ One or both databases are not reachable. Fix connection settings.');
    }
})();
