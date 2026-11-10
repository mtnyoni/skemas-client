import '@tanstack/react-start/server-only'
import { Effect, Schema } from 'effect'
import type { TableColumnMetadata, TableColumnsMetadata } from './table-metadata'

export type TableValue =
    | string
    | number
    | boolean
    | bigint
    | Date
    | Uint8Array
    | null
    | ReadonlyArray<TableValue>
    | { readonly [key: string]: TableValue }

export type TableRow = { readonly [column: string]: TableValue }

type ValueSchema = Schema.Codec<TableValue>

const IntervalSchema = Schema.Struct({
    months: Schema.Int,
    days: Schema.Int,
    microseconds: Schema.BigInt,
})

// These schemas match @effect/sql-pg's default decoded values, without coercion.
const scalarSchemas = new Map<string, ValueSchema>(
    Object.entries({
        bool: Schema.Boolean,
        boolean: Schema.Boolean,
        int2: Schema.Int,
        smallint: Schema.Int,
        int4: Schema.Int,
        integer: Schema.Int,
        oid: Schema.Int,
        int8: Schema.BigInt,
        bigint: Schema.BigInt,
        float4: Schema.Number,
        real: Schema.Number,
        float8: Schema.Number,
        'double precision': Schema.Number,
        numeric: Schema.String,
        decimal: Schema.String,
        date: Schema.String,
        timestamp: Schema.instanceOf(Date),
        'timestamp without time zone': Schema.instanceOf(Date),
        timestamptz: Schema.instanceOf(Date),
        'timestamp with time zone': Schema.instanceOf(Date),
        time: Schema.BigInt,
        'time without time zone': Schema.BigInt,
        timetz: Schema.String,
        'time with time zone': Schema.String,
        interval: IntervalSchema,
        json: Schema.Json,
        jsonb: Schema.Json,
        bytea: Schema.Uint8Array,
    }),
)

function createArrayValueSchema(element: ValueSchema): ValueSchema {
    // PostgreSQL arrays may contain NULL elements and multiple dimensions.
    const item: ValueSchema = Schema.suspend(() =>
        Schema.NullOr(Schema.Union([element, Schema.Array(item)])),
    )
    return Schema.Array(item)
}

function createColumnValueSchema(column: TableColumnMetadata): ValueSchema {
    let value: ValueSchema
    if (column.data_type === 'ARRAY') {
        const elementType = column.udt_name.startsWith('_')
            ? column.udt_name.slice(1)
            : column.udt_name
        value = createArrayValueSchema(scalarSchemas.get(elementType) ?? Schema.String)
    } else if (column.enum_values.length > 0) {
        value = Schema.Literals(column.enum_values)
    } else {
        // Unregistered PostgreSQL types use the driver's UTF-8 string fallback.
        value =
            scalarSchemas.get(column.udt_name) ??
            scalarSchemas.get(column.data_type) ??
            Schema.String
    }
    return column.is_nullable ? Schema.NullOr(value) : value
}

export function createTableRowSchema(columns: TableColumnsMetadata) {
    const fields: Record<string, ValueSchema> = Object.fromEntries(
        columns.map((column) => [column.column_name, createColumnValueSchema(column)]),
    )
    return Schema.Struct(fields)
}

export function validateTableRows(rows: unknown, columns: TableColumnsMetadata) {
    return Effect.gen(function* () {
        const rowSchema = createTableRowSchema(columns)
        return yield* Schema.decodeUnknownEffect(Schema.Array(rowSchema), {
            onExcessProperty: 'error',
        })(rows)
    })
}
