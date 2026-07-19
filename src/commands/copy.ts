import ora from 'ora';
import chalk from 'chalk';
import {confirmAction, askMultiSelect, getCreateSQL, getRoutineCreateSQL} from '../utils/prompts';
import { getConnection, getGeneratedColumns } from '../utils/connection';
import { ensureGeneralCiSession } from '../utils/normalizeMysqlDdl';
import {DBConfig, EventRow, RoutineRow, TriggerRow} from '../types/types';

const INSERT_BATCH_SIZE = 400;

export async function copyCommand(srcConfig: DBConfig, tgtConfig: DBConfig): Promise<void> {
    console.log(chalk.yellow(`\n⚠️  Warning: This may replace data and objects in ${tgtConfig.database}`));

    const confirmed = await confirmAction(
        `Copy database objects from ${srcConfig.database} to ${tgtConfig.database}?`
    );
    if (!confirmed) {
        console.log(chalk.red('❌ Operation cancelled'));
        return;
    }

    const copyOptions = await askMultiSelect(
        [
            { name: 'Tables (with data)', value: 'tables', checked: true },
            { name: 'Views', value: 'views' },
            { name: 'Triggers', value: 'triggers' },
            { name: 'Stored Procedures & Functions', value: 'routines' },
            { name: 'Events', value: 'events' },
        ],
        'Select database objects to copy'
    );

    const spinner = ora('Starting copy process...').start();

    try {
        const srcConn = await getConnection(srcConfig);
        const tgtConn = await getConnection(tgtConfig);
        await ensureGeneralCiSession(tgtConn);

        if (copyOptions.includes('tables')) {
            spinner.text = 'Reading tables...';
            const [tables] = await srcConn.query<any[]>('SHOW TABLES');
            const tableNames = tables.map(t => Object.values(t)[0] as string);

            spinner.text = `Found ${tableNames.length} tables to copy`;
            await tgtConn.query('SET FOREIGN_KEY_CHECKS = 0');

            for (let i = 0; i < tableNames.length; i++) {
                const tableName = tableNames[i];
                spinner.text = `Copying table ${i + 1}/${tableNames.length}: ${tableName}`;

                const [createStmt] = await srcConn.query<any[]>(`SHOW CREATE TABLE \`${tableName}\``);
                const createSQL = getCreateSQL(createStmt, 'Create Table', tableName);
                if (!createSQL) continue;

                await tgtConn.query(`DROP TABLE IF EXISTS \`${tableName}\``);
                await tgtConn.query(createSQL);

                const generatedCols = await getGeneratedColumns(srcConn, srcConfig.database, tableName);

                const [rows] = await srcConn.query<any[]>(`SELECT * FROM \`${tableName}\``);
                if (Array.isArray(rows) && rows.length > 0) {
                    const columns = Object.keys(rows[0]).filter(c => !generatedCols.has(c));
                    if (columns.length === 0) continue;
                    const colList = columns.map(c => `\`${c}\``).join(',');
                    const oneRow = `(${columns.map(() => '?').join(',')})`;
                    for (let start = 0; start < rows.length; start += INSERT_BATCH_SIZE) {
                        const chunk = rows.slice(start, start + INSERT_BATCH_SIZE);
                        const insertSQL = `INSERT INTO \`${tableName}\` (${colList}) VALUES ${chunk.map(() => oneRow).join(',')}`;
                        const flat = chunk.flatMap(row => columns.map(col => row[col]));
                        await tgtConn.query(insertSQL, flat);
                    }
                }
            }
            await tgtConn.query('SET FOREIGN_KEY_CHECKS = 1');
        }

        if (copyOptions.includes('views')) {
            spinner.text = 'Reading views...';
            const [views] = await srcConn.query<any[]>("SHOW FULL TABLES WHERE Table_type = 'VIEW'");
            for (const view of views) {
                const viewName = Object.values(view)[0] as string;
                const [createView] = await srcConn.query<any[]>(`SHOW CREATE VIEW \`${viewName}\``);
                const createSQL = getCreateSQL(createView, 'Create View', viewName);
                if (!createSQL) continue;

                await tgtConn.query(`DROP VIEW IF EXISTS \`${viewName}\``);
                await tgtConn.query(createSQL);
            }
        }

        if (copyOptions.includes('triggers')) {
            spinner.text = 'Reading triggers...';
            const [triggerRows] = await srcConn.query('SHOW TRIGGERS');
            const triggers = triggerRows as unknown as TriggerRow[];

            for (const trig of triggers) {
                const triggerName = trig.Trigger;
                const [createTrig] = await srcConn.query<any[]>(`SHOW CREATE TRIGGER \`${triggerName}\``);
                const sql = getCreateSQL(createTrig, 'SQL Original Statement', triggerName);
                if (!sql) continue;

                await tgtConn.query(`DROP TRIGGER IF EXISTS \`${triggerName}\``);
                await tgtConn.query(sql);
            }
        }

        if (copyOptions.includes('routines')) {
            spinner.text = 'Reading stored procedures and functions...';
            const [routineRows] = await srcConn.query(
                `SELECT ROUTINE_NAME, ROUTINE_TYPE 
                 FROM INFORMATION_SCHEMA.ROUTINES 
                 WHERE ROUTINE_SCHEMA = ?`,
                [srcConfig.database]
            );
            const routines = routineRows as unknown as RoutineRow[];

            for (const routine of routines) {
                const name = routine.ROUTINE_NAME;
                const type = routine.ROUTINE_TYPE;
                const [createStmt] = await srcConn.query<any[]>(`SHOW CREATE ${type} \`${name}\``);
                const sql = getRoutineCreateSQL(createStmt, type, name);
                if (!sql) continue;

                await tgtConn.query(`DROP ${type} IF EXISTS \`${name}\``);
                await tgtConn.query(sql);
            }
        }

        if (copyOptions.includes('events')) {
            spinner.text = 'Reading events...';
            const [eventRows] = await srcConn.query('SHOW EVENTS');
            const events = eventRows as unknown as EventRow[];

            for (const evt of events) {
                const eventName = evt.Name;
                const [createEvt] = await srcConn.query<any[]>(`SHOW CREATE EVENT \`${eventName}\``);
                const sql = getCreateSQL(createEvt, 'Create Event', eventName);
                if (!sql) continue;

                await tgtConn.query(`DROP EVENT IF EXISTS \`${eventName}\``);
                await tgtConn.query(sql);
            }
        }

        await srcConn.end();
        await tgtConn.end();

        spinner.succeed(chalk.green('✅ Database copy completed successfully!'));
    } catch (error: any) {
        spinner.fail(chalk.red(`❌ Copy failed: ${error.message}`));
    }
}