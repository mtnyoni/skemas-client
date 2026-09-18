import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { SchemaSelect } from './-components/database/schema-select'
import { TableDisplay } from './-components/database/table-display'
import { TablesList } from './-components/database/tables-list'
import { loadSchemas } from '#/internal/functions'
import { TableCellsIcon } from '@heroicons/react/24/outline'

const searchSchema = z
    .object({
        schema: z.string().min(1).optional().catch(undefined),
        table: z.string().min(1).optional().catch(undefined),
        tableQuery: z.string().min(1).optional().catch(undefined),
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
    component: RouteComponent,
})

function RouteComponent() {
    const { schema } = Route.useSearch()

    return (
        <div className="flex min-w-0">
            <div className="w-full h-[calc(100dvh-1rem)] max-w-56 shrink-0 space-y-6 pt-3 px-2 border-r">
                <SchemaSelect />
                {schema ? (
                    <TablesList />
                ) : (
                    <div className="text-mist-400 px-3 text-xs text-center border border-border grid place-items-center h-40 border-dashed rounded-md">
                        <div className="flex flex-col items-center">
                            <TableCellsIcon className="size-5" />
                            <p className="mt-2">Select a schema</p>
                        </div>
                    </div>
                )}
            </div>
            <div className="min-w-0 flex-1">
                <TableDisplay />
            </div>
        </div>
    )
}
