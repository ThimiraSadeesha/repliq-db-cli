import mysql from 'mysql2/promise';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import { DatabaseConfig, BackupConfig, RestoreConfig } from '../types';
import logger from '../utils/logger';

const execAsync = promisify(exec);

export class MySQLHandler {
    private config: DatabaseConfig;

    constructor(config: DatabaseConfig) {
        this.config = config;
    }

    /**
     * Test database connection
     */
    async testConnection(): Promise<boolean> {
        try {
            const connection = await mysql.createConnection({
                host: this.config.host,
                port: this.config.port,
                user: this.config.username,
                password: this.config.password,
                database: this.config.database
            });

            await connection.ping();
            await connection.end();

            logger.info('MySQL connection test successful');
            return true;
        } catch (error: any) {
            logger.error('MySQL connection test failed', error);
            throw new Error(`MySQL connection failed: ${error.message}`);
        }
    }

    /**
     * Perform backup using mysqldump
     */
    async backup(backupConfig: BackupConfig): Promise<string> {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${this.config.database}_${timestamp}.sql`;
        const outputPath = backupConfig.outputPath || path.join(process.cwd(), 'backups');

        await fs.ensureDir(outputPath);
        const backupFile = path.join(outputPath, filename);

        try {
            // Build mysqldump command
            let command = `mysqldump -h ${this.config.host} -P ${this.config.port} -u ${this.config.username}`;

            // Add password if provided
            if (this.config.password) {
                command += ` -p${this.config.password}`;
            }

            // Add SSL option if needed
            if (this.config.ssl) {
                command += ` --ssl-mode=REQUIRED`;
            }

            // Add backup type options
            if (backupConfig.backupType === 'full') {
                command += ` --single-transaction --routines --triggers --events`;
            }

            // Add table filters
            if (backupConfig.includeTables && backupConfig.includeTables.length > 0) {
                command += ` --tables ${backupConfig.includeTables.join(' ')}`;
            }

            if (backupConfig.excludeTables && backupConfig.excludeTables.length > 0) {
                backupConfig.excludeTables.forEach(table => {
                    command += ` --ignore-table=${this.config.database}.${table}`;
                });
            }

            // Add database name and output redirection
            command += ` ${this.config.database} > "${backupFile}"`;

            logger.info(`Executing backup command for MySQL database: ${this.config.database}`);

            await execAsync(command);

            logger.info(`MySQL backup completed: ${backupFile}`);
            return backupFile;
        } catch (error: any) {
            logger.error('MySQL backup failed', error);

            // Clean up failed backup file
            if (await fs.pathExists(backupFile)) {
                await fs.remove(backupFile);
            }

            throw new Error(`MySQL backup failed: ${error.message}`);
        }
    }

    /**
     * Restore database from backup file
     */
    async restore(restoreConfig: RestoreConfig): Promise<void> {
        const { backupFile, targetDatabase } = restoreConfig;
        const dbName = targetDatabase || this.config.database;

        try {
            // Check if backup file exists
            if (!await fs.pathExists(backupFile)) {
                throw new Error(`Backup file not found: ${backupFile}`);
            }

            logger.info(`Starting MySQL restore for database: ${dbName}`);

            // Build mysql restore command
            let command = `mysql -h ${this.config.host} -P ${this.config.port} -u ${this.config.username}`;

            if (this.config.password) {
                command += ` -p${this.config.password}`;
            }

            if (this.config.ssl) {
                command += ` --ssl-mode=REQUIRED`;
            }

            command += ` ${dbName} < "${backupFile}"`;

            await execAsync(command);

            logger.info(`MySQL restore completed for database: ${dbName}`);
        } catch (error: any) {
            logger.error('MySQL restore failed', error);
            throw new Error(`MySQL restore failed: ${error.message}`);
        }
    }

    /**
     * Get database size
     */
    async getDatabaseSize(): Promise<number> {
        try {
            const connection = await mysql.createConnection({
                host: this.config.host,
                port: this.config.port,
                user: this.config.username,
                password: this.config.password,
                database: this.config.database
            });

            const [rows]: any = await connection.query(`
        SELECT 
          SUM(data_length + index_length) as size
        FROM information_schema.TABLES
        WHERE table_schema = ?
      `, [this.config.database]);

            await connection.end();

            return rows[0].size || 0;
        } catch (error: any) {
            logger.error('Failed to get database size', error);
            return 0;
        }
    }

    async listTables(): Promise<string[]> {
        try {
            const connection = await mysql.createConnection({
                host: this.config.host,
                port: this.config.port,
                user: this.config.username,
                password: this.config.password,
                database: this.config.database
            });

            const [rows]: any = await connection.query('SHOW TABLES');
            await connection.end();

            return rows.map((row: any) => Object.values(row)[0] as string);
        } catch (error: any) {
            logger.error('Failed to list tables', error);
            return [];
        }
    }
}