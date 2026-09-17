import { useLoaderData, useNavigate, useSearch } from '@tanstack/react-router'

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '#/components/ui/select'

export function SchemaSelect() {
    const schemas = useLoaderData({ from: '/' })
    const selectedSchema = useSearch({ from: '/', select: (search) => search.schema })
    const navigate = useNavigate({ from: '/' })

    function selectSchema(schema: string | null) {
        void navigate({
            search: {
                schema: schema ?? undefined,
                table: undefined,
            },
        })
    }

    return (
        <div className="space-y-2">
            <label htmlFor="database-schema" className="text-sm font-medium">
                Database schema
            </label>

            <Select value={selectedSchema ?? null} onValueChange={selectSchema}>
                <SelectTrigger id="database-schema" className="w-full">
                    <SelectValue placeholder="Select a schema" />
                </SelectTrigger>
                <SelectContent>
                    {schemas.map(({ schema_name }) => (
                        <SelectItem key={schema_name} value={schema_name}>
                            {schema_name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {schemas.length === 0 && (
                <p className="text-sm text-muted-foreground">No schemas found.</p>
            )}
        </div>
    )
}
