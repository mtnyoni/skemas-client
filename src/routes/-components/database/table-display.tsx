import { useNavigate, useSearch } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowUpIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import { ArrowDownIcon, ArrowsUpDownIcon, XMarkIcon } from '@heroicons/react/16/solid'
import React, { useMemo, useState } from 'react'

import { Button } from '#/components/ui/button'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '#/components/ui/select'
import { loadTableData, loadTableMetadata, createTableRow } from '#/internal/functions'

import { InlineColumnControl, NULL_VALUE } from './editable-row'
import { Checkbox } from '#/components/ui/checkbox'
import type { QueryValue, InsertValue } from '#/internal'
import type postgres from 'postgres'
import { InputGroup, InputGroupAddon } from '#/components/ui/input-group'
import { Popover, PopoverContent, PopoverTrigger } from '#/components/ui/popover'
import { createColumnHelper } from '@tanstack/react-table'
import type { DataTableFeatures } from '#/components/ui/data-table-features'
import { DataTable } from '#/routes/-components/database/data-table'

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

    return <TableContents tableName={selectedTable} contents={tableContents} />
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
}: {
    readonly tableName: string
    readonly contents: TableContents
}) {
    const navigate = useNavigate({ from: '/' })
    const queryClient = useQueryClient()
    const { schema: selectedSchema, sort, order } = useSearch({ from: '/' })

    const [addingRow, setAddingRow] = useState(false)
    const [newRowValues, setNewRowValues] = useState<Record<string, string>>({})
    const [validationError, setValidationError] = useState<string | null>(null)

    // Stable per-"add row" session sentinel object; identity is used to
    // detect which row in the table is the in-progress draft row.
    const newRowSentinel = useMemo(() => ({}) as Record<string, QueryValue>, [addingRow])

    const getMetadata = useServerFn(loadTableMetadata)
    const metadataQuery = useQuery({
        queryKey: ['table-metadata-v4', selectedSchema, tableName],
        queryFn: () => getMetadata({ data: { schema: selectedSchema!, table: tableName } }),
        staleTime: Number.POSITIVE_INFINITY,
        enabled: addingRow,
    })
    const metadataByColumn = useMemo(
        () => new Map(metadataQuery.data?.map((column) => [column.column_name, column]) ?? []),
        [metadataQuery.data],
    )

    const addRow = useServerFn(createTableRow)
    const createRow = useMutation({
        mutationFn: (row: Record<string, InsertValue>) =>
            addRow({ data: { schema: selectedSchema!, table: tableName, values: row } }),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: ['table-data', selectedSchema, tableName],
            })
            setAddingRow(false)
            setNewRowValues({})
            setValidationError(null)
        },
    })

    function startAddingRow() {
        setAddingRow(true)
        setNewRowValues({})
        setValidationError(null)
    }

    function cancelAddingRow() {
        setAddingRow(false)
        setNewRowValues({})
        setValidationError(null)
    }

    function saveNewRow() {
        if (!metadataQuery.data) return

        const missingColumn = metadataQuery.data.find(
            (column) =>
                !column.is_auto_generated &&
                !column.is_nullable &&
                column.column_default === null &&
                !newRowValues[column.column_name],
        )
        if (missingColumn) {
            setValidationError(`${missingColumn.column_name} is required.`)
            return
        }

        const row: Record<string, InsertValue> = {}
        for (const column of metadataQuery.data) {
            if (column.is_auto_generated) continue
            const value = newRowValues[column.column_name]
            if (!value) continue
            row[column.column_name] = value === NULL_VALUE ? null : value
        }
        createRow.mutate(row)
    }

    const columnHelper = createColumnHelper<DataTableFeatures, Record<string, QueryValue>>()
    const columns = useMemo(
        () =>
            contents.columns.map((column, colIdx) =>
                columnHelper.accessor((row) => row[column.name], {
                    id: column.name,
                    header: () => (
                        <div className="flex items-center gap-2">
                            {colIdx === 0 && <Checkbox />}
                            <span className="block truncate capitalize" title={column.name}>
                                {column.name.replaceAll('_', ' ')}
                            </span>
                        </div>
                    ),
                    cell: (info) => {
                        // Draft "add row" — render an editable control instead of a value.
                        if (info.row.original === newRowSentinel) {
                            if (metadataQuery.isPending) {
                                return (
                                    <span className="text-xs text-muted-foreground">Loading…</span>
                                )
                            }
                            if (metadataQuery.isError) {
                                return <span className="text-xs text-destructive">Unavailable</span>
                            }
                            const meta = metadataByColumn.get(column.name)
                            if (!meta) return null
                            return (
                                <InlineColumnControl
                                    column={meta}
                                    value={newRowValues[column.name] ?? ''}
                                    onChange={(value) =>
                                        setNewRowValues((current) => ({
                                            ...current,
                                            [column.name]: value,
                                        }))
                                    }
                                />
                            )
                        }

                        const value = info.getValue()

                        if (value === null) {
                            return <span className="text-gray-400 italic">null</span>
                        }

                        if (value instanceof Date) {
                            return value.toLocaleString()
                        }

                        if (typeof value === 'object') {
                            return (
                                <code className="text-xs text-muted-foreground truncate block">
                                    {JSON.stringify(value)}
                                </code>
                            )
                        }

                        return String(value)
                    },
                }),
            ),
        [
            contents.columns,
            columnHelper,
            newRowSentinel,
            newRowValues,
            metadataByColumn,
            metadataQuery.isPending,
            metadataQuery.isError,
        ],
    )

    const tableData = useMemo(
        () => (addingRow ? [newRowSentinel, ...contents.rows] : contents.rows),
        [addingRow, newRowSentinel, contents.rows],
    )

    return (
        <div className="space-y-3">
            <div>
                <div className="flex px-3 flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="font-medium text-mist-800 text-sm">{tableName}</h2>
                    </div>

                    <div className="flex flex-wrap items-end gap-2">
                        <TableSort
                            children={
                                <PopoverTrigger render={<Button variant="outline" />}>
                                    <ArrowsUpDownIcon />
                                </PopoverTrigger>
                            }
                            contents={contents}
                        />
                        {addingRow ? (
                            <>
                                <Button
                                    type="button"
                                    onClick={saveNewRow}
                                    disabled={createRow.isPending}
                                >
                                    Save row
                                </Button>
                                <Button type="button" variant="outline" onClick={cancelAddingRow}>
                                    Cancel
                                </Button>
                            </>
                        ) : (
                            <Button type="button" onClick={startAddingRow}>
                                <PlusIcon data-icon="inline-start" />
                                Add row
                            </Button>
                        )}
                    </div>
                </div>
                <div className="flex mt-0.5 items-center text-xs px-3 text-mist-500 gap-2">
                    {sort && (
                        <>
                            <TableSort
                                contents={contents}
                                children={
                                    <PopoverTrigger
                                        render={
                                            <div className="h-7 px-2 flex gap-1 items-center border rounded-md" />
                                        }
                                    >
                                        {order === 'desc' ? (
                                            <ArrowUpIcon className="h-2.5 stroke-2" />
                                        ) : (
                                            <ArrowDownIcon className="h-2.5 stroke-2" />
                                        )}
                                        <span>{sort}</span>
                                    </PopoverTrigger>
                                }
                            />
                            <div className="bg-border h-7 w-px" />
                        </>
                    )}
                    <TableLimitFilter />
                    <TableColumnFilters />
                    {sort && order && (
                        <Button
                            variant="outline"
                            onClick={() =>
                                navigate({
                                    search: (prev) => ({
                                        ...prev,
                                        sort: undefined,
                                        order: undefined,
                                    }),
                                })
                            }
                        >
                            <XMarkIcon /> Clear
                        </Button>
                    )}
                </div>
                {(validationError || createRow.isError) && (
                    <p className="text-xs text-destructive px-3 mt-1">
                        {validationError ?? 'Unable to add the row.'}
                    </p>
                )}
            </div>

            <DataTable columns={columns} data={tableData} />
        </div>
    )
}

