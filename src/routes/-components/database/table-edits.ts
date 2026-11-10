import type { DatabaseColumnMetadata } from '#/internal'
import type { TableRow } from '#/db/table-row'
import { editValue } from './table-value'

export type RowDraft = {
    row: TableRow
    values: Record<string, string>
}

export function getRowIdentity(row: TableRow, columns: readonly DatabaseColumnMetadata[]) {
    if (!columns.length) return null
    const key: Record<string, string | number | boolean> = {}
    for (const column of columns) {
        const value = row[column.column_name]
        if (
            typeof value !== 'string' &&
            typeof value !== 'number' &&
            typeof value !== 'boolean' &&
            typeof value !== 'bigint'
        )
            return null
        if (typeof value === 'number' && !Number.isFinite(value)) return null
        key[column.column_name] = typeof value === 'bigint' ? value.toString() : value
    }
    return { id: JSON.stringify(Object.entries(key)), key }
}

export function updateCellDraft(
    drafts: ReadonlyMap<string, RowDraft>,
    row: TableRow,
    column: DatabaseColumnMetadata,
    keyColumns: readonly DatabaseColumnMetadata[],
    value: string,
) {
    const next = new Map(drafts)
    const identity = getRowIdentity(row, keyColumns)
    if (!identity) return next
    const original = drafts.get(identity.id)?.row ?? row
    const values = { ...drafts.get(identity.id)?.values }
    if (value === editValue(original[column.column_name], column)) {
        delete values[column.column_name]
    } else {
        values[column.column_name] = value
    }
    if (Object.keys(values).length) next.set(identity.id, { row: original, values })
    else next.delete(identity.id)
    return next
}
