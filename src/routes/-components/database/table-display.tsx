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
import { Checkbox } from '#/components/ui/checkbox'
import type { QueryValue } from '#/internal'
import type postgres from 'postgres'

export function TableDisplay() {
    const {
        schema: selectedSchema,
        table: selectedTable,
        limit: searchLimit,
        sort: sortColumn,
        order: searchOrder,
    } = useSearch({ from: '/' })

    const limit = searchLimit ?? 100
    const sortOrder = searchOrder ?? 'asc'

    const getTableData = useServerFn(loadTableData)
    const {
        isPending,
        isFetching,
        isError,
        data: tableContents,
    } = useQuery({
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

    if (!selectedTable) {
        return <p className="text-sm text-muted-foreground p-6">Select a table to view its data.</p>
    }

    if (isPending) {
        return <p className="text-sm text-muted-foreground">Loading table data…</p>
    }

    if (isError) {
        return <p className="text-sm text-destructive">Unable to load table data.</p>
    }

    return (
        <TableContents tableName={selectedTable} contents={tableContents} isFetching={isFetching} />
    )
}

type TableContents = {
    columns: {
        name: string
    }[]
    rows: Record<string, QueryValue>[] &
        Iterable<Record<string, QueryValue>> &
        postgres.ResultQueryMeta<number, string>
}

export function TableContents({
    tableName,
    contents,
    isFetching,
}: {
    readonly tableName: string
    readonly contents: TableContents
    readonly isFetching: boolean
}) {
    const [addingRow, setAddingRow] = useState(false)
    const editableRowRef = useRef<EditableRowHandle>(null)
    const { schema: selectedSchema, limit } = useSearch({ from: '/' })

    return (
        <div className="space-y-3">
            <div className="flex px-3 mt-3 flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 className="font-medium text-mist-800 text-sm">{tableName}</h2>
                    <p className="text-xs text-mist-500">
                        Showing up to {limit} rows
                        {isFetching ? ' · Updating…' : ''}
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
                        <Button type="button" onClick={() => setAddingRow(true)} className="mb-1">
                            <PlusIcon data-icon="inline-start" />
                            Add row
                        </Button>
                    )}

                    <TableContentsFilters contents={contents} />
                </div>
            </div>

            <div className="overflow-auto border-y">
                <table className="w-full border-collapse text-sm">
                    <thead className="bg-muted">
                        <tr>
                            {contents.columns.map((column, colIdx) => (
                                <th
                                    key={column.name}
                                    scope="col"
                                    className="w-64 max-w-64 border-b border-l first:border-l-0 text-[13px] px-3 py-2 text-left font-medium"
                                >
                                    <div className="flex items-center gap-2">
                                        {colIdx == 0 && <Checkbox />}
                                        <span
                                            className="block truncate capitalize"
                                            title={column.name}
                                        >
                                            {column.name.replaceAll('_', ' ')}
                                        </span>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {addingRow && (
                            <EditableRow
                                key={`${selectedSchema}.${tableName}`}
                                ref={editableRowRef}
                                schema={selectedSchema!}
                                table={tableName}
                                columns={contents.columns.map((column) => column.name)}
                                onSaved={() => setAddingRow(false)}
                            />
                        )}
                        {contents.rows.map((row, rowIndex) => (
                            <tr key={rowIndex}>
                                {contents.columns.map((column, colIdx) => (
                                    <td
                                        key={column.name}
                                        className="w-64 max-w-64 px-3 py-1.5 border-l first:border-l-0"
                                    >
                                        <div className="flex items-center gap-2">
                                            {colIdx == 0 && <Checkbox />}
                                            <TableCell value={row[column.name]} />
                                        </div>
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>

                {contents.rows.length === 0 && (
                    <p className="p-4 text-sm text-muted-foreground">This table has no rows.</p>
                )}
            </div>
        </div>
    )
}

function TableCell({ value }: { value: unknown }) {
    const displayValue = formatCell(value)

    return (
        <span className="block truncate text-[13px] text-mist-800" title={displayValue}>
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

function TableContentsFilters({ contents }: { readonly contents: TableContents }) {
    const navigate = useNavigate({ from: '/' })
    const {
        table: selectedTable,
        limit,
        sort: sortColumn,
        order: sortOrder,
    } = useSearch({ from: '/' })

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
        return <p className="text-sm text-muted-foreground p-6">Select a table to view its data.</p>
    }

    return (
        <>
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
                        {contents.columns.map((column) => (
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
        </>
    )
}
