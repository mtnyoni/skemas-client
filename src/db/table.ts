import '@tanstack/react-start/server-only'
import { Effect } from 'effect'
import type { Row } from 'effect/sql/SqlConnection'
import { Sql, SqlLive } from './effect'
import { getTableColumnMetadata } from './table-metadata'
import { validateTableRows } from './table-row'

export function getTableData(
    schema: string,
    table: string,
    options: { limit: number; sort?: string; order: 'asc' | 'desc' },
) {
    const program = Effect.gen(function* () {
        const sql = yield* Sql
        const orderBy = options.sort
            ? sql`ORDER BY ${sql(options.sort)} ${options.order === 'asc' ? sql`ASC` : sql`DESC`}`
            : sql``

        const [rows, { columns, warnings }] = yield* Effect.all(
            [
                sql<Row>`
                    SELECT *
                    FROM ${sql(schema)}.${sql(table)}
                    ${orderBy}
                    LIMIT ${options.limit}
                `,
                getTableColumnMetadata(schema, table),
            ],
            { concurrency: 'unbounded' },
        )

        const validatedRows = yield* validateTableRows(rows, columns)

        return {
            columns: columns.map((column) => ({ name: column.column_name })),
            rows: validatedRows,
            warnings,
        }
    })

    return Effect.runPromise(program.pipe(Effect.provide(SqlLive)))
}
