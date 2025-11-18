#!/usr/bin/env node
import { program } from 'commander';

import 'dotenv/config';

import { restoreMySQL } from './commands/restore';

import logger from "lumilogger";
import {testConnection} from "./commands/connection-test";

// Banner
const banner = `
╔═══════════════════════════════════════════════════╗
║                                                   ║
║        Database Backup & Restore CLI Tool         ║
║                                                   ║
║   Support: MySQL, PostgreSQL, MongoDB             ║
║   Storage: Local, AWS S3, GCS, Azure              ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
`;

console.log(banner);

// CLI setup
program
    .name('db-backup')
    .description('A comprehensive database backup and restore CLI tool')
    .version('1.0.0');

// Test connection command
program
    .command('test-conn')
    .description('Test MySQL connection')
    .option('-H, --host <host>', 'Database host', process.env.DB_HOST)
    .option('--port <port>', 'Database port', process.env.DB_PORT || '3306')
    .option('-u, --user <user>', 'Database user', process.env.DB_USER)
    .option('-P, --password <password>', 'Database password', process.env.DB_PASSWORD)
    .option('-d, --database <database>', 'Database name', process.env.DB_NAME)
    .action(async (opts) => {
        if (!opts.host || !opts.user || !opts.password || !opts.database) {
            console.error('❌ Missing database configuration. Set via flags or .env');
            process.exit(1);
        }

        const config = {
            host: opts.host,
            port: Number(opts.port),
            user: opts.user,
            password: opts.password,
            database: opts.database,
        };
        await testConnection(config);
    });

// Backup command
program
    .command('backup')
    .description('Backup MySQL database')
    .option('-H, --host <host>', 'Database host', process.env.DB_HOST)
    .option('--port <port>', 'Database port', process.env.DB_PORT || '3306')
    .option('-u, --user <user>', 'Database user', process.env.DB_USER)
    .option('-P, --password <password>', 'Database password', process.env.DB_PASSWORD)
    .option('-d, --database <database>', 'Database name', process.env.DB_NAME)
    .option('-o, --outputDir <outputDir>', 'Output directory', process.env.BACKUP_DIR || './backups')
    .option('-c, --compress', 'Compress backup', false)
    .action(async (opts) => {
        // Validate required options
        if (!opts.host || !opts.user || !opts.password || !opts.database) {
            logger.error('❌ Missing required database configuration');
            logger.error('   Provide via flags or set environment variables:');
            logger.error('   DB_HOST, DB_USER, DB_PASSWORD, DB_NAME');
            process.exit(1);
        }

        await backupMySQL(opts);
    });
// Restore command
program
    .command('restore')
    .description('Restore MySQL database from backup')
    .requiredOption('-H, --host <host>', 'Database host')
    .requiredOption('-u, --user <user>', 'Database user')
    .requiredOption('-P, --password <password>', 'Database password')
    .requiredOption('-d, --database <database>', 'Database name')
    .requiredOption('-f, --backupFile <backupFile>', 'Backup file path')
    .option('--port <port>', 'Database port', '3306')
    .action(async (opts) => {
        await restoreMySQL(opts);
    });

program.parse(process.argv);