import { useServerFn } from '@tanstack/react-start'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { forwardRef, useImperativeHandle, useState } from 'react'

import { Input } from '#/components/ui/input'
import { createTableRow, loadTableMetadata } from '#/internal/functions'

import type { DatabaseColumnMetadata, InsertValue } from '#/internal'

export const NULL_VALUE = '__SKEMAS_NULL__'

export type EditableRowHandle = {
    save: () => void
}

type EditableRowProps = {
    schema: string
    table: string
    columns: string[]
    onSaved: () => void
}

export const EditableRow = forwardRef<EditableRowHandle, EditableRowProps>(function EditableRow(
    { schema, table, columns, onSaved },
    ref,
) {
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

    const error = validationError ?? (createRow.isError ? getErrorMessage(createRow.error) : null)

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
})

export function InlineColumnControl({
    column,
    value,
    onChange,
}: {
    column: DatabaseColumnMetadata
    value: string
    onChange: (value: string) => void
}) {
    if (column.is_auto_generated) {
        return <span className="text-xs text-muted-foreground">Auto</span>
    }

    const enumValues = Array.isArray(column.enum_values) ? column.enum_values : []
    if (enumValues.length > 0 || column.data_type === 'boolean') {
        const options = enumValues.length > 0 ? enumValues : ['true', 'false']
        return (
            <select
                aria-label={column.column_name}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            >
                <option value="">{column.column_default ? 'Use default' : 'Select…'}</option>
                {column.is_nullable && <option value={NULL_VALUE}>NULL</option>}
                {options.map((option) => (
                    <option key={option} value={option}>
                        {option}
                    </option>
                ))}
            </select>
        )
    }

    return (
        <Input
            aria-label={column.column_name}
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
