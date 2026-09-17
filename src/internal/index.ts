import { db } from '#/db'
import { sql } from 'drizzle-orm'

export type DatabaseSchema = {
    schema_name: string
}

export type DatabaseTable = {
    table_name: string
}

export type DatabaseRelationship = {
    constraint_name: string
    source_schema: string
    source_table: string
    source_column: string
    target_schema: string
    target_table: string
    target_column: string
}

export type DatabaseDiagramColumn = {
    table_name: string
    column_name: string
    data_type: string
    is_nullable: boolean
    is_primary_key: boolean
    ordinal_position: number
}

export type DatabaseDiagramTable = {
    table_name: string
    columns: DatabaseDiagramColumn[]
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

export async function getDBRelationships(schema: string) {
    const [tables, columns, relationships] = await Promise.all([
        getTables(schema),
        db.execute<DatabaseDiagramColumn>(sql`
            SELECT
                table_column.table_name,
                table_column.column_name,
                table_column.data_type,
                table_column.is_nullable = 'YES' AS is_nullable,
                table_column.ordinal_position,
                EXISTS (
                    SELECT 1
                    FROM information_schema.table_constraints AS table_constraint
                    INNER JOIN information_schema.key_column_usage AS key_column
                        ON key_column.constraint_catalog = table_constraint.constraint_catalog
                        AND key_column.constraint_schema = table_constraint.constraint_schema
                        AND key_column.constraint_name = table_constraint.constraint_name
                    WHERE table_constraint.constraint_type = 'PRIMARY KEY'
                      AND table_constraint.table_schema = table_column.table_schema
                      AND table_constraint.table_name = table_column.table_name
                      AND key_column.column_name = table_column.column_name
                ) AS is_primary_key
            FROM information_schema.columns AS table_column
            INNER JOIN information_schema.tables AS database_table
                ON database_table.table_schema = table_column.table_schema
                AND database_table.table_name = table_column.table_name
                AND database_table.table_type = 'BASE TABLE'
            WHERE table_column.table_schema = ${schema}
            ORDER BY table_column.table_name, table_column.ordinal_position
        `),
        db.execute<DatabaseRelationship>(sql`
            SELECT
                constraint_definition.conname AS constraint_name,
                source_namespace.nspname AS source_schema,
                source_table.relname AS source_table,
                source_column.attname AS source_column,
                target_namespace.nspname AS target_schema,
                target_table.relname AS target_table,
                target_column.attname AS target_column
            FROM pg_constraint AS constraint_definition
            INNER JOIN pg_class AS source_table
                ON source_table.oid = constraint_definition.conrelid
            INNER JOIN pg_namespace AS source_namespace
                ON source_namespace.oid = source_table.relnamespace
            INNER JOIN pg_class AS target_table
                ON target_table.oid = constraint_definition.confrelid
            INNER JOIN pg_namespace AS target_namespace
                ON target_namespace.oid = target_table.relnamespace
            INNER JOIN LATERAL
                unnest(constraint_definition.conkey) WITH ORDINALITY
                AS source_key(attnum, position)
                ON true
            INNER JOIN LATERAL
                unnest(constraint_definition.confkey) WITH ORDINALITY
                AS target_key(attnum, position)
                ON target_key.position = source_key.position
            INNER JOIN pg_attribute AS source_column
                ON source_column.attrelid = constraint_definition.conrelid
                AND source_column.attnum = source_key.attnum
            INNER JOIN pg_attribute AS target_column
                ON target_column.attrelid = constraint_definition.confrelid
                AND target_column.attnum = target_key.attnum
            WHERE constraint_definition.contype = 'f'
              AND source_namespace.nspname = ${schema}
            ORDER BY source_table.relname, constraint_definition.conname, source_key.position
        `),
    ])

    const columnsByTable = new Map<string, DatabaseDiagramColumn[]>()
    for (const column of columns.rows) {
        const tableColumns = columnsByTable.get(column.table_name) ?? []
        tableColumns.push(column)
        columnsByTable.set(column.table_name, tableColumns)
    }
    const diagramTables: DatabaseDiagramTable[] = tables.map((table) => ({
        table_name: table.table_name,
        columns: columnsByTable.get(table.table_name) ?? [],
    }))

    return {
        tables: diagramTables,
        relationships: relationships.rows,
    }
}
