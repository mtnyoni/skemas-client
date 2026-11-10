import { Button } from '#/components/ui/button'

export function TableSaveBar({
    count,
    saving,
    error,
    disabled,
    onSave,
    onCancel,
}: {
    count: number
    saving: boolean
    error: string | null
    disabled: boolean
    onSave: () => void
    onCancel: () => void
}) {
    return (
        <section
            aria-label="Save changes"
            className="fixed bottom-5 left-1/2 z-50 w-[calc(100%_-_2rem)] max-w-lg -translate-x-1/2 rounded-xl border border-border bg-background p-3 shadow-xl"
        >
            {error && (
                <p role="alert" className="mb-3 max-h-16 overflow-y-auto text-xs text-destructive">
                    {error}
                </p>
            )}
            <div className="flex items-center justify-between gap-4">
                <div aria-live="polite">
                    <p className="text-sm font-medium">Save changes</p>
                    <p className="text-xs text-muted-foreground">
                        {saving
                            ? 'Saving…'
                            : `${count} ${count === 1 ? 'row' : 'rows'} with unsaved changes`}
                    </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
                        Cancel
                    </Button>
                    <Button type="button" onClick={onSave} disabled={saving || disabled}>
                        {saving ? 'Saving…' : 'Save'}
                    </Button>
                </div>
            </div>
        </section>
    )
}
