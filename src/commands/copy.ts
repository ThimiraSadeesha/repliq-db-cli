import ora from 'ora';
import chalk from 'chalk';
import {confirmAction, askMultiSelect, getCreateSQL, getRoutineCreateSQL} from '../utils/prompts';
import { getConnection } from '../utils/connection';
import { ensureGeneralCiSession } from '../utils/normalizeMysqlDdl';
import { copyTableData, runPool, DEFAULT_CONCURRENCY, prepareTargetSession, listBaseTables, recreateTableSchema } from '../utils/copyTable';
import {DBConfig, EventRow, RoutineRow, TriggerRow} from '../types/types';

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

    const tryCopy = async (_label: string, fn: () => Promise<void>) => {
        try {
            await fn();
        } catch {
            // Objects the target server can't create (e.g. MySQL-only syntax on MariaDB) are skipped silently.
        }
    };

    try {
        const srcConn = await getConnection(srcConfig);
        const tgtConn = await getConnection(tgtConfig);
        await ensureGeneralCiSession(tgtConn);

        if (copyOptions.includes('tables')) {
            spinner.text = 'Reading tables...';
            const tableNames = await listBaseTables(srcConn);

            spinner.text = `Found ${tableNames.length} tables to copy`;
            await prepareTargetSession(tgtConn);

            for (let i = 0; i < tableNames.length; i++) {
                spinner.text = `Creating table structure ${i + 1}/${tableNames.length}: ${tableNames[i]}`;
                await recreateTableSchema(srcConn, tgtConn, tableNames[i]);
            }

            const active = new Map<string, string>();
            const startedAt = Date.now();
            let done = 0;
            const render = () => {
                const names = [...active.entries()].map(([n, info]) => `${n}${info}`);
                const secs = Math.round((Date.now() - startedAt) / 1000);
                spinner.text = `Copying data ${done}/${tableNames.length} tables done (${secs}s) — in progress: ${names.join(', ')}`;
            };

            await runPool(srcConfig, tgtConfig, tableNames, DEFAULT_CONCURRENCY, async (pair, tableName) => {
                active.set(tableName, ' (starting)');
                render();

                const rowsCopied = await copyTableData(pair, tableName, (read, written, mb) => {
                    active.set(tableName, ` (${read.toLocaleString()} rows read, ${written.toLocaleString()} written, ${mb.toFixed(1)} MB)`);
                    render();
                });
                spinner.stopAndPersist({ symbol: chalk.green('✔'), text: `${tableName}: ${rowsCopied.toLocaleString()} rows` });
                spinner.start();

                active.delete(tableName);
                done++;
                render();
            });

            await tgtConn.query('SET FOREIGN_KEY_CHECKS = 1');
        }

        if (copyOptions.includes('views')) {
            spinner.text = 'Reading views...';
            const [views] = await srcConn.query<any[]>("SHOW FULL TABLES WHERE Table_type = 'VIEW'");
            for (const view of views) {
                const viewName = Object.values(view)[0] as string;
                await tryCopy(`VIEW ${viewName}`, async () => {
                    const [createView] = await srcConn.query<any[]>(`SHOW CREATE VIEW \`${viewName}\``);
                    const createSQL = getCreateSQL(createView, 'Create View', viewName);
                    if (!createSQL) return;

                    await tgtConn.query(`DROP VIEW IF EXISTS \`${viewName}\``);
                    await tgtConn.query(createSQL);
                });
            }
        }

        if (copyOptions.includes('triggers')) {
            spinner.text = 'Reading triggers...';
            const [triggerRows] = await srcConn.query('SHOW TRIGGERS');
            const triggers = triggerRows as unknown as TriggerRow[];

            for (const trig of triggers) {
                const triggerName = trig.Trigger;
                await tryCopy(`TRIGGER ${triggerName}`, async () => {
                    const [createTrig] = await srcConn.query<any[]>(`SHOW CREATE TRIGGER \`${triggerName}\``);
                    const sql = getCreateSQL(createTrig, 'SQL Original Statement', triggerName);
                    if (!sql) return;

                    await tgtConn.query(`DROP TRIGGER IF EXISTS \`${triggerName}\``);
                    await tgtConn.query(sql);
                });
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
                spinner.text = `Copying ${type.toLowerCase()} ${name}`;
                await tryCopy(`${type} ${name}`, async () => {
                    const [createStmt] = await srcConn.query<any[]>(`SHOW CREATE ${type} \`${name}\``);
                    const sql = getRoutineCreateSQL(createStmt, type, name);
                    if (!sql) return;

                    await tgtConn.query(`DROP ${type} IF EXISTS \`${name}\``);
                    await tgtConn.query(sql);
                });
            }
        }

        if (copyOptions.includes('events')) {
            spinner.text = 'Reading events...';
            const [eventRows] = await srcConn.query('SHOW EVENTS');
            const events = eventRows as unknown as EventRow[];

            for (const evt of events) {
                const eventName = evt.Name;
                await tryCopy(`EVENT ${eventName}`, async () => {
                    const [createEvt] = await srcConn.query<any[]>(`SHOW CREATE EVENT \`${eventName}\``);
                    const sql = getCreateSQL(createEvt, 'Create Event', eventName);
                    if (!sql) return;

                    await tgtConn.query(`DROP EVENT IF EXISTS \`${eventName}\``);
                    await tgtConn.query(sql);
                });
            }
        }

        await srcConn.end();
        await tgtConn.end();

        spinner.succeed(chalk.green('✅ Database copy completed successfully!'));
    } catch (error: any) {
        spinner.fail(chalk.red(`❌ Copy failed: ${error.message}`));
    }
}