import { useNavigate, useSearch } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useQuery } from '@tanstack/react-query'
import { PlusIcon } from '@heroicons/react/24/outline'
import { useRef, useState } from 'react'

import { Button } from '#/components/ui/button'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '#/components/ui/select'
import { loadTableData } from '#/internal/functions'

import { EditableRow } from './editable-row'

import type { EditableRowHandle } from './editable-row'

export function TableDisplay() {
    const [addingRow, setAddingRow] = useState(false)
    const editableRowRef = useRef<EditableRowHandle>(null)
    const {
        schema: selectedSchema,
        table: selectedTable,
        limit: searchLimit,
        sort: sortColumn,
        order: searchOrder,
    } = useSearch({ from: '/' })
    const navigate = useNavigate({ from: '/' })
    const limit = searchLimit ?? 100
    const sortOrder = searchOrder ?? 'asc'
    const getTableData = useServerFn(loadTableData)
    const tableDataQuery = useQuery({
        queryKey: ['table-data', selectedSchema, selectedTable, limit, sortColumn, sortOrder],
        queryFn: () =>
            getTableData({
                data: {
                    schema: selectedSchema!,
                    table: selectedTable!,
                    limit,
                    sort: sortColumn,
                    order: sortOrder,
                },
            }),
        enabled: selectedSchema !== undefined && selectedTable !== undefined,
        placeholderData: (previousData) => previousData,
    })

    function setLimit(value: string | null) {
        if (!value) return
        void navigate({ search: (previous) => ({ ...previous, limit: Number(value) }) })
    }

    function setSort(value: string | null) {
        void navigate({
            search: (previous) => ({
                ...previous,
                sort: value === 'none' || value === null ? undefined : value,
                order: value === 'none' || value === null ? undefined : previous.order,
            }),
        })
    }

    function setOrder(value: string | null) {
        if (value !== 'asc' && value !== 'desc') return
        void navigate({ search: (previous) => ({ ...previous, order: value }) })
    }

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
            <div className="flex px-3 mt-3 flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 className="font-medium">{selectedTable}</h2>
                    <p className="text-sm text-muted-foreground">
                        Showing up to {limit} rows
                        {tableDataQuery.isFetching ? ' · Updating…' : ''}
                    </p>
                </div>

                <div className="flex flex-wrap items-end gap-2">
                    {addingRow ? (
                        <>
                            <Button type="button" onClick={() => editableRowRef.current?.save()}>
                                Save row
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setAddingRow(false)}
                            >
                                Cancel
                            </Button>
                        </>
                    ) : (
                        <Button type="button" onClick={() => setAddingRow(true)}>
                            <PlusIcon data-icon="inline-start" />
                            Add row
                        </Button>
                    )}

                    <div className="space-y-1">
                        <label className="block text-xs text-muted-foreground">Rows</label>
                        <Select value={String(limit)} onValueChange={setLimit}>
                            <SelectTrigger className="w-20">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {[25, 50, 100, 250, 500, 1000].map((value) => (
                                    <SelectItem key={value} value={String(value)}>
                                        {value}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1">
                        <label className="block text-xs text-muted-foreground">Sort by</label>
                        <Select value={sortColumn ?? 'none'} onValueChange={setSort}>
                            <SelectTrigger className="w-44">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">No sorting</SelectItem>
                                {tableDataQuery.data.columns.map((column) => (
                                    <SelectItem key={column.name} value={column.name}>
                                        {column.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1">
                        <label className="block text-xs text-muted-foreground">Order</label>
                        <Select value={sortOrder} onValueChange={setOrder} disabled={!sortColumn}>
                            <SelectTrigger className="w-28">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="asc">Ascending</SelectItem>
                                <SelectItem value="desc">Descending</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            <div className="scrollbar-thin overflow-auto border-y">
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
                        {addingRow && (
                            <EditableRow
                                key={`${selectedSchema}.${selectedTable}`}
                                ref={editableRowRef}
                                schema={selectedSchema!}
                                table={selectedTable}
                                columns={tableDataQuery.data.columns.map((column) => column.name)}
                                onSaved={() => setAddingRow(false)}
                            />
                        )}
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
