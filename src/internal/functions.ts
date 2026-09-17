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
        }),
    )
    .handler(async ({ data }) => {
        const { getTableData } = await import('./index')

        return getTableData(data.schema, data.table)
    })
