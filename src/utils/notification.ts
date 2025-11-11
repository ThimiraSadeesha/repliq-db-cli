import { IncomingWebhook } from '@slack/webhook';
import logger from "lumilogger";
import type {BackupResult} from "../types/types";

export class NotificationService {
    private slackWebhook?: IncomingWebhook;

    constructor(webhookUrl?: string) {
        if (webhookUrl) {
            this.slackWebhook = new IncomingWebhook(webhookUrl);
        }
    }

    async notifyBackupComplete(result: BackupResult, database: string): Promise<void> {
        if (!this.slackWebhook) {
            logger.warn('Slack webhook not configured, skipping notification');
            return;
        }

        try {
            const message = this.buildBackupMessage(result, database);
            await this.slackWebhook.send(message);
            logger.info('Backup notification sent successfully');
        } catch (error) {
            logger.error('Failed to send backup notification', error);
        }
    }

    async notifyRestoreComplete(
        success: boolean,
        database: string,
        duration: number,
        error?: string
    ): Promise<void> {
        if (!this.slackWebhook) {
            logger.warn('Slack webhook not configured, skipping notification');
            return;
        }

        try {
            const message = this.buildRestoreMessage(success, database, duration, error);
            await this.slackWebhook.send(message);
            logger.info('Restore notification sent successfully');
        } catch (error) {
            logger.error('Failed to send restore notification', error);
        }
    }


    private buildBackupMessage(result: BackupResult, database: string): any {
        const color = result.success ? 'good' : 'danger';
        const emoji = result.success ? ':white_check_mark:' : ':x:';
        const status = result.success ? 'Successful' : 'Failed';

        return {
            text: `${emoji} Database Backup ${status}`,
            attachments: [
                {
                    color,
                    fields: [
                        {
                            title: 'Database',
                            value: database,
                            short: true
                        },
                        {
                            title: 'Status',
                            value: status,
                            short: true
                        },
                        {
                            title: 'Backup File',
                            value: result.backupFile,
                            short: false
                        },
                        {
                            title: 'Size',
                            value: `${(result.size / 1024 / 1024).toFixed(2)} MB`,
                            short: true
                        },
                        {
                            title: 'Duration',
                            value: `${(result.duration / 1000).toFixed(2)} seconds`,
                            short: true
                        },
                        {
                            title: 'Timestamp',
                            value: result.timestamp.toISOString(),
                            short: false
                        }
                    ],
                    footer: 'DB Backup CLI',
                    ts: Math.floor(result.timestamp.getTime() / 1000)
                }
            ]
        };
    }

    private buildRestoreMessage(
        success: boolean,
        database: string,
        duration: number,
        error?: string
    ): any {
        const color = success ? 'good' : 'danger';
        const emoji = success ? ':white_check_mark:' : ':x:';
        const status = success ? 'Successful' : 'Failed';

        const fields: any[] = [
            {
                title: 'Database',
                value: database,
                short: true
            },
            {
                title: 'Status',
                value: status,
                short: true
            },
            {
                title: 'Duration',
                value: `${(duration / 1000).toFixed(2)} seconds`,
                short: true
            }
        ];

        if (error) {
            fields.push({
                title: 'Error',
                value: error,
                short: false
            });
        }

        return {
            text: `${emoji} Database Restore ${status}`,
            attachments: [
                {
                    color,
                    fields,
                    footer: 'DB Backup CLI',
                    ts: Math.floor(Date.now() / 1000)
                }
            ]
        };
    }


    async sendNotification(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): Promise<void> {
        if (!this.slackWebhook) {
            return;
        }

        const colorMap = {
            info: '#439FE0',
            success: 'good',
            warning: 'warning',
            error: 'danger'
        };

        // try {
        //     await this.slackWebhook.send({
        //         text: message,
        //         attachments: [
        //             {
        //                 color: colorMap[type],
        //                 text: message,
        //                 footer: 'DB Backup CLI',
        //                 ts: Math.floor(Date.now() / 1000)
        //             }
        //         ]
        //     });
        // } catch (error) {
        //     logger.error('Failed to send notification', error);
        // }
    }
}

export default NotificationService;