import '@tanstack/react-start/server-only'
import { sql } from '#/db'

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

export type DatabaseColumnMetadata = {
    column_name: string
    data_type: string
    udt_name: string
    is_nullable: boolean
    column_default: string | null
    is_identity: boolean
    is_generated: boolean
    is_primary_key: boolean
    is_application_generated: boolean
    is_auto_generated: boolean
    ordinal_position: number
    enum_values: string[]
}

type DatabaseColumnMetadataRow = Omit<
    DatabaseColumnMetadata,
    'enum_values' | 'is_application_generated' | 'is_auto_generated'
> & {
    enum_values: unknown
}

export type InsertValue = string | number | boolean | null

export type QueryValue =
    string | number | boolean | bigint | Date | null | QueryValue[] | { [key: string]: QueryValue }

export async function getSchemas() {
    return sql<DatabaseSchema[]>`
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name NOT LIKE 'pg_%'
          AND schema_name != 'information_schema'
        ORDER BY schema_name
    `
}

export async function getTables(schema: string, query?: string) {
    if (!query) {
        return sql<DatabaseTable[]>`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = ${schema}
              AND table_type = 'BASE TABLE'
            ORDER BY table_name
        `
    }

    return sql<DatabaseTable[]>`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = ${schema}
          AND table_type = 'BASE TABLE'
          AND table_name ILIKE ${'%' + query + '%'}
        ORDER BY table_name
    `
}

export async function runQuery<T extends Record<string, QueryValue>>(query: string) {
    const rows = await sql.unsafe<T[]>(query)

    return {
        columns: Object.keys(rows[0]).map((name) => ({ name })),
        rows,
    }
}

export async function getTableData(
    schema: string,
    table: string,
    options: { limit: number; sort?: string; order: 'asc' | 'desc' },
) {
    const orderBy = options.sort
        ? sql`ORDER BY ${sql(options.sort)} ${options.order === 'asc' ? sql`ASC` : sql`DESC`}`
        : sql``

    const [rows, metadata] = await Promise.all([
        sql<Record<string, QueryValue>[]>`
            SELECT *
            FROM ${sql(`${schema}.${table}`)}
            ${orderBy}
            LIMIT ${options.limit}
        `,
        getTableMetadata(schema, table),
    ])

    return {
        columns: metadata.map((column) => ({ name: column.column_name })),
        rows,
    }
}

export async function getTableMetadata(schema: string, table: string) {
    const rows = await sql<DatabaseColumnMetadataRow[]>`
        SELECT
            table_column.column_name,
            table_column.data_type,
            table_column.udt_name,
            table_column.is_nullable = 'YES' AS is_nullable,
            table_column.column_default,
            table_column.is_identity = 'YES' AS is_identity,
            table_column.is_generated <> 'NEVER' AS is_generated,
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
            ) AS is_primary_key,
            table_column.ordinal_position,
            COALESCE(
                jsonb_agg(enum_value.enumlabel ORDER BY enum_value.enumsortorder)
                    FILTER (WHERE enum_value.enumlabel IS NOT NULL),
                '[]'::jsonb
            ) AS enum_values
        FROM information_schema.columns AS table_column
        LEFT JOIN pg_namespace AS type_namespace
            ON type_namespace.nspname = table_column.udt_schema
        LEFT JOIN pg_type AS column_type
            ON column_type.typnamespace = type_namespace.oid
            AND column_type.typname = table_column.udt_name
        LEFT JOIN pg_enum AS enum_value
            ON enum_value.enumtypid = column_type.oid
        WHERE table_column.table_schema = ${schema}
          AND table_column.table_name = ${table}
        GROUP BY
            table_column.column_name,
            table_column.table_schema,
            table_column.table_name,
            table_column.data_type,
            table_column.udt_name,
            table_column.is_nullable,
            table_column.column_default,
            table_column.is_identity,
            table_column.is_generated,
            table_column.ordinal_position
        ORDER BY table_column.ordinal_position
    `

    return rows.map((column) => {
        const isApplicationGenerated =
            column.is_primary_key &&
            !column.is_identity &&
            !column.is_generated &&
            column.column_default === null &&
            ['uuid', 'text', 'character varying', 'character'].includes(column.data_type)

        return {
            ...column,
            enum_values: normalizeEnumValues(column.enum_values),
            is_application_generated: isApplicationGenerated,
            is_auto_generated:
                column.is_identity ||
                column.is_generated ||
                column.column_default !== null ||
                isApplicationGenerated,
        }
    })
}

function normalizeEnumValues(value: unknown): string[] {
    if (Array.isArray(value))
        return value.filter((item): item is string => typeof item === 'string')
    if (typeof value !== 'string') return []

    try {
        const parsed: unknown = JSON.parse(value)
        return Array.isArray(parsed)
            ? parsed.filter((item): item is string => typeof item === 'string')
            : []
    } catch {
        return []
    }
}

export async function insertTableRow(
    schema: string,
    table: string,
    values: Record<string, InsertValue>,
) {
    const metadata = await getTableMetadata(schema, table)
    const writableColumns = new Set(
        metadata.filter((column) => !column.is_auto_generated).map((column) => column.column_name),
    )
    const insertValues: Record<string, InsertValue> = Object.fromEntries(
        Object.entries(values).filter(([column]) => writableColumns.has(column)),
    )
    for (const column of metadata) {
        if (column.is_application_generated) {
            insertValues[column.column_name] = crypto.randomUUID()
        }
    }
    const entries = Object.entries(insertValues)
    const qualifiedTable = sql(`${schema}.${table}`)

    if (entries.length === 0) {
        const rows = await sql`INSERT INTO ${qualifiedTable} DEFAULT VALUES RETURNING 1`
        return { rowCount: rows.length }
    }

    const rows = await sql`INSERT INTO ${qualifiedTable} ${sql(insertValues)} RETURNING 1`

    return { rowCount: rows.length }
}

export async function getDBRelationships(schema: string) {
    const [tables, columns, relationships] = await Promise.all([
        getTables(schema),
        sql<DatabaseDiagramColumn[]>`
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
        `,
        sql<DatabaseRelationship[]>`
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
        `,
    ])

    const columnsByTable = new Map<string, DatabaseDiagramColumn[]>()
    for (const column of columns) {
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
        relationships,
    }
}
