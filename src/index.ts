
import { Command } from 'commander';
import dotenv from 'dotenv';
import chalk from 'chalk';
import backupCommand from './commands/backup';
import restoreCommand from './commands/restore';
import testConnectionCommand from './commands/test-connection';

// Load environment variables
dotenv.config();

const program = new Command();

program
    .name('db-backup')
    .description('A comprehensive database backup and restore CLI tool')
    .version('1.0.0');

// ASCII Art Banner
const banner = `
╔═══════════════════════════════════════════════════╗
║                                                   ║
║        Database Backup & Restore CLI Tool         ║
║                                                   ║
║   Support: MySQL, PostgreSQL, MongoDB            ║
║   Storage: Local, AWS S3, GCS, Azure             ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
`;

console.log(chalk.cyan(banner));

// Backup command
program
    .command('backup')
    .description('Create a database backup')
    .requiredOption('-t, --type <type>', 'Database type (mysql, postgresql, mongodb)')
    .requiredOption('-h, --host <host>', 'Database host')
    .requiredOption('-d, --database <database>', 'Database name')
    .option('-P, --port <port>', 'Database port')
    .option('-u, --user <user>', 'Database username')
    .option('-p, --password <password>', 'Database password')
    .option('-b, --backup-type <type>', 'Backup type (full, incremental, differential)', 'full')
    .option('-c, --compress', 'Compress backup file', false)
    .option('-s, --storage <storage>', 'Storage type (local, s3, gcs, azure)', 'local')
    .option('-o, --output <path>', 'Output path for local storage')
    .option('--s3-bucket <bucket>', 'S3 bucket name')
    .option('--s3-region <region>', 'S3 region')
    .option('--gcs-bucket <bucket>', 'GCS bucket name')
    .option('--gcs-project <project>', 'GCS project ID')
    .option('--azure-container <container>', 'Azure container name')
    .option('--exclude-tables <tables>', 'Comma-separated list of tables to exclude')
    .option('--include-tables <tables>', 'Comma-separated list of tables to include')
    .option('--notify-slack', 'Send Slack notification on completion', false)
    .option('--slack-webhook <url>', 'Slack webhook URL')
    .action(backupCommand);

// Restore command
program
    .command('restore')
    .description('Restore database from backup')
    .requiredOption('-t, --type <type>', 'Database type (mysql, postgresql, mongodb)')
    .requiredOption('-h, --host <host>', 'Database host')
    .requiredOption('-d, --database <database>', 'Target database name')
    .requiredOption('-f, --file <file>', 'Backup file path')
    .option('-P, --port <port>', 'Database port')
    .option('-u, --user <user>', 'Database username')
    .option('-p, --password <password>', 'Database password')
    .option('--tables <tables>', 'Comma-separated list of tables to restore (selective restore)')
    .option('--notify-slack', 'Send Slack notification on completion', false)
    .option('--slack-webhook <url>', 'Slack webhook URL')
    .action(restoreCommand);

// Test connection command
program
    .command('test')
    .description('Test database connection')
    .requiredOption('-t, --type <type>', 'Database type (mysql, postgresql, mongodb)')
    .requiredOption('-h, --host <host>', 'Database host')
    .requiredOption('-d, --database <database>', 'Database name')
    .option('-P, --port <port>', 'Database port')
    .option('-u, --user <user>', 'Database username')
    .option('-p, --password <password>', 'Database password')
    .action(testConnectionCommand);

// List command - shows recent backups
program
    .command('list')
    .description('List available backups')
    .option('-p, --path <path>', 'Backup directory path', './backups')
    .action(async (options) => {
        const fs = await import('fs-extra');
        const path = await import('path');

        try {
            const backupDir = path.resolve(options.path);

            if (!await fs.pathExists(backupDir)) {
                console.log(chalk.yellow(`No backups found at: ${backupDir}`));
                return;
            }

            const files = await fs.readdir(backupDir);
            const backupFiles = files.filter(f => f.endsWith('.sql') || f.endsWith('.gz') || f.endsWith('.dump'));

            if (backupFiles.length === 0) {
                console.log(chalk.yellow('No backup files found'));
                return;
            }

            console.log(chalk.green(`\nFound ${backupFiles.length} backup(s):\n`));

            for (const file of backupFiles) {
                const filePath = path.join(backupDir, file);
                const stats = await fs.stat(filePath);
                const size = (stats.size / 1024 / 1024).toFixed(2);

                console.log(chalk.cyan(`  📦 ${file}`));
                console.log(chalk.gray(`     Size: ${size} MB | Modified: ${stats.mtime.toLocaleString()}\n`));
            }
        } catch (error: any) {
            console.error(chalk.red(`Error listing backups: ${error.message}`));
        }
    });

// Config command - generate config file
program
    .command('config')
    .description('Generate configuration file template')
    .option('-o, --output <file>', 'Output file path', '.env.example')
    .action(async (options) => {
        const fs = await import('fs-extra');

        const template = `# Database Configuration
DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=your_database

# Backup Configuration
BACKUP_TYPE=full
COMPRESS=true
STORAGE_TYPE=local
OUTPUT_PATH=./backups

# AWS S3 Configuration (if using S3)
AWS_S3_BUCKET=your-bucket-name
AWS_S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# Slack Notifications (optional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Logging
LOG_LEVEL=info
`;

        try {
            await fs.writeFile(options.output, template);
            console.log(chalk.green(`✓ Configuration template created: ${options.output}`));
            console.log(chalk.gray('  Copy this file to .env and update with your values'));
        } catch (error: any) {
            console.error(chalk.red(`Error creating config: ${error.message}`));
        }
    });

program.parse();