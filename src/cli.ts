#!/usr/bin/env node

import figlet from 'figlet';
import chalk from 'chalk';
import { showMainMenu } from './utils/prompts';
import { testConnectionCommand } from './commands/test';
import { copyCommand } from './commands/copy';
import { backupCommand } from './commands/backup';
import {SessionState} from "./types/types";


export function showGreeting() {
    console.clear();
    console.log(
        chalk.cyan(
            figlet.textSync('REPLIQ DB', {
                font: 'Standard',
                horizontalLayout: 'default',
            })
        )
    );
    console.log(chalk.gray('━'.repeat(60)));
    console.log(chalk.white('  MySQL Database Backup & Copy Tool'));
    console.log(chalk.gray('  Version 1.0.0'));
    console.log(chalk.green('  Author: ThimiraS'));
    console.log(chalk.gray('━'.repeat(60)));
    console.log();
}

async function main() {
    showGreeting();

    const state: SessionState = {
        sourceConnected: false,
        targetConnected: false,
    };

    let running = true;

    while (running) {
        const action = await showMainMenu(state.sourceConnected, state.targetConnected);

        switch (action) {
            case 'test':
                await testConnectionCommand(state);
                break;

            case 'copy':
                if (state.sourceConfig && state.targetConfig) {
                    await copyCommand(state.sourceConfig, state.targetConfig);
                }
                break;

            case 'backup-source':
                if (state.sourceConfig) {
                    await backupCommand(state.sourceConfig);
                }
                break;

            case 'backup-target':
                if (state.targetConfig) {
                    await backupCommand(state.targetConfig);
                }
                break;

            case 'copy-disabled':
            case 'backup-disabled':
                console.log(chalk.yellow('\n⚠️  Please test connections first!'));
                break;

            case 'exit':
                console.log(chalk.cyan('\n👋 Goodbye!'));
                running = false;
                break;
        }

        if (running && action !== 'exit') {
            console.log('\n' + chalk.gray('─'.repeat(60)) + '\n');
        }
    }
}

main().catch((error) => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
});