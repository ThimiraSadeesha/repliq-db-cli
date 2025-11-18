export function formatValue(v: any) {
    if (v === null || v === undefined) return 'NULL';
    if (v instanceof Date) {
        return `'${v.getFullYear()}-${(v.getMonth()+1).toString().padStart(2,'0')}-${v.getDate().toString().padStart(2,'0')} ${v.getHours().toString().padStart(2,'0')}:${v.getMinutes().toString().padStart(2,'0')}:${v.getSeconds().toString().padStart(2,'0')}'`;
    }
    return `'${v.toString().replace(/'/g,"\\'")}'`;
}
