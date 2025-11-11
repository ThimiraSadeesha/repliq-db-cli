import archiver from 'archiver';
import fs from 'fs-extra';
import path from 'path';
import { createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import logger from "lumilogger";


export class CompressionUtil {

    async compressFile(inputPath: string, outputPath?: string): Promise<string> {
        const output = outputPath || `${inputPath}.gz`;

        logger.info(`Compressing file: ${inputPath}`);

        return new Promise((resolve, reject) => {
            const outputStream = fs.createWriteStream(output);
            const archive = archiver('tar', {
                gzip: true,
                gzipOptions: {
                    level: 9 // Maximum compression
                }
            });

            outputStream.on('close', () => {
                const size = archive.pointer();
                logger.info(`Compression complete. Size: ${(size / 1024 / 1024).toFixed(2)}MB`);
                resolve(output);
            });

            archive.on('error', (err) => {
                logger.error('Compression error', err);
                reject(err);
            });

            archive.pipe(outputStream);
            archive.file(inputPath, { name: path.basename(inputPath) });
            archive.finalize();
        });
    }

    async compressMultipleFiles(files: string[], outputPath: string): Promise<string> {
        logger.info(`Compressing ${files.length} files into archive: ${outputPath}`);

        return new Promise((resolve, reject) => {
            const outputStream = fs.createWriteStream(outputPath);
            const archive = archiver('tar', {
                gzip: true,
                gzipOptions: {
                    level: 9
                }
            });

            outputStream.on('close', () => {
                const size = archive.pointer();
                logger.info(`Archive created. Size: ${(size / 1024 / 1024).toFixed(2)}MB`);
                resolve(outputPath);
            });

            archive.on('error', (err) => {
                logger.error('Archive creation error', err);
                reject(err);
            });

            archive.pipe(outputStream);

            files.forEach(file => {
                if (fs.existsSync(file)) {
                    archive.file(file, { name: path.basename(file) });
                }
            });

            archive.finalize();
        });
    }


    async decompressFile(inputPath: string, outputPath?: string): Promise<string> {
        const output = outputPath || inputPath.replace(/\.gz$/, '');

        logger.info(`Decompressing file: ${inputPath}`);

        try {
            const source = fs.createReadStream(inputPath);
            const destination = fs.createWriteStream(output);
            const gunzip = createGunzip();

            await pipeline(source, gunzip, destination);

            logger.info(`Decompression complete: ${output}`);
            return output;
        } catch (error) {
            logger.error('Decompression error', error);
            throw error;
        }
    }


    // async getCompressedSize(filePath: string): Promise<number> {
    //     const stats = await fs.stat(filePath);
    //     return stats.size;
    // }
    //
    //
    // async getCompressionRatio(originalPath: string, compressedPath: string): Promise<number> {
    //     const originalSize = (await fs.stat(originalPath)).size;
    //     const compressedSize = (await fs.stat(compressedPath)).size;
    //
    //     return ((1 - compressedSize / originalSize) * 100);
    // }
}

export default new CompressionUtil();