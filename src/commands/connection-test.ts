import mysql from 'mysql2/promise';
import {MySQLConfig} from "../types/mysql";
import logger from "lumilogger";

export async function testConnection(config: MySQLConfig) {
    let connection;

    try {
        logger.log('🔄 Testing MySQL connection...');
        logger.log(`📍 Host: ${config.host}:${config.port}`);
        logger.log(`👤 User: ${config.user}`);
        logger.log(`🗄️  Database: ${config.database}`);

        connection = await mysql.createConnection(config);
        await connection.ping();

        // Get server version for additional info
        const [rows] = await connection.query('SELECT VERSION() as version');
        const version = (rows as any)[0]?.version;

        logger.log('✅ MySQL connection successful!');
        if (version) {
            logger.log(`📦 Server version: ${version}`);
        }

        await connection.end();
        return true;
    } catch (error) {
        logger.error('❌ MySQL connection failed');

        if (error instanceof Error) {
            // Provide more specific error messages
            if (error.message.includes('ECONNREFUSED')) {
                logger.error('   Connection refused - check if MySQL is running and accessible');
            } else if (error.message.includes('ER_ACCESS_DENIED_ERROR')) {
                logger.error('   Access denied - check username and password');
            } else if (error.message.includes('ENOTFOUND')) {
                logger.error('   Host not found - check the host address');
            } else if (error.message.includes('ER_BAD_DB_ERROR')) {
                logger.error('   Database does not exist');
            } else {
                logger.error(`   ${error.message}`);
            }
        } else {
            logger.error('   Unknown error:', error);
        }

        return false;
    } finally {
        if (connection) {
            try {
                await connection.end();
            } catch (closeError) {
            }
        }
    }
}