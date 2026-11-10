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
import {
    loadTableData,
    GetTableMetadata,
    createTableRow,
    updateTableRow,
} from '#/internal/functions'

import { NULL_VALUE } from './editable-row'
import { EditableDataTable } from './editable-data-table'
import { TableSaveBar } from './table-save-bar'
import { getRowIdentity, updateCellDraft } from './table-edits'
import type { RowDraft } from './table-edits'
import type { DatabaseColumnMetadata, InsertValue } from '#/internal'
import type { TableRow } from '#/db/table-row'
import { InputGroup, InputGroupAddon } from '#/components/ui/input-group'
import { Popover, PopoverContent, PopoverTrigger } from '#/components/ui/popover'

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
        placeholderData: (previousData, previousQuery) =>
            previousQuery !== undefined &&
            previousQuery.queryKey[1] === selectedSchema &&
            previousQuery.queryKey[2] === selectedTable
                ? previousData
                : undefined,
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
        <TableContents
            key={`${selectedSchema}.${selectedTable}`}
            tableName={selectedTable}
            contents={tableContents}
        />
    )
}

type TableContents = Awaited<ReturnType<typeof loadTableData>>

export function TableContents({
    tableName,
    contents,
}: {
    readonly tableName: string
    readonly contents: TableContents
}) {
    const queryClient = useQueryClient()
    const navigate = useNavigate({ from: '/' })
    const { schema: selectedSchema, sort, order } = useSearch({ from: '/' })

    const [addingRow, setAddingRow] = useState(false)
    const [newRowValues, setNewRowValues] = useState<Record<string, string>>({})
    const [validationError, setValidationError] = useState<string | null>(null)
    const [drafts, setDrafts] = useState<Map<string, RowDraft>>(() => new Map())
    const [editError, setEditError] = useState<string | null>(null)

    const getMetadata = useServerFn(GetTableMetadata)
    const metadataQuery = useQuery({
        queryKey: ['table-metadata-v4', selectedSchema, tableName],
        queryFn: () => getMetadata({ data: { schema: selectedSchema!, table: tableName } }),
        staleTime: Number.POSITIVE_INFINITY,
        enabled: addingRow || contents.rows.length > 0,
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

    const keyColumns = useMemo(
        () => metadataQuery.data?.filter((column) => column.is_primary_key) ?? [],
        [metadataQuery.data],
    )
    const updateRow = useServerFn(updateTableRow)
    const saveRows = useMutation({
        mutationFn: async (pending: Map<string, RowDraft>) => {
            const updates = [...pending].map(([id, draft]) => {
                const identity = getRowIdentity(draft.row, keyColumns)
                if (!identity) throw new Error('This row has no usable primary key.')
                const values: Record<string, InsertValue> = {}
                for (const [name, value] of Object.entries(draft.values)) {
                    const column = metadataByColumn.get(name)
                    if (!column) throw new Error(`Column ${name} is unavailable.`)
                    if (value === NULL_VALUE && !column.is_nullable) {
                        throw new Error(`${name} cannot be null.`)
                    }
                    values[name] = value === NULL_VALUE ? null : value
                }
                return { id, key: identity.key, values }
            })
            const saved: string[] = []
            const errors: string[] = []
            for (const update of updates) {
                try {
                    await updateRow({
                        data: {
                            schema: selectedSchema!,
                            table: tableName,
                            key: update.key,
                            values: update.values,
                        },
                    })
                    saved.push(update.id)
                } catch (error) {
                    errors.push(error instanceof Error ? error.message : 'Unable to save a row.')
                }
            }
            return { saved, errors }
        },
        onSuccess: ({ saved, errors }) => {
            setDrafts((current) => {
                const remaining = new Map(current)
                for (const id of saved) remaining.delete(id)
                return remaining
            })
            setEditError(
                errors.length ? `${errors.length} row(s) could not be saved. ${errors[0]}` : null,
            )
            if (saved.length) {
                void queryClient.invalidateQueries({
                    queryKey: ['table-data', selectedSchema, tableName],
                })
            }
        },
    })

    function changeCell(row: TableRow, column: DatabaseColumnMetadata, value: string) {
        const identity = getRowIdentity(row, keyColumns)
        if (!identity || saveRows.isPending) return
        saveRows.reset()
        setEditError(null)
        setDrafts((current) => updateCellDraft(current, row, column, keyColumns, value))
    }

    function cancelChanges() {
        if (saveRows.isPending || createRow.isPending) return
        setDrafts(new Map())
        setEditError(null)
        saveRows.reset()
        createRow.reset()
        cancelAddingRow()
    }

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

    const columns = useTableColumns(contents, metadataByColumn)
    const saving = saveRows.isPending || createRow.isPending
    const hasChanges = addingRow || drafts.size > 0
    const saveError =
        editError ??
        validationError ??
        (saveRows.error instanceof Error ? saveRows.error.message : null) ??
        (createRow.isError ? 'Unable to add the row.' : null)

    return (
        <div className="space-y-3 pb-48">
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
                        <Button
                            type="button"
                            onClick={startAddingRow}
                            disabled={addingRow || drafts.size > 0 || saving}
                        >
                            <PlusIcon data-icon="inline-start" />
                            Add row
                        </Button>
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
                {metadataQuery.isError && (
                    <p className="px-3 text-xs text-destructive">
                        Column details could not be loaded. Editing is unavailable.
                    </p>
                )}
            </div>

            <EditableDataTable
                columns={columns}
                rows={contents.rows}
                drafts={drafts}
                keyColumns={keyColumns}
                disabled={saving || addingRow}
                onChange={changeCell}
                newRow={
                    addingRow
                        ? {
                              values: newRowValues,
                              onChange: (name, value) => {
                                  setValidationError(null)
                                  setNewRowValues((current) => ({ ...current, [name]: value }))
                              },
                              pending: metadataQuery.isPending,
                              disabled: saving,
                          }
                        : undefined
                }
            />
            {hasChanges && (
                <TableSaveBar
                    count={addingRow ? 1 : drafts.size}
                    saving={saving}
                    error={saveError}
                    onSave={() => {
                        setEditError(null)
                        if (addingRow) saveNewRow()
                        else saveRows.mutate(new Map(drafts))
                    }}
                    onCancel={cancelChanges}
                    disabled={metadataQuery.isPending || metadataQuery.isError}
                />
            )}
        </div>
    )
}

function useTableColumns(
    contents: TableContents,
    metadataByColumn: Map<string, DatabaseColumnMetadata>,
) {
    return useMemo(
        () =>
            contents.columns.map((column) => ({
                name: column.name,
                metadata: metadataByColumn.get(column.name),
            })),
        [contents.columns, metadataByColumn],
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
