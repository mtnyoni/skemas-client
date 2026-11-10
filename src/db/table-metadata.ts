import '@tanstack/react-start/server-only'
import { Array, Data, Effect, Predicate, Result, Schema } from 'effect'
import { Sql } from './effect'

const TableColumnMetadataRowSchema = Schema.Struct({
    column_name: Schema.String,
    data_type: Schema.String,
    udt_name: Schema.String,
    is_nullable: Schema.Boolean,
    column_default: Schema.NullOr(Schema.String),
    is_identity: Schema.Boolean,
    is_generated: Schema.Boolean,
    is_primary_key: Schema.Boolean,
    ordinal_position: Schema.Number,
    enum_values: Schema.Unknown,
})
type TableColumnMetadataRow = Schema.Schema.Type<typeof TableColumnMetadataRowSchema>

const TableColumnMetadataRowsSchema = Schema.Array(TableColumnMetadataRowSchema)

export const TableColumnMetadataSchema = Schema.Struct({
    ...TableColumnMetadataRowSchema.fields,
    enum_values: Schema.Array(Schema.String),
    is_application_generated: Schema.Boolean,
    is_auto_generated: Schema.Boolean,
})
export type TableColumnMetadata = Schema.Schema.Type<typeof TableColumnMetadataSchema>

export const TableColumnsMetadataSchema = Schema.Array(TableColumnMetadataSchema)
export type TableColumnsMetadata = Schema.Schema.Type<typeof TableColumnsMetadataSchema>

export type TableColumnMetadataWarning = {
    readonly schema: string
    readonly table: string
    readonly column: string
    readonly error: EnumValuesParseError
}

export type TableColumnMetadataResult = {
    readonly columns: TableColumnsMetadata
    readonly warnings: ReadonlyArray<TableColumnMetadataWarning>
}

export const getTableColumnMetadata = (schema: string, table: string) =>
    Effect.gen(function* () {
        const sql = yield* Sql
        const statement = sql /* sql */ `
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

        const result = yield* statement
        const rows = yield* Schema.decodeUnknownEffect(TableColumnMetadataRowsSchema)(result)
        const normalizedRows = yield* Effect.forEach(rows, normalizeTableColumnMetadata)
        const metadata: TableColumnMetadataResult = {
            columns: normalizedRows.map((row) => row.column),
            warnings: normalizedRows.flatMap((row) =>
                row.warnings.map((error) => ({
                    schema,
                    table,
                    column: row.column.column_name,
                    error,
                })),
            ),
        }
        return metadata
    })

function normalizeTableColumnMetadata(column: TableColumnMetadataRow) {
    return Effect.gen(function* () {
        const enumResult = yield* Effect.result(normalizeEnumValues(column.enum_values))
        const warnings: EnumValuesParseError[] = []
        let enumValues: string[] = []

        if (Result.isFailure(enumResult)) {
            warnings.push(enumResult.failure)
        } else {
            enumValues = enumResult.success
        }

        const applicationGenerated = requiresApplicationGeneratedKey(column)
        const databaseGenerated = hasDatabaseGeneratedValue(column)

        return {
            column: {
                ...column,
                enum_values: enumValues,
                is_application_generated: applicationGenerated,
                is_auto_generated: databaseGenerated || applicationGenerated,
            },
            warnings,
        }
    })
}

export class EnumValuesParseError extends Data.TaggedError('EnumValuesParseError')<{
    readonly message: string
    readonly cause?: unknown
}> {}

function normalizeEnumValues(value: unknown) {
    return Effect.gen(function* () {
        if (Array.isArray(value)) {
            return value.filter(Predicate.isString)
        }

        if (Predicate.isString(value)) {
            return yield* parseEnumValuesJson(value)
        }

        return []
    })
}

export function parseEnumValuesJson(json: string) {
    return Effect.gen(function* () {
        const parsed = yield* Effect.try({
            try: (): unknown => JSON.parse(json),
            catch: (error) =>
                new EnumValuesParseError({
                    message: 'Failed to parse enum values as JSON.',
                    cause: error,
                }),
        })

        if (!Array.isArray(parsed)) {
            return yield* Effect.fail(
                new EnumValuesParseError({ message: 'Enum values JSON must contain an array.' }),
            )
        }

        return parsed.filter(Predicate.isString)
    })
}

function hasDatabaseGeneratedValue(column: TableColumnMetadataRow) {
    return column.is_identity || column.is_generated || column.column_default !== null
}

function requiresApplicationGeneratedKey(column: TableColumnMetadataRow) {
    return (
        column.is_primary_key &&
        !column.is_identity &&
        !column.is_generated &&
        column.column_default === null &&
        ['uuid', 'text', 'character varying', 'character'].includes(column.data_type)
    )
}
