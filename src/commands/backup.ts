import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { createReadStream, createWriteStream } from 'fs';
import logger from 'lumilogger';

interface BackupOptions {
    host: string;
    port?: string;
    user: string;
    password: string;
    database: string;
    outputDir: string;
    compress?: boolean;
}

export async function backupMySQL(options: BackupOptions): Promise<string> {
    let filePath: string | null = null;

    try {
        logger.log('🔄 Starting MySQL backup...');
        logger.log(`📍 Host: ${options.host}:${options.port || '3306'}`);
        logger.log(`🗄️  Database: ${options.database}`);
        logger.log(`📁 Output directory: ${options.outputDir}`);

        // Ensure output directory exists
        await fs.mkdir(options.outputDir, { recursive: true });

        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const fileName = `${options.database}-${timestamp}.sql`;
        filePath = path.join(options.outputDir, fileName);

        // Prepare mysqldump arguments
        const port = options.port || '3306';
        const args = [
            '-h', options.host,
            '-P', port,
            '-u', options.user,
            '--single-transaction',
            '--quick',
            '--lock-tables=false',
            '--routines',  // Include stored procedures and functions
            '--triggers',  // Include triggers
            options.database
        ];

        logger.log('⏳ Dumping database...');

        // Create write stream for the output file
        const fileStream = createWriteStream(filePath);

        // Spawn mysqldump process
        const mysqldump = spawn('mysqldump', args, {
            env: { ...process.env, MYSQL_PWD: options.password },
            stdio: ['ignore', 'pipe', 'pipe']  // Explicitly define stdio
        });

        // Pipe stdout to file
        mysqldump.stdout.pipe(fileStream);

        // Collect stderr for warnings/errors
        let stderr = '';
        mysqldump.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        // Wait for process to complete
        await new Promise<void>((resolve, reject) => {
            let isResolved = false;

            mysqldump.on('close', (code) => {
                if (isResolved) return;
                isResolved = true;

                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`mysqldump exited with code ${code}${stderr ? `: ${stderr}` : ''}`));
                }
            });

            mysqldump.on('error', (error) => {
                if (isResolved) return;
                isResolved = true;
                reject(error);
            });

            fileStream.on('error', (error) => {
                if (isResolved) return;
                isResolved = true;
                mysqldump.kill();  // Kill the process if file write fails
                reject(error);
            });

            fileStream.on('finish', () => {
                // Stream finished writing
            });
        });

        // Log warnings if any (but filter out common harmless warnings)
        if (stderr) {
            const filteredWarnings = stderr.trim()
                .split('\n')
                .filter(line =>
                    !line.includes('Using a password on the command line') &&
                    line.trim().length > 0
                );

            if (filteredWarnings.length > 0) {
                logger.warn('⚠️  Warnings during backup:');
                filteredWarnings.forEach(line => logger.warn(`   ${line}`));
            }
        }

        // Get file size and verify backup is not empty
        const stats = await fs.stat(filePath);

        if (stats.size === 0) {
            throw new Error('Backup file is empty - backup may have failed');
        }

        const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        logger.log(`✅ Backup created: ${fileName} (${fileSizeMB} MB)`);

        // Compress if requested
        if (options.compress) {
            logger.log('🗜️  Compressing backup...');
            const compressedPath = `${filePath}.gz`;

            await pipeline(
                createReadStream(filePath),
                createGzip({ level: 9 }),
                createWriteStream(compressedPath)
            );

            // Remove uncompressed file
            await fs.unlink(filePath);

            const compressedStats = await fs.stat(compressedPath);
            const compressedSizeMB = (compressedStats.size / (1024 * 1024)).toFixed(2);
            const compressionRatio = ((1 - compressedStats.size / stats.size) * 100).toFixed(1);

            logger.log(`✅ Backup compressed: ${fileName}.gz (${compressedSizeMB} MB)`);
            logger.log(`📊 Compression ratio: ${compressionRatio}%`);

            return compressedPath;
        }

        return filePath;

    } catch (error) {
        logger.error('❌ Backup failed');

        if (error instanceof Error) {
            if (error.message.includes('ENOENT') || error.message.includes('spawn mysqldump')) {
                logger.error('   mysqldump not found - ensure MySQL client tools are installed');
                logger.error('   Install: apt-get install mysql-client (Ubuntu) or brew install mysql-client (macOS)');
            } else if (error.message.includes('Access denied')) {
                logger.error('   Access denied - check username and password');
            } else if (error.message.includes('Unknown database')) {
                logger.error('   Database does not exist');
            } else if (error.message.includes('EACCES')) {
                logger.error('   Permission denied - check output directory permissions');
            } else if (error.message.includes('ENOSPC')) {
                logger.error('   No space left on device');
            } else {
                logger.error(`   ${error.message}`);
            }
        } else {
            logger.error('   Unknown error:', error);
        }

        // Cleanup partial backup file if it exists
        if (filePath) {
            try {
                await fs.unlink(filePath);
                logger.log('   Cleaned up partial backup file');
            } catch {
                // Ignore cleanup errors
            }
        }

        throw error;
    }
}