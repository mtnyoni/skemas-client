'use client'

import { useTable } from '@tanstack/react-table'
import type { ColumnDef, RowData } from '@tanstack/react-table'

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '#/components/ui/table'

import { features } from './data-table-features'
import type { DataTableFeatures } from './data-table-features'

interface DataTableProps<TData extends RowData, TValue = unknown> {
    columns: ColumnDef<DataTableFeatures, TData, TValue>[]
    data: TData[]
}

export function DataTable<TData extends RowData, TValue = unknown>({
    columns,
    data,
}: DataTableProps<TData, TValue>) {
    const table = useTable({
        features,
        data,
        columns: columns as ColumnDef<DataTableFeatures, TData, unknown>[],
    })

    return (
        <div className="overflow-hidden border-y">
            <Table>
                <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                            {headerGroup.headers.map((header) => {
                                return (
                                    <TableHead
                                        key={header.id}
                                        className="border-l first:border-l-0"
                                    >
                                        {header.isPlaceholder ? null : (
                                            <table.FlexRender header={header} />
                                        )}
                                    </TableHead>
                                )
                            })}
                        </TableRow>
                    ))}
                </TableHeader>
                <TableBody>
                    {table.getRowModel().rows.length ? (
                        table.getRowModel().rows.map((row) => (
                            <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                                {row.getVisibleCells().map((cell) => (
                                    <TableCell key={cell.id} className="border-l first:border-l-0">
                                        <table.FlexRender cell={cell} />
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={columns.length} className="h-24 text-center">
                                No results.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    )
}
