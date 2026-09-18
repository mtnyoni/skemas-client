import { useNavigate, useSearch } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useQuery } from '@tanstack/react-query'

import { loadTables } from '#/internal/functions'
import { Skeleton } from '#/components/ui/skeleton'
import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
} from '#/components/ui/input-group'
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useCallback, useEffect, useRef, useState } from 'react'

export function TablesList() {
    return (
        <div className="space-y-2">
            <h2 className="text-xs text-mist-500 font-medium">Tables</h2>
            <div>
                <TableNameSearch />
            </div>
            <TablesNames />
        </div>
    )
}

function TableNameSearch() {
    const navigate = useNavigate({ from: '/' })
    const search = useSearch({ from: '/' })
    const [TablesQuery, setTablesQuery] = useState(search.tableQuery ?? '')
    const [searching, setSearching] = useState(false)
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
        }
    }, [])

    const handleSearchChange = useCallback(
        (value: string) => {
            setTablesQuery(value)
            setSearching(true)

            if (debounceRef.current) clearTimeout(debounceRef.current)

            debounceRef.current = setTimeout(() => {
                void navigate({
                    to: '/',
                    search: {
                        ...search,
                        tableQuery: value || undefined,
                    },
                    replace: true,
                }).finally(() => setSearching(false))
            }, 300)
        },
        [navigate, search],
    )

    return (
        <InputGroup className="mt-3 max-w-xs">
            <InputGroupAddon>
                <MagnifyingGlassIcon className="text-muted-foreground size-3.5" />
            </InputGroupAddon>
            <InputGroupInput
                placeholder="Search tables…"
                value={TablesQuery}
                onChange={(event) => handleSearchChange(event.target.value)}
            />
            {searching ? (
                <InputGroupAddon>..</InputGroupAddon>
            ) : TablesQuery.trim() !== '' ? (
                <InputGroupButton onClick={() => handleSearchChange('')}>
                    <XMarkIcon />
                </InputGroupButton>
            ) : null}
        </InputGroup>
    )
}

export function TablesNames() {
    const { schema: selectedSchema, table: selectedTable, tableQuery } = useSearch({ from: '/' })
    const navigate = useNavigate({ from: '/' })

    const getTables = useServerFn(loadTables)
    const {
        isPending,
        isError,
        error,
        data: tables,
    } = useQuery({
        queryKey: ['tables', selectedSchema],
        queryFn: () => getTables({ data: { schema: selectedSchema!, tableQuery } }),
        enabled: selectedSchema !== undefined,
    })

    function selectTable(table: string) {
        void navigate({
            search: (previous) => ({
                ...previous,
                table,
                sort: undefined,
                order: undefined,
            }),
        })
    }

    if (!selectedSchema) return null
    if (isPending) {
        return (
            <div className="space-y-2">
                <div className="space-y-1">
                    {Array.from({ length: 8 }).map(() => (
                        <Skeleton className="w-full h-8" />
                    ))}
                </div>
            </div>
        )
    }

    if (isError) {
        return (
            <div className="space-y-2">
                <p className="text-[13px] text-rose-800">Unable to load tables. {error.message}</p>
            </div>
        )
    }

    if (tables.length === 0) {
        return (
            <div className="space-y-2">
                <div className="text-[13px] text-muted-foreground border border-dashed h-40 grid place-items-center rounded-md">
                    <div className="text-center">
                        <h3 className="font-medium text-mist-800">No loaded tables</h3>
                        <div>No tables found in {selectedSchema}.</div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-2">
            <ul>
                {tables.map(({ table_name }) => (
                    <li key={table_name}>
                        <button
                            type="button"
                            className="relative before:h-5 before:top-1/2 before:-translate-y-1/2 before:absolute before:w-0.5 before:rounded-full data-selected:before:bg-amber-700 overflow-hidden before:ml-0 before:inset-0 rounded-md w-full text-mist-800 px-2 h-8 text-left text-[13px] hover:bg-accent data-[selected=true]:bg-accent data-[selected=true]:font-medium"
                            data-selected={selectedTable === table_name}
                            onClick={() => selectTable(table_name)}
                        >
                            {table_name}
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    )
}
