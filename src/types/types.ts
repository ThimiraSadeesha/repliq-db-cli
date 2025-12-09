export interface DBConfig {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
}

export interface SessionState {
    sourceConfig?: DBConfig;
    targetConfig?: DBConfig;
    sourceConnected: boolean;
    targetConnected: boolean;
}

export type RoutineRow = {
    ROUTINE_NAME: string;
    ROUTINE_TYPE: 'PROCEDURE' | 'FUNCTION';
};

export type TriggerRow = {
    Trigger: string;
};

export type EventRow = {
    Name: string;
};