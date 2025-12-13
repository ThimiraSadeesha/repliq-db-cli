import { DBConfig, RoutineRow, TriggerRow, EventRow } from '../types/types';
import { RowDataPacket } from 'mysql2/promise';
import { getConnection } from '../utils/connection';

export async function copyDatabase(sourceConfig: DBConfig, targetConfig: DBConfig): Promise<void> {
    const srcConn = await getConnection(sourceConfig);
    const tgtConn = await getConnection(targetConfig);

    try {
        await tgtConn.query('SET FOREIGN_KEY_CHECKS=0;');

        const [tables] = await srcConn.query<RowDataPacket[]>(`SHOW TABLES`);
        const tableNames = tables.map(t => Object.values(t)[0] as string);

        for (const tableName of tableNames) {
            const [createStmt] = await srcConn.query<RowDataPacket[]>(`SHOW CREATE TABLE \`${tableName}\``);
            const sqlCreate = (createStmt[0] as any)['Create Table'];

            await tgtConn.query(`DROP TABLE IF EXISTS \`${tableName}\``);
            await tgtConn.query(sqlCreate);
            const [rows] = await srcConn.query<RowDataPacket[]>(`SELECT * FROM \`${tableName}\``);
            if (rows.length) {
                const columns = Object.keys(rows[0]);
                const insertSQL = `INSERT INTO \`${tableName}\` (${columns.map(c => `\`${c}\``).join(',')}) VALUES ?`;
                const values = rows.map(row => columns.map(col => row[col]));
                await tgtConn.query(insertSQL, [values]);
            }
        }

        const [views] = await srcConn.query<RowDataPacket[]>(`SHOW FULL TABLES WHERE Table_type = 'VIEW'`);
        for (const view of views) {
            const viewName = Object.values(view)[0] as string;
            const [createView] = await srcConn.query<RowDataPacket[]>(`SHOW CREATE VIEW \`${viewName}\``);
            await tgtConn.query(`DROP VIEW IF EXISTS \`${viewName}\``);
            await tgtConn.query((createView[0] as any)['Create View']);
        }

        const [triggerRows] = await srcConn.query<RowDataPacket[]>(`SHOW TRIGGERS`);
        const triggers = triggerRows as TriggerRow[];
        for (const trig of triggers) {
            const [createTrig] = await srcConn.query<RowDataPacket[]>(`SHOW CREATE TRIGGER \`${trig.Trigger}\``);
            await tgtConn.query(`DROP TRIGGER IF EXISTS \`${trig.Trigger}\``);
            await tgtConn.query((createTrig[0] as any)['SQL Original Statement']);
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
            await tgtConn.query((createStmt[0] as any)[key]);
        }
        const [eventsRaw] = await srcConn.query<RowDataPacket[]>(`SHOW EVENTS`);
        const events = eventsRaw as EventRow[];

        for (const evt of events) {
            const [createEvt] = await srcConn.query<RowDataPacket[]>(`SHOW CREATE EVENT \`${evt.Name}\``);
            await tgtConn.query(`DROP EVENT IF EXISTS \`${evt.Name}\``);
            await tgtConn.query((createEvt[0] as any)['Create Event']);
        }
        await tgtConn.query('SET FOREIGN_KEY_CHECKS=1;');

        console.log(`✅ Database copied from ${sourceConfig.database} to ${targetConfig.database} successfully!`);
    } finally {
        await srcConn.end();
        await tgtConn.end();
    }
}
