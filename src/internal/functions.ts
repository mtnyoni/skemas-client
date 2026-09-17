import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

export const loadSchemas = createServerFn({ method: 'GET' }).handler(async () => {
    const { getSchemas } = await import('./index')

    return getSchemas()
})

export const loadTables = createServerFn({ method: 'GET' })
    .validator(
        z.object({
            schema: z.string().min(1),
        }),
    )
    .handler(async ({ data }) => {
        const { getTables } = await import('./index')

        return getTables(data.schema)
    })

export const loadTableData = createServerFn({ method: 'GET' })
    .validator(
        z.object({
            schema: z.string().min(1),
            table: z.string().min(1),
            limit: z.number().int().positive(),
            sort: z.string().min(1).optional(),
            order: z.enum(['asc', 'desc']),
        }),
    )
    .handler(async ({ data }) => {
        const { getTableData } = await import('./index')

        return getTableData(data.schema, data.table, {
            limit: data.limit,
            sort: data.sort,
            order: data.order,
        })
    })

export const loadDBRelationships = createServerFn({ method: 'GET' })
    .validator(
        z.object({
            schema: z.string().min(1),
        }),
    )
    .handler(async ({ data }) => {
        const { getDBRelationships } = await import('./index')

        return getDBRelationships(data.schema)
    })

const tableTargetSchema = z.object({
    schema: z.string().min(1),
    table: z.string().min(1),
})

export const loadTableMetadata = createServerFn({ method: 'GET' })
    .validator(tableTargetSchema)
    .handler(async ({ data }) => {
        const { getTableMetadata } = await import('./index')

        return getTableMetadata(data.schema, data.table)
    })

export const createTableRow = createServerFn({ method: 'POST' })
    .validator(
        tableTargetSchema.extend({
            values: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
        }),
    )
    .handler(async ({ data }) => {
        const { insertTableRow } = await import('./index')

        return insertTableRow(data.schema, data.table, data.values)
    })
