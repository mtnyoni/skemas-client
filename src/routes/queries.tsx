import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/queries')({
    component: QueriesPage,
})

function QueriesPage() {
    return (
        <div className="grid min-h-full place-items-center p-8">
            <div className="text-center">
                <h1 className="font-semibold">Queries</h1>
                <p className="mt-1 text-sm text-muted-foreground">Query tools are coming next.</p>
            </div>
        </div>
    )
}
