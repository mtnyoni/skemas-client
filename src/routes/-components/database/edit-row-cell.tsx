import { InlineColumnControl, NULL_VALUE } from './editable-row'
import type { DatabaseColumnMetadata } from '#/internal'
import type { TableValue } from '#/db/table-row'
import { editValue } from './table-value'

export { editValue } from './table-value'

export function EditRowCell({
    column,
    originalValue,
    value,
    onChange,
    disabled = false,
    label,
}: {
    column: DatabaseColumnMetadata
    originalValue: TableValue
    value?: string
    onChange: (value: string) => void
    disabled?: boolean
    label?: string
}) {
    const currentValue = value ?? editValue(originalValue, column)
    const usesSelect = column.enum_values.length > 0 || column.data_type === 'boolean'
    return (
        <InlineColumnControl
            column={column}
            editing
            fullCell
            disabled={disabled}
            label={label}
            value={currentValue === NULL_VALUE && !usesSelect ? '' : currentValue}
            onChange={onChange}
        />
    )
}
