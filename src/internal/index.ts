import { db } from '#/db'
import { sql } from 'drizzle-orm'

export type DatabaseSchema = {
    schema_name: string
}

export type DatabaseTable = {
    table_name: string
}

export type QueryValue =
    string | number | boolean | bigint | Date | null | QueryValue[] | { [key: string]: QueryValue }

export async function getSchemas() {
    const result = await db.execute<DatabaseSchema>(sql`
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name NOT LIKE 'pg_%'
          AND schema_name != 'information_schema'
        ORDER BY schema_name
    `)

    return result.rows
}

export async function getTables(schema: string) {
    const result = await db.execute<DatabaseTable>(sql`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = ${schema}
          AND table_type = 'BASE TABLE'
        ORDER BY table_name
    `)

    return result.rows
}

export async function runQuery<T extends Record<string, QueryValue>>(query: string) {
    const result = await db.execute<T>(sql.raw(query))

    return {
        columns: result.fields.map((field) => ({
            name: field.name,
            tableId: field.tableID,
            columnId: field.columnID,
            dataTypeId: field.dataTypeID,
            dataTypeSize: field.dataTypeSize,
            dataTypeModifier: field.dataTypeModifier,
            format: field.format,
        })),
        rows: result.rows,
    }
}

function quoteIdentifier(identifier: string) {
    return `"${identifier.replaceAll('"', '""')}"`
}

export function getTableData(
    schema: string,
    table: string,
    options: { limit: number; sort?: string; order: 'asc' | 'desc' },
) {
    const qualifiedTable = `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`
    const orderBy = options.sort
        ? ` ORDER BY ${quoteIdentifier(options.sort)} ${options.order.toUpperCase()}`
        : ''

    return runQuery(`SELECT * FROM ${qualifiedTable}${orderBy} LIMIT ${options.limit}`)
}
