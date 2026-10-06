import { DBConfig, RoutineRow, TriggerRow, EventRow } from '../types/types';
import { RowDataPacket } from 'mysql2/promise';
import { getConnection } from '../utils/connection';
import { normalizeMysqlCollations } from '../utils/normalizeMysqlDdl';

import { copyTableData, runPool, DEFAULT_CONCURRENCY, prepareTargetSession, listBaseTables, recreateTableSchema } from '../utils/copyTable';

export interface CopySummary {
    tablesCopied: number;
    rowsCopied: number;
    viewsCopied: number;
    triggersCopied: number;
    routinesCopied: number;
    eventsCopied: number;
}

export async function copyDatabase(
    sourceConfig: DBConfig,
    targetConfig: DBConfig
): Promise<CopySummary> {
    const srcConn = await getConnection(sourceConfig);
    const tgtConn = await getConnection(targetConfig);

    let tablesCopied = 0;
    let rowsCopied = 0;
    let viewsCopied = 0;
    let triggersCopied = 0;
    let routinesCopied = 0;
    let eventsCopied = 0;

    try {
        await prepareTargetSession(tgtConn);

        const tableNames = await listBaseTables(srcConn);

        // Phase 1: schemas first (no open transactions, so no metadata-lock contention)
        for (const tableName of tableNames) {
            await recreateTableSchema(srcConn, tgtConn, tableName);
        }

        // Phase 2: data, several tables in parallel
        await runPool(sourceConfig, targetConfig, tableNames, DEFAULT_CONCURRENCY, async (pair, tableName) => {
            rowsCopied += await copyTableData(pair, tableName);
            tablesCopied++;
        });

        const [views] = await srcConn.query<RowDataPacket[]>(`SHOW FULL TABLES WHERE Table_type = 'VIEW'`);
        for (const view of views) {
            const viewName = Object.values(view)[0] as string;
            const [createView] = await srcConn.query<RowDataPacket[]>(`SHOW CREATE VIEW \`${viewName}\``);
            await tgtConn.query(`DROP VIEW IF EXISTS \`${viewName}\``);
            await tgtConn.query(normalizeMysqlCollations((createView[0] as any)['Create View']));
            viewsCopied++;
        }
        const [triggerRows] = await srcConn.query<RowDataPacket[]>(`SHOW TRIGGERS`);
        const triggers = triggerRows as TriggerRow[];
        for (const trig of triggers) {
            const [createTrig] = await srcConn.query<RowDataPacket[]>(`SHOW CREATE TRIGGER \`${trig.Trigger}\``);
            await tgtConn.query(`DROP TRIGGER IF EXISTS \`${trig.Trigger}\``);
            await tgtConn.query(normalizeMysqlCollations((createTrig[0] as any)['SQL Original Statement']));
            triggersCopied++;
        }
        const [routinesRaw] = await srcConn.query<RowDataPacket[]>(
            `SELECT ROUTINE_NAME, ROUTINE_TYPE
             FROM INFORMATION_SCHEMA.ROUTINES
             WHERE ROUTINE_SCHEMA = ?`,
            [sourceConfig.database]
        );
        const routines = routinesRaw as RoutineRow[];

        for (const routine of routines) {
            const [createStmt] = await srcConn.query<RowDataPacket[]>(
                `SHOW CREATE ${routine.ROUTINE_TYPE} \`${routine.ROUTINE_NAME}\``
            );
            const key = routine.ROUTINE_TYPE === 'PROCEDURE' ? 'Create Procedure' : 'Create Function';
            await tgtConn.query(`DROP ${routine.ROUTINE_TYPE} IF EXISTS \`${routine.ROUTINE_NAME}\``);
            await tgtConn.query(normalizeMysqlCollations((createStmt[0] as any)[key]));
            routinesCopied++;
        }

        const [eventsRaw] = await srcConn.query<RowDataPacket[]>(`SHOW EVENTS`);
        const events = eventsRaw as EventRow[];

        for (const evt of events) {
            const [createEvt] = await srcConn.query<RowDataPacket[]>(`SHOW CREATE EVENT \`${evt.Name}\``);
            await tgtConn.query(`DROP EVENT IF EXISTS \`${evt.Name}\``);
            await tgtConn.query(normalizeMysqlCollations((createEvt[0] as any)['Create Event']));
            eventsCopied++;
        }

        await tgtConn.query('SET FOREIGN_KEY_CHECKS=1;');

        console.log(`✅ Database copied successfully!`);

        return { tablesCopied, rowsCopied, viewsCopied, triggersCopied, routinesCopied, eventsCopied };
    } finally {
        await srcConn.end();
        await tgtConn.end();
    }
}
