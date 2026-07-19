import mysql from 'mysql2/promise';
import type { ConnectionOptions } from 'mysql2';
import chalk from 'chalk';
import { DBConfig } from '../types/types';

const CONNECT_TIMEOUT_MS = 10 * 60 * 1000;

const KEEPALIVE_INITIAL_DELAY_MS = 10_000;

const NET_IO_TIMEOUT_SEC = 600;

export function mysqlOptionsFromDbConfig(config: DBConfig): ConnectionOptions {
    return {
        ...config,
        connectTimeout: CONNECT_TIMEOUT_MS,
        enableKeepAlive: true,
        keepAliveInitialDelay: KEEPALIVE_INITIAL_DELAY_MS,
    };
}

export async function testConnection(config: DBConfig): Promise<boolean> {
    try {
        const connection = await mysql.createConnection(mysqlOptionsFromDbConfig(config));
        await connection.ping();
        await connection.end();
        console.log(chalk.green(`✅ Connection successful: ${config.host}:${config.port} -> ${config.database}`));
        return true;
    } catch (err: any) {
        console.log(chalk.red(`❌ Connection failed: ${config.host}:${config.port} -> ${config.database}`));
        console.log(chalk.red(`   Error: ${err.message}`));
        return false;
    }
}

export async function getGeneratedColumns(
    conn: mysql.Connection,
    database: string,
    table: string
): Promise<Set<string>> {
    const [rows] = await conn.query<any[]>(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND EXTRA LIKE '%GENERATED%'`,
        [database, table]
    );
    return new Set((rows as any[]).map(r => r.COLUMN_NAME as string));
}

export async function getConnection(config: DBConfig) {
    const connection = await mysql.createConnection(mysqlOptionsFromDbConfig(config));
    try {
        await connection.query(
            `SET SESSION net_read_timeout = ?, net_write_timeout = ?`,
            [NET_IO_TIMEOUT_SEC, NET_IO_TIMEOUT_SEC]
        );
    } catch {}
    return connection;
}
