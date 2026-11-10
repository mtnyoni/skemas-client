import type { TableValue } from '#/db/table-row'

export function stringifyTableValue(value: TableValue): string {
    return JSON.stringify(value, (_key, item: unknown) =>
        typeof item === 'bigint' ? item.toString() : item,
    )
}

export function formatTableValue(value: TableValue): string {
    if (value instanceof Date) return value.toLocaleString()
    if (value instanceof Uint8Array) {
        return `\\x${Array.from(value, (byte) => byte.toString(16).padStart(2, '0')).join('')}`
    }
    if (typeof value === 'object') return stringifyTableValue(value)
    return String(value)
}

export function formatPostgresArray(values: ReadonlyArray<TableValue>): string {
    return `{${values
        .map((value) => {
            if (value === null) return 'NULL'
            if (Array.isArray(value)) return formatPostgresArray(value)
            const text = value instanceof Date ? value.toISOString() : formatTableValue(value)
            return `"${text.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
        })
        .join(',')}}`
}
