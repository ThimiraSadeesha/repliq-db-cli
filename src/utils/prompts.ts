import inquirer from 'inquirer';
import {DBConfig} from "../types/types";
import chalk from "chalk";


export async function promptCredentials(dbName: string): Promise<DBConfig> {
    console.log(`\n${dbName} Database Configuration:`);
    return inquirer.prompt([
        { name: 'host', message: 'Host:', default: 'localhost' },
        { name: 'port', message: 'Port:', default: 3306, type: 'number' },
        { name: 'user', message: 'User:', default: 'root' },
        { name: 'password', message: 'Password:', type: 'password', mask: '*' },
        { name: 'database', message: 'Database name:' },
    ]);
}

export async function confirmAction(message: string): Promise<boolean> {
    const answer = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'confirmed',
            message,
            default: false,
        },
    ]);
    return answer.confirmed;
}

export async function showMainMenu(sourceConnected: boolean, targetConnected: boolean): Promise<string> {
    const choices = [
        { name: '🔌 Test Connection', value: 'test' },
    ];

    if (sourceConnected && targetConnected) {
        choices.push(
            { name: '📋 Copy Database (Source → Target)', value: 'copy' },
            { name: '💾 Backup Source Database', value: 'backup-source' },
            { name: '💾 Backup Target Database', value: 'backup-target' }
        );
    } else {
        choices.push(
            { name: chalk.gray('📋 Copy Database (Test connection first)'), value: 'copy-disabled' },
            { name: chalk.gray('💾 Backup Database (Test connection first)'), value: 'backup-disabled' }
        );
    }

    choices.push({ name: '❌ Exit', value: 'exit' });

    const answer = await inquirer.prompt([
        {
            type: 'list',
            name: 'action',
            message: 'What would you like to do?',
            choices,
        },
    ]);

    return answer.action;
}
export async function askMultiSelect(
    choices: { name: string; value: string; checked?: boolean }[],
    message: string
): Promise<string[]> {
    const answers = await inquirer.prompt([
        {
            type: 'checkbox',
            name: 'selected',
            message,
            choices,
            validate: (answer: string[]) => {
                if (answer.length < 1) {
                    return 'You must choose at least one option.';
                }
                return true;
            },
        },
    ]);
    return answers.selected;
}

export function getCreateSQL(result: any[], key: string, objectName?: string): string | null {
    if (!result || !result[0]) {
        if (objectName) console.log(chalk.red(`⚠️ Could not read CREATE statement for ${objectName}`));
        return null;
    }
    return result[0][key] ?? null;
}

export function getRoutineCreateSQL(createStmt: any[], type: 'PROCEDURE' | 'FUNCTION', name: string): string | null {
    if (!createStmt || !createStmt[0]) {
        console.log(chalk.red(`⚠️ Could not get CREATE statement for ${type} ${name}`));
        return null;
    }
    const key = Object.keys(createStmt[0]).find(k => k.toLowerCase() === `create ${type.toLowerCase()}`);
    if (!key) {
        console.log(chalk.red(`⚠️ CREATE statement column not found for ${type} ${name}`));
        return null;
    }
    return createStmt[0][key];
}