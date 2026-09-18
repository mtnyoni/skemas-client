import { useLoaderData, useNavigate, useSearch } from '@tanstack/react-router'

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '#/components/ui/select'
import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from '#/components/ui/combobox'

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
        <div className="space-y-2 px-2">
            <label htmlFor="database-schema" className="text-xs text-mist-500 font-medium">
                Database schema
            </label>

            <Combobox
                items={schemas.map((item) => item.schema_name)}
                value={selectedSchema ?? null}
                onValueChange={selectSchema}
            >
                <ComboboxInput placeholder="Select a framework" />
                <ComboboxContent>
                    <ComboboxEmpty>No items found.</ComboboxEmpty>
                    <ComboboxList>
                        {(item) => (
                            <ComboboxItem key={item} value={item}>
                                {item}
                            </ComboboxItem>
                        )}
                    </ComboboxList>
                </ComboboxContent>
            </Combobox>
            {schemas.length === 0 && (
                <p className="text-sm text-muted-foreground">No schemas found.</p>
            )}
        </div>
    )
}
