import { useSearch } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useQuery } from '@tanstack/react-query'

import { loadTableData } from '#/internal/functions'

export function TableDisplay() {
    const { schema: selectedSchema, table: selectedTable } = useSearch({ from: '/' })
    const getTableData = useServerFn(loadTableData)
    const tableDataQuery = useQuery({
        queryKey: ['table-data', selectedSchema, selectedTable],
        queryFn: () =>
            getTableData({
                data: { schema: selectedSchema!, table: selectedTable! },
            }),
        enabled: selectedSchema !== undefined && selectedTable !== undefined,
    })

    if (!selectedTable) {
        return <p className="text-sm text-muted-foreground">Select a table to view its data.</p>
    }

    if (tableDataQuery.isPending) {
        return <p className="text-sm text-muted-foreground">Loading table data…</p>
    }

    if (tableDataQuery.isError) {
        return <p className="text-sm text-destructive">Unable to load table data.</p>
    }

    return (
        <div className="space-y-3">
            <div>
                <h2 className="font-medium">{selectedTable}</h2>
                <p className="text-sm text-muted-foreground">Showing up to 100 rows</p>
            </div>

            <div className="scrollbar-thin overflow-auto rounded-md border">
                <table className="w-full border-collapse text-sm">
                    <thead className="bg-muted">
                        <tr>
                            {tableDataQuery.data.columns.map((column) => (
                                <th
                                    key={column.name}
                                    scope="col"
                                    className="w-64 max-w-64 border-b px-3 py-2 text-left font-medium"
                                >
                                    <span className="block truncate" title={column.name}>
                                        {column.name}
                                    </span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {tableDataQuery.data.rows.map((row, rowIndex) => (
                            <tr key={rowIndex}>
                                {tableDataQuery.data.columns.map((column) => (
                                    <td key={column.name} className="w-64 max-w-64 px-3 py-2">
                                        <TableCell value={row[column.name]} />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>

                {tableDataQuery.data.rows.length === 0 && (
                    <p className="p-4 text-sm text-muted-foreground">This table has no rows.</p>
                )}
            </div>
        </div>
    )
}

function TableCell({ value }: { value: unknown }) {
    const displayValue = formatCell(value)

    return (
        <span className="block truncate" title={displayValue}>
            {displayValue}
        </span>
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
