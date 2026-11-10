import { useServerFn } from '@tanstack/react-start'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { forwardRef, useImperativeHandle, useState } from 'react'

import { Input } from '#/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '#/components/ui/select'
import { createTableRow, loadTableMetadata } from '#/internal/functions'

import type { DatabaseColumnMetadata, InsertValue } from '#/internal'

import { NULL_VALUE } from './cell-constants'

export { NULL_VALUE } from './cell-constants'

export type EditableRowHandle = {
    save: () => void
}

type EditableRowProps = {
    schema: string
    table: string
    columns: string[]
    onSaved: () => void
}

export const EditableRow = forwardRef<EditableRowHandle, EditableRowProps>(
    function EditableRowComponent({ schema, table, columns, onSaved }, ref) {
        const [values, setValues] = useState<Record<string, string>>({})
        const [validationError, setValidationError] = useState<string | null>(null)
        const queryClient = useQueryClient()
        const getMetadata = useServerFn(loadTableMetadata)
        const addRow = useServerFn(createTableRow)

        const metadataQuery = useQuery({
            queryKey: ['table-metadata-v4', schema, table],
            queryFn: () => getMetadata({ data: { schema, table } }),
            staleTime: Number.POSITIVE_INFINITY,
        })

        const createRow = useMutation({
            mutationFn: (row: Record<string, InsertValue>) =>
                addRow({ data: { schema, table, values: row } }),
            onSuccess: () => {
                void queryClient.invalidateQueries({ queryKey: ['table-data', schema, table] })
                onSaved()
            },
        })

        const metadataByColumn = new Map(
            metadataQuery.data?.map((column) => [column.column_name, column]) ?? [],
        )

        function changeValue(column: string, value: string) {
            setValues((current) => ({ ...current, [column]: value }))
            setValidationError(null)
        }

        function saveRow() {
            if (!metadataQuery.data) return

            const missingColumn = metadataQuery.data.find(
                (column) =>
                    !column.is_auto_generated &&
                    !column.is_nullable &&
                    column.column_default === null &&
                    !values[column.column_name],
            )
            if (missingColumn) {
                setValidationError(`${missingColumn.column_name} is required.`)
                return
            }

            const row: Record<string, InsertValue> = {}
            for (const column of metadataQuery.data) {
                if (column.is_auto_generated) continue

                const value = values[column.column_name]
                if (!value) continue
                row[column.column_name] = value === NULL_VALUE ? null : value
            }
            createRow.mutate(row)
        }

        useImperativeHandle(ref, () => ({ save: saveRow }))

        const error =
            validationError ?? (createRow.isError ? getErrorMessage(createRow.error) : null)

        return (
            <>
                <tr className="bg-primary/5 align-top">
                    {columns.map((columnName) => {
                        const metadata = metadataByColumn.get(columnName)

                        return (
                            <td
                                key={columnName}
                                className="w-64 max-w-64 px-2 py-1.5 first:border-l-0 border-l "
                            >
                                {metadataQuery.isPending && (
                                    <span className="text-xs text-muted-foreground">Loading…</span>
                                )}
                                {metadataQuery.isError && (
                                    <span className="text-xs text-destructive">Unavailable</span>
                                )}
                                {metadata && (
                                    <InlineColumnControl
                                        column={metadata}
                                        value={values[columnName] ?? ''}
                                        onChange={(value) => changeValue(columnName, value)}
                                    />
                                )}
                            </td>
                        )
                    })}
                </tr>
                {error && (
                    <tr className="bg-destructive/5">
                        <td colSpan={columns.length} className="px-2 py-1 text-xs text-destructive">
                            {error}
                        </td>
                    </tr>
                )}
            </>
        )
    },
)

export function InlineColumnControl({
    column,
    value,
    onChange,
    editing = false,
    fullCell = false,
    disabled = false,
    label,
}: {
    column: DatabaseColumnMetadata
    value: string
    onChange: (value: string) => void
    editing?: boolean
    fullCell?: boolean
    disabled?: boolean
    label?: string
}) {
    if (
        editing
            ? column.is_primary_key || column.is_identity || column.is_generated
            : column.is_auto_generated
    ) {
        return <span className="block px-3 py-2 text-xs text-muted-foreground">Auto</span>
    }

    const cellClassName =
        'block h-full w-full min-w-0 rounded-none border-0 bg-transparent px-3 py-2 text-sm outline-none focus-visible:relative focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 disabled:cursor-wait'
    const enumValues = Array.isArray(column.enum_values) ? column.enum_values : []
    if (enumValues.length > 0 || column.data_type === 'boolean') {
        const options = enumValues.length > 0 ? enumValues : ['true', 'false']
        const items = [
            { value: '', label: column.column_default ? 'Use default' : 'Select…' },
            ...(column.is_nullable ? [{ value: NULL_VALUE, label: 'NULL' }] : []),
            ...options.map((option) => ({ value: option, label: option })),
        ]
        return (
            <Select
                items={items}
                value={value}
                disabled={disabled}
                onValueChange={(next) => {
                    if (next !== null) onChange(next)
                }}
            >
                <SelectTrigger
                    aria-label={label ?? column.column_name}
                    className={
                        fullCell
                            ? 'h-full w-full min-w-0 rounded-none border-0 bg-transparent px-3 py-2 text-sm shadow-none focus-visible:relative focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 data-[size=default]:h-full dark:bg-transparent'
                            : 'w-full'
                    }
                >
                    <SelectValue />
                </SelectTrigger>
                <SelectContent align="start" alignItemWithTrigger={false}>
                    {items.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                            {item.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        )
    }

    if (fullCell) {
        return (
            <input
                aria-label={label ?? column.column_name}
                value={value}
                disabled={disabled}
                onChange={(event) => onChange(event.target.value)}
                type={inputType(column.data_type)}
                step={isNumericType(column.data_type) ? 'any' : undefined}
                placeholder={editing ? (column.is_nullable ? 'NULL' : '') : placeholder(column)}
                title={column.data_type}
                className={cellClassName}
            />
        )
    }

    return (
        <Input
            aria-label={label ?? column.column_name}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            type={inputType(column.data_type)}
            step={isNumericType(column.data_type) ? 'any' : undefined}
            placeholder={placeholder(column)}
            title={column.column_default ? `Default: ${column.column_default}` : column.data_type}
        />
    )
}

function placeholder(column: DatabaseColumnMetadata) {
    if (column.column_default) return 'Use default'
    if (column.data_type === 'json' || column.data_type === 'jsonb') return '{"key":"value"}'
    if (column.data_type === 'ARRAY') return '{value1,value2}'
    return column.is_nullable ? 'Optional' : column.data_type
}

function inputType(dataType: string) {
    if (isNumericType(dataType)) return 'number'
    if (dataType === 'date') return 'date'
    if (dataType.includes('timestamp')) return 'datetime-local'
    if (dataType.includes('time')) return 'time'
    return 'text'
}

function isNumericType(dataType: string) {
    return [
        'smallint',
        'integer',
        'bigint',
        'decimal',
        'numeric',
        'real',
        'double precision',
    ].includes(dataType)
}

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Unable to add the row.'
}