function TableLimitFilter() {
    const navigate = useNavigate({ from: '/' })
    const { limit } = useSearch({ from: '/' })

    function setLimit(value: string | null) {
        if (!value) return
        void navigate({ search: (previous) => ({ ...previous, limit: Number(value) }) })
    }

    return (
        <InputGroup className="w-fit">
            <InputGroupAddon>Limit</InputGroupAddon>
            <Select value={String(limit)} onValueChange={setLimit}>
                <SelectTrigger className="w-16 border-0 bg-transparent">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                    {[25, 50, 100, 250, 500, 1000].map((value) => (
                        <SelectItem key={value} value={String(value)}>
                            {value}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </InputGroup>
    )
}

function TableSort({
    contents,
    children,
}: {
    readonly contents: TableContents
    readonly children: React.ReactNode
}) {
    const navigate = useNavigate({ from: '/' })
    const { table: selectedTable, sort: sortColumn, order: sortOrder } = useSearch({ from: '/' })

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
            <Popover>
                {children}
                <PopoverContent align="start" className="w-fit">
                    <div className="space-y-2">
                        <div>Sort</div>
                        <div className="grid grid-cols-[1fr_auto] items-center gap-1">
                            <label className="block text-xs text-muted-foreground">By</label>
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

                            <label className="block text-xs text-muted-foreground">Order</label>
                            <Select
                                value={sortOrder}
                                onValueChange={setOrder}
                                disabled={!sortColumn}
                            >
                                <SelectTrigger className="w-28">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="asc">Ascending</SelectItem>
                                    <SelectItem value="desc">Descending</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Button
                                variant="secondary"
                                onClick={() =>
                                    navigate({
                                        search: (prev) => ({
                                            ...prev,
                                            sort: undefined,
                                            order: undefined,
                                        }),
                                    })
                                }
                            >
                                <TrashIcon />
                                Delete
                            </Button>
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        </>
    )
}

function TableColumnFilters() {
    return <></>
}
