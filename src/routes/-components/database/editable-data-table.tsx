import { EditRowCell } from './edit-row-cell'
import { InlineColumnControl } from './editable-row'
import { formatTableValue } from './table-value'
import { getRowIdentity } from './table-edits'
import type { RowDraft } from './table-edits'
import type { DatabaseColumnMetadata } from '#/internal'
import type { TableRow } from '#/db/table-row'

type TableColumn = { name: string; metadata?: DatabaseColumnMetadata }

export function EditableDataTable({
    columns,
    rows,
    drafts,
    keyColumns,
    disabled,
    onChange,
    newRow,
}: {
    columns: TableColumn[]
    rows: readonly TableRow[]
    drafts: ReadonlyMap<string, RowDraft>
    keyColumns: readonly DatabaseColumnMetadata[]
    disabled: boolean
    onChange: (row: TableRow, column: DatabaseColumnMetadata, value: string) => void
    newRow?: {
        values: Record<string, string>
        onChange: (column: string, value: string) => void
        pending: boolean
        disabled: boolean
    }
}) {
    return (
        <div className="overflow-x-auto border-y border-border">
            <table
                aria-label="Table data"
                className="w-full table-fixed border-collapse text-sm"
                style={{ minWidth: columns.length * 224 }}
            >
                <thead>
                    <tr className="border-b border-border bg-muted/30">
                        {columns.map((column) => (
                            <th
                                key={column.name}
                                scope="col"
                                className="h-9 border-r border-border px-3 text-left text-xs font-medium text-muted-foreground last:border-r-0"
                            >
                                <span className="block truncate capitalize" title={column.name}>
                                    {column.name.replaceAll('_', ' ')}
                                </span>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {newRow && (
                        <tr className="bg-primary/5">
                            {columns.map((column) => (
                                <td
                                    key={column.name}
                                    className="h-10 border-b border-r border-border p-0 last:border-r-0"
                                >
                                    <div className="h-10 w-full">
                                        {newRow.pending ? (
                                            <span className="block px-3 py-2 text-xs text-muted-foreground">
                                                Loading…
                                            </span>
                                        ) : column.metadata ? (
                                            <InlineColumnControl
                                                column={column.metadata}
                                                value={newRow.values[column.name] ?? ''}
                                                onChange={(value) =>
                                                    newRow.onChange(column.name, value)
                                                }
                                                fullCell
                                                disabled={newRow.disabled}
                                            />
                                        ) : (
                                            <span className="block px-3 py-2 text-xs text-muted-foreground">
                                                Unavailable
                                            </span>
                                        )}
                                    </div>
                                </td>
                            ))}
                        </tr>
                    )}
                    {rows.map((row, index) => {
                        const identity = getRowIdentity(row, keyColumns)
                        const draft = identity ? drafts.get(identity.id) : undefined
                        const original = draft?.row ?? row
                        return (
                            <tr key={identity?.id ?? index}>
                                {columns.map((column) => {
                                    const meta = column.metadata
                                    const editable =
                                        identity &&
                                        meta &&
                                        !meta.is_primary_key &&
                                        !meta.is_identity &&
                                        !meta.is_generated
                                    const dirty = draft && Object.hasOwn(draft.values, column.name)
                                    return (
                                        <td
                                            key={column.name}
                                            className={`h-10 border-b border-r border-border p-0 align-middle last:border-r-0 ${dirty ? 'bg-amber-50/70 dark:bg-amber-950/20' : ''}`}
                                        >
                                            <div className="h-10 w-full min-w-0">
                                                {editable ? (
                                                    <EditRowCell
                                                        column={meta}
                                                        originalValue={original[column.name]}
                                                        value={draft?.values[column.name]}
                                                        disabled={disabled}
                                                        label={`${column.name}, row ${index + 1}`}
                                                        onChange={(value) =>
                                                            onChange(original, meta, value)
                                                        }
                                                    />
                                                ) : (
                                                    <span
                                                        className="block truncate px-3 py-2 text-muted-foreground"
                                                        title={formatTableValue(row[column.name])}
                                                    >
                                                        {formatTableValue(row[column.name])}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    )
                                })}
                            </tr>
                        )
                    })}
                    {!rows.length && !newRow && (
                        <tr>
                            <td
                                colSpan={Math.max(columns.length, 1)}
                                className="h-24 text-center text-muted-foreground"
                            >
                                No results.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    )
}
