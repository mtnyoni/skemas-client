import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '#/components/ui/select'
import { loadSchemas, loadTableData, loadTables } from '#/internal/functions'

export const Route = createFileRoute('/')({
    loader: () => loadSchemas(),
    component: Home,
})

function Home() {
    const schemas = Route.useLoaderData()
    const [selectedSchema, setSelectedSchema] = useState<string | null>(null)
    const [selectedTable, setSelectedTable] = useState<string | null>(null)
    const getTables = useServerFn(loadTables)
    const getTableData = useServerFn(loadTableData)
    const tablesQuery = useQuery({
        queryKey: ['tables', selectedSchema],
        queryFn: () => getTables({ data: { schema: selectedSchema! } }),
        enabled: selectedSchema !== null,
    })
    const tableDataQuery = useQuery({
        queryKey: ['table-data', selectedSchema, selectedTable],
        queryFn: () =>
            getTableData({
                data: { schema: selectedSchema!, table: selectedTable! },
            }),
        enabled: selectedSchema !== null && selectedTable !== null,
    })

    function selectSchema(schema: string | null) {
        setSelectedSchema(schema)
        setSelectedTable(null)
    }

    return (
        <div className="flex gap-8 p-8">
            <div className="w-full max-w-sm shrink-0 space-y-6">
                <div className="space-y-2">
                    <label htmlFor="database-schema" className="text-sm font-medium">
                        Database schema
                    </label>

                    <Select value={selectedSchema} onValueChange={selectSchema}>
                        <SelectTrigger id="database-schema" className="w-full">
                            <SelectValue placeholder="Select a schema" />
                        </SelectTrigger>
                        <SelectContent>
                            {schemas.map(({ schema_name }) => (
                                <SelectItem key={schema_name} value={schema_name}>
                                    {schema_name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {schemas.length === 0 && (
                        <p className="text-sm text-muted-foreground">No schemas found.</p>
                    )}
                </div>

                {selectedSchema && (
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
                                            onClick={() => setSelectedTable(table_name)}
                                        >
                                            {table_name}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
            </div>

            <div className="min-w-0 flex-1">
                {!selectedTable && (
                    <p className="text-sm text-muted-foreground">
                        Select a table to view its data.
                    </p>
                )}

                {selectedTable && tableDataQuery.isPending && (
                    <p className="text-sm text-muted-foreground">Loading table data…</p>
                )}

                {selectedTable && tableDataQuery.isError && (
                    <p className="text-sm text-destructive">Unable to load table data.</p>
                )}

                {selectedTable && tableDataQuery.isSuccess && (
                    <div className="space-y-3">
                        <div>
                            <h2 className="font-medium">{selectedTable}</h2>
                            <p className="text-sm text-muted-foreground">Showing up to 100 rows</p>
                        </div>

                        <div className="overflow-auto rounded-md border">
                            <table className="w-full border-collapse text-sm">
                                <thead className="bg-muted">
                                    <tr>
                                        {tableDataQuery.data.columns.map((column) => (
                                            <th
                                                key={column.name}
                                                scope="col"
                                                className="whitespace-nowrap border-b px-3 py-2 text-left font-medium"
                                            >
                                                {column.name}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {tableDataQuery.data.rows.map((row, rowIndex) => (
                                        <tr key={rowIndex}>
                                            {tableDataQuery.data.columns.map((column) => (
                                                <td
                                                    key={column.name}
                                                    className="max-w-80 whitespace-nowrap px-3 py-2"
                                                >
                                                    {formatCell(row[column.name])}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {tableDataQuery.data.rows.length === 0 && (
                                <p className="p-4 text-sm text-muted-foreground">
                                    This table has no rows.
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

function formatCell(value: unknown) {
    if (value === null) return 'NULL'
    if (value instanceof Date) return value.toLocaleString()
    if (typeof value === 'bigint') return value.toString()
    if (typeof value !== 'object') return String(value)

    try {
        return JSON.stringify(value, (_, nestedValue) =>
            typeof nestedValue === 'bigint' ? nestedValue.toString() : nestedValue,
        )
    } catch {
        return String(value)
    }
}
