import ora from 'ora';
import fs from 'fs/promises';
import chalk from 'chalk';
import os from 'os';
import path from 'path';
import { getConnection, getGeneratedColumns } from '../utils/connection';
import { DBConfig } from '../types/types';

export async function backupCommand(config: DBConfig, outputFile?: string){
    const spinner = ora('Starting backup process...').start();

    try {
        const desktopPath = path.join(os.homedir(), 'Desktop');
        const backupFolder = path.join(desktopPath, 'backups');
        await fs.mkdir(backupFolder, { recursive: true });
        const filename = outputFile || path.join(backupFolder, `backup_${config.database}_${Date.now()}.sql`);

        spinner.text = 'Connecting to database...';
        const connection = await getConnection(config);

        let sqlDump = `-- MySQL Database Backup\n`;
        sqlDump += `-- Database: ${config.database}\n`;
        sqlDump += `-- Date: ${new Date().toISOString()}\n\n`;
        sqlDump += `SET FOREIGN_KEY_CHECKS=0;\n\n`;

        spinner.text = 'Reading database schema...';
        const [tables] = await connection.query<any[]>('SHOW TABLES');
        const tableNames = tables.map((t) => Object.values(t)[0] as string);

        spinner.text = `Backing up ${tableNames.length} tables...`;

        for (let i = 0; i < tableNames.length; i++) {
            const tableName = tableNames[i];
            spinner.text = `Backing up table ${i + 1}/${tableNames.length}: ${tableName}`;
            const [createStmt] = await connection.query<any[]>(`SHOW CREATE TABLE \`${tableName}\``);
            const createSQL = createStmt[0]['Create Table'];
            sqlDump += `--\n-- Table structure for \`${tableName}\`\n--\n\n`;
            sqlDump += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
            sqlDump += createSQL + ';\n\n';
            const generatedCols = await getGeneratedColumns(connection, config.database, tableName);
            const [rows] = await connection.query(`SELECT * FROM \`${tableName}\``);

            if (Array.isArray(rows) && rows.length > 0) {
                sqlDump += `--\n-- Dumping data for table \`${tableName}\`\n--\n\n`;

                const columns = Object.keys(rows[0] as object).filter(c => !generatedCols.has(c));
                sqlDump += `INSERT INTO \`${tableName}\` (${columns.map((c) => `\`${c}\``).join(', ')}) VALUES\n`;

                const values: string[] = [];
                for (const row of rows as any[]) {
                    const rowValues = columns.map((col) => {
                        const val = (row as any)[col];
                        if (val === null) return 'NULL';
                        if (typeof val === 'number') return val.toString();
                        if (val instanceof Date) return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
                        if (typeof val === 'string') return `'${val.replace(/'/g, "''").replace(/\\/g, '\\\\')}'`;
                        return `'${String(val).replace(/'/g, "''").replace(/\\/g, '\\\\')}'`;
                    });
                    values.push(`(${rowValues.join(', ')})`);
                }

                sqlDump += values.join(',\n') + ';\n\n';
            }
        }

        sqlDump += `SET FOREIGN_KEY_CHECKS=1;\n`;
        spinner.text = 'Writing backup file...';
        await fs.writeFile(filename, sqlDump, 'utf-8');

        await connection.end();

        spinner.succeed(chalk.green(`Backup completed: ${filename} (${tableNames.length} tables)`));
    } catch (error: any) {
        spinner.fail(chalk.red(`Backup failed: ${error.message}`));
    }

}