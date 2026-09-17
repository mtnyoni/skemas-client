import { useNavigate, useSearch } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useQuery } from '@tanstack/react-query'

import { loadTables } from '#/internal/functions'

export function TablesList() {
    const { schema: selectedSchema, table: selectedTable } = useSearch({ from: '/' })
    const navigate = useNavigate({ from: '/' })
    const getTables = useServerFn(loadTables)
    const tablesQuery = useQuery({
        queryKey: ['tables', selectedSchema],
        queryFn: () => getTables({ data: { schema: selectedSchema! } }),
        enabled: selectedSchema !== undefined,
    })

    function selectTable(table: string) {
        void navigate({
            search: (previous) => ({ ...previous, table }),
        })
    }

    if (!selectedSchema) return null

    return (
        <div className="space-y-2">
            <h2 className="text-sm font-medium">Tables</h2>

            {tablesQuery.isPending && (
                <p className="text-sm text-muted-foreground">Loading tables…</p>
            )}

            {tablesQuery.isError && (
                <p className="text-sm text-destructive">Unable to load tables.</p>
            )}

            {tablesQuery.isSuccess && tablesQuery.data.length === 0 && (
                <p className="text-sm text-muted-foreground">
                    No tables found in {selectedSchema}.
                </p>
            )}

            {tablesQuery.isSuccess && tablesQuery.data.length > 0 && (
                <ul className="divide-y rounded-md border">
                    {tablesQuery.data.map(({ table_name }) => (
                        <li key={table_name}>
                            <button
                                type="button"
                                className="w-full px-3 py-2 text-left text-sm hover:bg-accent data-[selected=true]:bg-accent data-[selected=true]:font-medium"
                                data-selected={selectedTable === table_name}
                                onClick={() => selectTable(table_name)}
                            >
                                {table_name}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}
