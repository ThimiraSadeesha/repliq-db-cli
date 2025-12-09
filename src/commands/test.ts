import chalk from 'chalk';
import {confirmAction, promptCredentials} from '../utils/prompts';
import { testConnection } from '../utils/connection';
import {SessionState} from "../types/types";


export async function testConnectionCommand(state: SessionState): Promise<void> {
    let srcOk = false;
    let tgtOk = false;

    //  Source DB
    while (!srcOk) {
        console.log(chalk.cyan('\n🔹 Testing Source Database...'));
        const src = await promptCredentials('Source');
        srcOk = await testConnection(src);

        if (srcOk) {
            state.sourceConfig = src;
            state.sourceConnected = true;
            console.log(chalk.green('✅ Source DB reachable!'));
        } else {
            state.sourceConnected = false;
            console.log(chalk.red('❌ Source DB connection failed! Try again.'));
            const retry = await confirmAction('Do you want to re-enter source credentials?');
            if (!retry) break; // user chooses not to retry
        }
    }

    // Target DB
    while (!tgtOk) {
        console.log(chalk.cyan('\n🔹 Testing Target Database...'));
        const tgt = await promptCredentials('Target');
        tgtOk = await testConnection(tgt);

        if (tgtOk) {
            state.targetConfig = tgt;
            state.targetConnected = true;
            console.log(chalk.green('✅ Target DB reachable!'));
        } else {
            state.targetConnected = false;
            console.log(chalk.red('❌ Target DB connection failed! Try again.'));
            const retry = await confirmAction('Do you want to re-enter target credentials?');
            if (!retry) break; // user chooses not to retry
        }
    }

    if (srcOk && tgtOk) {
        console.log(chalk.green('\n🎯 Both databases are reachable and ready!'));
    }
}