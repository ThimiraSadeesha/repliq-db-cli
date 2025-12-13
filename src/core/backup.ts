import fs from 'fs/promises';
import path from 'path';
import os from 'os';

import { DBConfig, RoutineRow, TriggerRow, EventRow } from '../types/types';
import { RowDataPacket } from 'mysql2/promise';
import {getConnection} from "../utils/connection";

export async function backupDatabase(config: DBConfig, outputFile?: string): Promise<string> {
    const backupFolder = path.join(os.homedir(), 'backups');
    await fs.mkdir(backupFolder, { recursive: true });

    const filename = outputFile || path.join(backupFolder, `backup_${config.database}_${Date.now()}.sql`);
    const connection = await getConnection(config);

    let sqlDump = `-- MySQL Full Database Backup\n`;
    sqlDump += `-- Database: ${config.database}\n`;
    sqlDump += `-- Date: ${new Date().toISOString()}\n\n`;
    sqlDump += `SET FOREIGN_KEY_CHECKS=0;\n\n`;

    const [tables] = await connection.query<RowDataPacket[]>(`SHOW TABLES`);
    const tableNames = tables.map(t => Object.values(t)[0] as string);

    for (const tableName of tableNames) {
        const [createStmt] = await connection.query<RowDataPacket[]>(`SHOW CREATE TABLE \`${tableName}\``);
        sqlDump += `--\n-- Table structure for \`${tableName}\`\n--\n\n`;
        sqlDump += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
        sqlDump += (createStmt[0] as any)['Create Table'] + ';\n\n';
        const [rows] = await connection.query<RowDataPacket[]>(`SELECT * FROM \`${tableName}\``);
        if (rows.length) {
            const columns = Object.keys(rows[0]);
            sqlDump += `--\n-- Data for table \`${tableName}\`\n--\n\n`;
            sqlDump += `INSERT INTO \`${tableName}\` (${columns.map(c => `\`${c}\``).join(', ')}) VALUES\n`;
            const values = rows.map(row =>
                `(${columns.map(col => connection.escape(row[col])).join(', ')})`
            );
            sqlDump += values.join(',\n') + ';\n\n';
        }
    }

    const [views] = await connection.query<RowDataPacket[]>(`SHOW FULL TABLES WHERE Table_type = 'VIEW'`);
    for (const view of views) {
        const viewName = Object.values(view)[0] as string;
        const [createView] = await connection.query<RowDataPacket[]>(`SHOW CREATE VIEW \`${viewName}\``);
        sqlDump += `DROP VIEW IF EXISTS \`${viewName}\`;\n`;
        sqlDump += (createView[0] as any)['Create View'] + ';\n\n';
    }

    const [triggerRows] = await connection.query<RowDataPacket[]>(`SHOW TRIGGERS`);
    const triggers = triggerRows as TriggerRow[];
    for (const trig of triggers) {
        const triggerName = trig.Trigger;
        const [createTrig] = await connection.query<RowDataPacket[]>(`SHOW CREATE TRIGGER \`${triggerName}\``);
        sqlDump += `DROP TRIGGER IF EXISTS \`${triggerName}\`;\n`;
        sqlDump += (createTrig[0] as any)['SQL Original Statement'] + ';\n\n';
    }

    const [routinesRaw] = await connection.query<RowDataPacket[]>(
        `SELECT ROUTINE_NAME, ROUTINE_TYPE
         FROM INFORMATION_SCHEMA.ROUTINES
         WHERE ROUTINE_SCHEMA = ?`,
        [config.database]
    );
    const routines = routinesRaw as RoutineRow[];

    for (const routine of routines) {
        const [createStmt] = await connection.query<RowDataPacket[]>(
            `SHOW CREATE ${routine.ROUTINE_TYPE} \`${routine.ROUTINE_NAME}\``
        );
        const key = routine.ROUTINE_TYPE === 'PROCEDURE' ? 'Create Procedure' : 'Create Function';
        sqlDump += `DROP ${routine.ROUTINE_TYPE} IF EXISTS \`${routine.ROUTINE_NAME}\`;\n`;
        sqlDump += (createStmt[0] as any)[key] + ';\n\n';
    }

    const [eventsRaw] = await connection.query<RowDataPacket[]>(`SHOW EVENTS`);
    const events = eventsRaw as EventRow[];

    for (const evt of events) {
        const [createEvt] = await connection.query<RowDataPacket[]>(`SHOW CREATE EVENT \`${evt.Name}\``);
        sqlDump += `DROP EVENT IF EXISTS \`${evt.Name}\`;\n`;
        sqlDump += (createEvt[0] as any)['Create Event'] + ';\n\n';
    }

    sqlDump += `SET FOREIGN_KEY_CHECKS=1;\n`;

    await fs.writeFile(filename, sqlDump, 'utf-8');
    await connection.end();

    return filename;
}
