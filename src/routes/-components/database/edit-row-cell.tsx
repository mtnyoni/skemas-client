import { InlineColumnControl, NULL_VALUE } from './editable-row'
import { Button } from '#/components/ui/button'
import type { DatabaseColumnMetadata, QueryValue } from '#/internal'

export function editValue(value: QueryValue, column: DatabaseColumnMetadata): string {
    if (value === null) return NULL_VALUE
    if (value instanceof Date) {
        const iso = value.toISOString()
        if (column.data_type === 'date') return iso.slice(0, 10)
        if (column.data_type.includes('timestamp')) return iso.slice(0, 16)
        if (column.data_type.includes('time')) return iso.slice(11, 19)
        return iso
    }
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
}

export function EditRowCell({
    column,
    originalValue,
    value,
    onChange,
}: {
    column: DatabaseColumnMetadata
    originalValue: QueryValue
    value?: string
    onChange: (value: string) => void
}) {
    const currentValue = value ?? editValue(originalValue, column)
    return (
        <div className="flex items-center gap-1">
            <InlineColumnControl
                column={column}
                editing
                value={currentValue === NULL_VALUE ? '' : currentValue}
                onChange={onChange}
            />
            {column.is_nullable && (
                <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={() => onChange(currentValue === NULL_VALUE ? '' : NULL_VALUE)}
                >
                    {currentValue === NULL_VALUE ? 'Enter value' : 'Set NULL'}
                </Button>
            )}
        </div>
    )
}
