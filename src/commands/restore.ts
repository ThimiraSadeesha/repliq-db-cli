import ora from 'ora';
import chalk from 'chalk';
import fs from 'fs-extra';
import { DatabaseType, DatabaseConfig, RestoreConfig } from '../types';
import { MySQLHandler } from '../databases/mysql';
import logger from "lumilogger";
import compressionUtil from '../utils/compression';
import NotificationService from '../utils/notification';

interface RestoreOptions {
    type: string;
    host: string;
    database: string;
    file: string;
    port?: string;
    user?: string;
    password?: string;
    tables?: string;
    notifySlack: boolean;
    slackWebhook?: string;
}

async function restoreCommand(options: RestoreOptions) {
    const spinner = ora('Initializing restore...').start();
    const startTime = Date.now();

    try {
        // Validate database type
        const dbType = options.type.toLowerCase();
        if (!Object.values(DatabaseType).includes(dbType as DatabaseType)) {
            throw new Error(`Unsupported database type: ${options.type}`);
        }

        // Check if backup file exists
        if (!await fs.pathExists(options.file)) {
            throw new Error(`Backup file not found: ${options.file}`);
        }

        // Get default ports
        const defaultPorts: Record<string, number> = {
            mysql: 3306,
            postgresql: 5432,
            mongodb: 27017
        };

        // Build database config
        const dbConfig: DatabaseConfig = {
            type: dbType as DatabaseType,
            host: options.host,
            port: options.port ? parseInt(options.port) : defaultPorts[dbType],
            username: options.user || process.env.DB_USER || 'root',
            password: options.password || process.env.DB_PASSWORD || '',
            database: options.database
        };

        // Build restore config
        const restoreConfig: RestoreConfig = {
            backupFile: options.file,
            targetDatabase: options.database,
            tables: options.tables?.split(',').map(t => t.trim())
        };

        spinner.text = 'Testing database connection...';
        logger.logRestoreStart(dbConfig.database, options.file);

        // Create database handler
        let handler;
        if (dbType === DatabaseType.MYSQL) {
            handler = new MySQLHandler(dbConfig);
        } else {
            throw new Error(`Handler for ${dbType} not yet implemented`);
        }

        // Test connection
        await handler.testConnection();
        spinner.succeed(chalk.green('Database connection successful'));

        // Check if file is compressed
        let fileToRestore = options.file;
        if (options.file.endsWith('.gz') || options.file.endsWith('.tar.gz')) {
            spinner.start('Decompressing backup file...');
            fileToRestore = await compressionUtil.decompressFile(options.file);
            spinner.succeed(chalk.green('Backup file decompressed'));
            restoreConfig.backupFile = fileToRestore;
        }

        // Warning prompt
        spinner.warn(chalk.yellow(`⚠️  WARNING: This will overwrite the database '${dbConfig.database}'`));

        // In production, you might want to add a confirmation prompt here
        // For now, we'll proceed with the restore

        spinner.start('Restoring database...');
        await handler.restore(restoreConfig);
        spinner.succeed(chalk.green('Database restore completed'));

        // Clean up decompressed file if it was created
        if (fileToRestore !== options.file && await fs.pathExists(fileToRestore)) {
            await fs.remove(fileToRestore);
            logger.info('Cleaned up temporary decompressed file');
        }

        const duration = Date.now() - startTime;

        // Log completion
        logger.logRestoreComplete(dbConfig.database, duration);

        // Send notification if requested
        if (options.notifySlack) {
            const webhookUrl = options.slackWebhook || process.env.SLACK_WEBHOOK_URL;
            if (webhookUrl) {
                spinner.start('Sending notification...');
                const notifier = new NotificationService(webhookUrl);
                await notifier.notifyRestoreComplete(
                    true,
                    dbConfig.database,
                    duration
                );
                spinner.succeed(chalk.green('Notification sent'));
            }
        }

        // Success summary
        console.log(chalk.green.bold('\n✓ Restore completed successfully!\n'));
        console.log(chalk.cyan('Summary:'));
        console.log(chalk.gray(`  Database: ${dbConfig.database}`));
        console.log(chalk.gray(`  Backup File: ${options.file}`));
        console.log(chalk.gray(`  Duration: ${(duration / 1000).toFixed(2)} seconds\n`));

    } catch (error: any) {
        spinner.fail(chalk.red('Restore failed'));
        console.error(chalk.red(`\n✗ Error: ${error.message}\n`));
        logger.logRestoreError(options.database, error);

        // Send failure notification
        if (options.notifySlack) {
            const webhookUrl = options.slackWebhook || process.env.SLACK_WEBHOOK_URL;
            if (webhookUrl) {
                const notifier = new NotificationService(webhookUrl);
                await notifier.notifyRestoreComplete(
                    false,
                    options.database,
                    Date.now() - startTime,
                    error.message
                );
            }
        }

        process.exit(1);
    }
}

export default restoreCommand;