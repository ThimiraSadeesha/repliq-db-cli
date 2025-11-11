// Database types
export enum DatabaseType {
    MYSQL = 'mysql',
    POSTGRESQL = 'postgresql',
    MONGODB = 'mongodb'
}

// Backup types
export enum BackupType {
    FULL = 'full',
    INCREMENTAL = 'incremental',
    DIFFERENTIAL = 'differential'
}

// Storage types
export enum StorageType {
    LOCAL = 'local',
    S3 = 's3',
    GCS = 'gcs',
    AZURE = 'azure'
}

// Database connection configuration
export interface DatabaseConfig {
    type: DatabaseType;
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    ssl?: boolean;
}

// Backup configuration
export interface BackupConfig {
    backupType: BackupType;
    compress: boolean;
    storageType: StorageType;
    outputPath?: string;
    s3Config?: S3Config;
    gcsConfig?: GCSConfig;
    azureConfig?: AzureConfig;
    excludeTables?: string[];
    includeTables?: string[];
}

// Cloud storage configurations
export interface S3Config {
    bucket: string;
    region: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    prefix?: string;
}

export interface GCSConfig {
    bucket: string;
    projectId: string;
    keyFilename?: string;
    prefix?: string;
}

export interface AzureConfig {
    connectionString: string;
    containerName: string;
    prefix?: string;
}

// Restore configuration
export interface RestoreConfig {
    backupFile: string;
    targetDatabase?: string;
    tables?: string[];
}

// Backup result
export interface BackupResult {
    success: boolean;
    backupFile: string;
    size: number;
    duration: number;
    timestamp: Date;
    error?: string;
}

// Notification configuration
export interface NotificationConfig {
    slack?: {
        webhookUrl: string;
    };
    email?: {
        to: string[];
        from: string;
    };
}

// Logger options
export interface LogConfig {
    level: 'error' | 'warn' | 'info' | 'debug';
    logFile?: string;
    console: boolean;
}