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
    })
    .transform((search) => (search.schema ? search : { schema: undefined, table: undefined }))

export const Route = createFileRoute('/')({
    validateSearch: searchSchema,
    loader: () => loadSchemas(),
    component: Home,
})

function Home() {
    return (
        <div className="flex min-w-0 gap-8 p-8">
            <div className="w-full max-w-sm shrink-0 space-y-6">
                <SchemaSelect />
                <TablesList />
            </div>
            <div className="min-w-0 flex-1">
                <TableDisplay />
            </div>
        </div>
    )
}
