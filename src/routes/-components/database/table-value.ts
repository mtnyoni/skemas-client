import { NULL_VALUE } from './cell-constants'
import type { DatabaseColumnMetadata } from '#/internal'
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

export function editValue(value: TableValue, column: DatabaseColumnMetadata): string {
    if (value === null) return NULL_VALUE
    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) return value.toString()
        const iso = value.toISOString()
        if (column.data_type === 'date') return iso.slice(0, 10)
        if (column.data_type.includes('timestamp')) return iso.slice(0, 16)
        if (column.data_type.includes('time')) return iso.slice(11, 19)
        return iso
    }
    if (column.data_type === 'json' || column.data_type === 'jsonb') {
        return stringifyTableValue(value)
    }
    if (column.data_type === 'ARRAY' && Array.isArray(value)) {
        return formatPostgresArray(value)
    }
    if (
        column.data_type === 'interval' &&
        typeof value === 'object' &&
        'months' in value &&
        'days' in value &&
        'microseconds' in value
    ) {
        return `${String(value.months)} mons ${String(value.days)} days ${String(value.microseconds)} microseconds`
    }
    if (typeof value === 'bigint' && column.data_type === 'time without time zone') {
        const hours = value / 3_600_000_000n
        const minutes = (value / 60_000_000n) % 60n
        const seconds = (value / 1_000_000n) % 60n
        const fraction = String(value % 1_000_000n).padStart(6, '0')
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${fraction}`
    }
    if (typeof value === 'object') return formatTableValue(value)
    return String(value)
}
