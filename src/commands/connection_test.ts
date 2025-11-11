import ora from 'ora';
import chalk from 'chalk';
import { MySQLHandler } from '../databases/mysql';
import logger from "lumilogger";
import {DatabaseConfig, DatabaseType} from "../types/types";



async function testConnectionCommand(options: TestConnectionOptions) {
    const spinner = ora('Testing database connection...').start();

    try {
        // Validate database type
        const dbType = options.type.toLowerCase();
        if (!Object.values(DatabaseType).includes(dbType as DatabaseType)) {
            throw new Error(`Unsupported database type: ${options.type}`);
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

        logger.info(`Testing connection to ${dbType} database: ${dbConfig.database}`);

        // Create database handler
        let handler;
        if (dbType === DatabaseType.MYSQL) {
            handler = new MySQLHandler(dbConfig);
        } else {
            throw new Error(`Handler for ${dbType} not yet implemented`);
        }

        // Test connection
        await handler.testConnection();

        spinner.succeed(chalk.green('Connection successful!'));

        // Get additional database information
        spinner.start('Fetching database information...');

        const dbSize = await handler.getDatabaseSize();
        const tables = await handler.listTables();

        spinner.succeed(chalk.green('Database information retrieved'));

        // Display results
        console.log(chalk.green.bold('\n✓ Connection Test Successful!\n'));
        console.log(chalk.cyan('Database Information:'));
        console.log(chalk.gray(`  Type: ${dbType}`));
        console.log(chalk.gray(`  Host: ${dbConfig.host}:${dbConfig.port}`));
        console.log(chalk.gray(`  Database: ${dbConfig.database}`));
        console.log(chalk.gray(`  Size: ${(dbSize / 1024 / 1024).toFixed(2)} MB`));
        console.log(chalk.gray(`  Tables: ${tables.length}`));

        if (tables.length > 0 && tables.length <= 20) {
            console.log(chalk.gray('\n  Table List:'));
            tables.forEach(table => {
                console.log(chalk.gray(`    • ${table}`));
            });
        } else if (tables.length > 20) {
            console.log(chalk.gray('\n  Sample Tables:'));
            tables.slice(0, 10).forEach(table => {
                console.log(chalk.gray(`    • ${table}`));
            });
            console.log(chalk.gray(`    ... and ${tables.length - 10} more`));
        }

        console.log(chalk.green('\n✓ Your database is ready for backup operations!\n'));

    } catch (error: any) {
        spinner.fail(chalk.red('Connection failed'));
        console.error(chalk.red(`\n✗ Error: ${error.message}\n`));

        // Provide troubleshooting tips
        console.log(chalk.yellow('Troubleshooting tips:'));
        console.log(chalk.gray('  • Verify database server is running'));
        console.log(chalk.gray('  • Check host and port are correct'));
        console.log(chalk.gray('  • Verify username and password'));
        console.log(chalk.gray('  • Check firewall rules'));
        console.log(chalk.gray('  • Ensure database exists\n'));

        logger.error('Connection test failed', { error: error.message });
        process.exit(1);
    }
}

export default testConnectionCommand;