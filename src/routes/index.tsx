import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { SchemaSelect } from './-components/database/schema-select'
import { TableDisplay } from './-components/database/table-display'
import { TablesList } from './-components/database/tables-list'
import { loadSchemas } from '#/internal/functions'

const searchSchema = z
    .object({
        schema: z.string().min(1).optional().catch(undefined),
        table: z.string().min(1).optional().catch(undefined),
        limit: z.coerce.number().int().positive().optional().catch(undefined),
        sort: z.string().min(1).optional().catch(undefined),
        order: z.enum(['asc', 'desc']).optional().catch(undefined),
    })
    .transform((search) => {
        if (!search.schema) {
            return {
                schema: undefined,
                table: undefined,
                limit: search.limit,
                sort: undefined,
                order: undefined,
            }
        }

        if (!search.table) return { ...search, sort: undefined, order: undefined }

        return search
    })

export const Route = createFileRoute('/')({
    validateSearch: searchSchema,
    loader: () => loadSchemas(),
    component: Home,
})

function Home() {
    return (
        <div className="flex min-w-0">
            <div className="w-full h-[calc(100dvh-1rem)] max-w-[16rem] shrink-0 space-y-6 pt-3 px-3 border-r">
                <SchemaSelect />
                <TablesList />
            </div>
            <div className="min-w-0 flex-1">
                <TableDisplay />
            </div>
        </div>
    )
}
