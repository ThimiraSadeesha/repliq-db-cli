import type { Connection } from 'mysql2/promise';
import { getConnection } from './connection';
import { ensureGeneralCiSession, normalizeMysqlCollations } from './normalizeMysqlDdl';
import { DBConfig } from '../types/types';

const MAX_BATCH_ROWS = 2000;
const MAX_BATCH_BYTES = 1024 * 1024;

export const DEFAULT_CONCURRENCY = 4;

export interface ConnPair {
    src: Connection;
    tgt: Connection;
}

function toParam(val: unknown): unknown {
    if (val === undefined || val === null) return null;
    if (val instanceof Date || Buffer.isBuffer(val)) return val;
    if (typeof val === 'object') return JSON.stringify(val);
    return val;
}

function approxSize(val: unknown): number {
    if (val === null || val === undefined) return 4;
    if (typeof val === 'string') return val.length + 2;
    if (Buffer.isBuffer(val)) return val.length * 2 + 3;
    return 24;
}

/** Collation + FK checks off for DDL and data loading on the target. */
export async function prepareTargetSession(tgt: Connection): Promise<void> {
    await ensureGeneralCiSession(tgt);
    await tgt.query('SET FOREIGN_KEY_CHECKS = 0');
}

/** Base tables only — `SHOW TABLES` also lists views, which must not be copied as tables. */
export async function listBaseTables(src: Connection): Promise<string[]> {
    const [rows] = await src.query<any[]>(`SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'`);
    return rows.map(r => Object.values(r)[0] as string);
}

/** Drops and recreates the table structure on the target (no data). */
export async function recreateTableSchema(src: Connection, tgt: Connection, tableName: string): Promise<void> {
    const [createStmt] = await src.query<any[]>(`SHOW CREATE TABLE \`${tableName}\``);
    const raw = createStmt?.[0]?.['Create Table'];
    if (!raw) throw new Error(`Could not read CREATE TABLE for ${tableName}`);
    await tgt.query(`DROP TABLE IF EXISTS \`${tableName}\``);
    await tgt.query(normalizeMysqlCollations(String(raw)));
}

export async function openConnPair(srcConfig: DBConfig, tgtConfig: DBConfig): Promise<ConnPair> {
    // dateStrings keeps DATE/DATETIME values byte-exact (no timezone shifts, zero dates survive)
    const src = await getConnection(srcConfig, { dateStrings: true });
    const tgt = await getConnection(tgtConfig);
    await prepareTargetSession(tgt);
    // Data-load connections only: copy rows verbatim like mysqldump (kept off the DDL connection
    // because MySQL stores the session sql_mode with views/triggers/routines).
    await tgt.query(`SET SESSION sql_mode = 'NO_AUTO_VALUE_ON_ZERO'`);
    await tgt.query('SET UNIQUE_CHECKS = 0');
    return { src, tgt };
}

export async function closeConnPair(pair: ConnPair): Promise<void> {
    await pair.src.end().catch(() => {});
    await pair.tgt.end().catch(() => {});
}

/**
 * Streams rows from source and inserts them into the (already created) target table
 * in size-bounded batches inside one transaction. Returns the number of rows copied.
 */
export async function copyTableData(
    pair: ConnPair,
    tableName: string,
    onProgress?: (rowsRead: number, rowsWritten: number, mbRead: number) => void
): Promise<number> {
    const { src, tgt } = pair;
    const stream = (src as any).connection
        .query(`SELECT * FROM \`${tableName}\``)
        .stream({ highWaterMark: 1000 });

    let colList = '';
    let oneRow = '';
    let batch: unknown[][] = [];
    let batchBytes = 0;
    let total = 0;
    let read = 0;
    let bytesRead = 0;
    let lastReport = 0;
    const report = (force = false) => {
        const now = Date.now();
        if (!force && now - lastReport < 250) return;
        lastReport = now;
        onProgress?.(read, total, bytesRead / (1024 * 1024));
    };

    const flush = async () => {
        if (!batch.length) return;
        const sql = `INSERT INTO \`${tableName}\` (${colList}) VALUES ${batch.map(() => oneRow).join(',')}`;
        await tgt.query(sql, batch.flat());
        total += batch.length;
        batch = [];
        batchBytes = 0;
        report(true);
    };

    await tgt.query('SET autocommit = 0');
    try {
        for await (const row of stream) {
            if (!colList) {
                const columns = Object.keys(row);
                colList = columns.map(c => `\`${c}\``).join(',');
                oneRow = `(${columns.map(() => '?').join(',')})`;
            }
            const values = Object.values(row).map(toParam);
            batch.push(values);
            const size = values.reduce<number>((n, v) => n + approxSize(v), 0);
            batchBytes += size;
            bytesRead += size;
            read++;
            report();
            if (batch.length >= MAX_BATCH_ROWS || batchBytes >= MAX_BATCH_BYTES) await flush();
        }
        await flush();
        await tgt.query('COMMIT');
    } catch (err) {
        await tgt.query('ROLLBACK').catch(() => {});
        stream.destroy();
        throw err;
    } finally {
        await tgt.query('SET autocommit = 1').catch(() => {});
    }
    return total;
}

/** Runs `worker` over `items` using up to `concurrency` connection pairs. */
export async function runPool<T>(
    srcConfig: DBConfig,
    tgtConfig: DBConfig,
    items: T[],
    concurrency: number,
    worker: (pair: ConnPair, item: T, index: number) => Promise<void>
): Promise<void> {
    const n = Math.max(1, Math.min(concurrency, items.length));
    const pairs: ConnPair[] = [];
    try {
        for (let i = 0; i < n; i++) pairs.push(await openConnPair(srcConfig, tgtConfig));
        let next = 0;
        let failed: unknown;
        await Promise.all(
            pairs.map(async pair => {
                while (failed === undefined) {
                    const idx = next++;
                    if (idx >= items.length) return;
                    try {
                        await worker(pair, items[idx], idx);
                    } catch (e) {
                        failed = e ?? new Error('copy failed');
                        throw e;
                    }
                }
            })
        );
    } finally {
        await Promise.all(pairs.map(closeConnPair));
    }
}
