import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { z } from 'zod'

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '#/components/ui/select'
import { loadDBRelationships, loadSchemas } from '#/internal/functions'

import type { DatabaseDiagramTable, DatabaseRelationship } from '#/internal'

const searchSchema = z.object({
    schema: z.string().min(1).optional().catch(undefined),
})

export const Route = createFileRoute('/diagrams')({
    validateSearch: searchSchema,
    loader: () => loadSchemas(),
    component: DiagramsPage,
})

function DiagramsPage() {
    const schemas = Route.useLoaderData()
    const { schema } = Route.useSearch()
    const navigate = Route.useNavigate()
    const getRelationships = useServerFn(loadDBRelationships)
    const diagramQuery = useQuery({
        queryKey: ['database-relationships', schema],
        queryFn: () => getRelationships({ data: { schema: schema! } }),
        enabled: schema !== undefined,
    })

    function selectSchema(value: string | null) {
        void navigate({ search: { schema: value ?? undefined } })
    }

    return (
        <div className="flex min-h-screen flex-col">
            <header className="flex items-center justify-between gap-4 border-b px-6 py-4">
                <div>
                    <h1 className="font-semibold">Database diagram</h1>
                    <p className="text-sm text-muted-foreground">
                        Tables and foreign-key relationships
                    </p>
                </div>

                <Select value={schema ?? null} onValueChange={selectSchema}>
                    <SelectTrigger className="w-56">
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
            </header>

            <div className="min-h-0 flex-1 p-6">
                {!schema && (
                    <EmptyState message="Select a schema to generate its database diagram." />
                )}

                {schema && diagramQuery.isPending && (
                    <EmptyState message="Loading database relationships…" />
                )}

                {schema && diagramQuery.isError && (
                    <EmptyState message="Unable to load the database diagram." error />
                )}

                {schema && diagramQuery.isSuccess && diagramQuery.data.tables.length === 0 && (
                    <EmptyState message={`No tables found in ${schema}.`} />
                )}

                {schema && diagramQuery.isSuccess && diagramQuery.data.tables.length > 0 && (
                    <RelationshipDiagram
                        schema={schema}
                        tables={diagramQuery.data.tables}
                        relationships={diagramQuery.data.relationships}
                    />
                )}
            </div>
        </div>
    )
}

function EmptyState({ message, error = false }: { message: string; error?: boolean }) {
    return (
        <div className="grid min-h-72 place-items-center rounded-lg border border-dashed bg-muted/20">
            <p className={error ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>
                {message}
            </p>
        </div>
    )
}

const CARD_WIDTH = 260
const HEADER_HEIGHT = 42
const ROW_HEIGHT = 28
const CANVAS_PADDING = 64
const COLUMN_GAP = 140
const ROW_GAP = 90
const CARD_COLORS = ['#2563eb', '#0891b2', '#7c3aed', '#db2777', '#ea580c', '#16a34a']

type TablePosition = {
    table: DatabaseDiagramTable
    x: number
    y: number
    height: number
}

type Point = { x: number; y: number }

type DragState = {
    tableName: string
    pointerX: number
    pointerY: number
}

function RelationshipDiagram({
    schema,
    tables,
    relationships,
}: {
    schema: string
    tables: DatabaseDiagramTable[]
    relationships: DatabaseRelationship[]
}) {
    const viewportRef = useRef<HTMLDivElement>(null)
    const [zoom, setZoom] = useState(1)
    const [offsets, setOffsets] = useState<Record<string, Point>>({})
    const [dragging, setDragging] = useState<DragState | null>(null)
    const layout = createLayout(tables)
    const displayedTables = layout.tables.map((position) => {
        const offset = offsets[position.table.table_name] ?? { x: 0, y: 0 }
        return { ...position, x: position.x + offset.x, y: position.y + offset.y }
    })
    const positions = new Map(
        displayedTables.map((position) => [position.table.table_name, position]),
    )

    useEffect(() => {
        const viewport = viewportRef.current
        if (!viewport) return

        function zoomWithWheel(event: WheelEvent) {
            if (!event.ctrlKey && !event.metaKey) return
            event.preventDefault()
            setZoom((current) => clampZoom(current + (event.deltaY < 0 ? 0.1 : -0.1)))
        }

        viewport.addEventListener('wheel', zoomWithWheel, { passive: false })
        return () => viewport.removeEventListener('wheel', zoomWithWheel)
    }, [])

    function startDragging(tableName: string, pointerX: number, pointerY: number) {
        setDragging({ tableName, pointerX, pointerY })
    }

    function moveTable(pointerX: number, pointerY: number) {
        if (!dragging) return

        const basePosition = layout.tables.find(
            (position) => position.table.table_name === dragging.tableName,
        )
        if (!basePosition) return

        const currentOffset = offsets[dragging.tableName] ?? { x: 0, y: 0 }
        const nextX = clamp(
            basePosition.x + currentOffset.x + (pointerX - dragging.pointerX) / zoom,
            12,
            layout.width - CARD_WIDTH - 12,
        )
        const nextY = clamp(
            basePosition.y + currentOffset.y + (pointerY - dragging.pointerY) / zoom,
            12,
            layout.height - basePosition.height - 12,
        )

        setOffsets((current) => ({
            ...current,
            [dragging.tableName]: {
                x: nextX - basePosition.x,
                y: nextY - basePosition.y,
            },
        }))
        setDragging({ tableName: dragging.tableName, pointerX, pointerY })
    }

    return (
        <div className="relative h-[calc(100vh-9rem)] overflow-hidden rounded-lg border bg-slate-50">
            <div className="pointer-events-none absolute top-3 left-3 z-10 rounded-md border bg-white/90 px-2 py-1 text-xs text-slate-500 shadow-sm">
                Ctrl + scroll to zoom · Drag tables to move
            </div>

            <div className="absolute right-3 bottom-3 z-10 flex items-center overflow-hidden rounded-md border bg-white shadow-sm">
                <button
                    type="button"
                    aria-label="Zoom out"
                    className="grid size-8 place-items-center text-lg text-slate-700 hover:bg-slate-100"
                    onClick={() => setZoom((current) => clampZoom(current - 0.1))}
                >
                    −
                </button>
                <span className="min-w-14 border-x px-2 text-center text-xs text-slate-600">
                    {Math.round(zoom * 100)}%
                </span>
                <button
                    type="button"
                    aria-label="Zoom in"
                    className="grid size-8 place-items-center text-lg text-slate-700 hover:bg-slate-100"
                    onClick={() => setZoom((current) => clampZoom(current + 0.1))}
                >
                    +
                </button>
            </div>

            <div ref={viewportRef} className="scrollbar-thin h-full overflow-auto">
                <svg
                    role="img"
                    aria-label={`Entity relationship diagram for the ${schema} schema`}
                    width={layout.width * zoom}
                    height={layout.height * zoom}
                    viewBox={`0 0 ${layout.width} ${layout.height}`}
                    className="block min-h-full min-w-full touch-none select-none"
                    onPointerMove={(event) => moveTable(event.clientX, event.clientY)}
                    onPointerUp={() => setDragging(null)}
                    onPointerCancel={() => setDragging(null)}
                >
                    <defs>
                        <pattern
                            id="diagram-grid"
                            width="24"
                            height="24"
                            patternUnits="userSpaceOnUse"
                        >
                            <circle cx="1" cy="1" r="1" fill="#cbd5e1" opacity="0.55" />
                        </pattern>
                        <filter id="card-shadow" x="-20%" y="-20%" width="140%" height="150%">
                            <feDropShadow dx="0" dy="3" stdDeviation="5" floodOpacity="0.12" />
                        </filter>
                    </defs>

                    <rect width="100%" height="100%" fill="#f8fafc" />
                    <rect width="100%" height="100%" fill="url(#diagram-grid)" />

                    <g aria-label="Relationships">
                        {relationships.map((relationship) => {
                            const source = positions.get(relationship.source_table)
                            const target = positions.get(relationship.target_table)
                            if (!source || !target || relationship.target_schema !== schema)
                                return null

                            const path = createRelationshipPath(source, target, relationship)

                            return (
                                <g
                                    key={`${relationship.constraint_name}-${relationship.source_column}`}
                                >
                                    <title>
                                        {relationship.source_table}.{relationship.source_column} →{' '}
                                        {relationship.target_table}.{relationship.target_column}
                                    </title>
                                    <path
                                        d={path.d}
                                        fill="none"
                                        stroke="#64748b"
                                        strokeWidth="1.75"
                                    />
                                    <circle
                                        cx={path.startX}
                                        cy={path.startY}
                                        r="4"
                                        fill="#64748b"
                                    />
                                    <circle
                                        cx={path.endX}
                                        cy={path.endY}
                                        r="5"
                                        fill="#fff"
                                        stroke="#64748b"
                                        strokeWidth="2"
                                    />
                                </g>
                            )
                        })}
                    </g>

                    <g aria-label="Tables">
                        {displayedTables.map((position, index) => (
                            <TableCard
                                key={position.table.table_name}
                                position={position}
                                accent={CARD_COLORS[index % CARD_COLORS.length]}
                                dragging={dragging?.tableName === position.table.table_name}
                                onPointerDown={(pointerX, pointerY) =>
                                    startDragging(position.table.table_name, pointerX, pointerY)
                                }
                            />
                        ))}
                    </g>
                </svg>
            </div>
        </div>
    )
}

function TableCard({
    position,
    accent,
    dragging,
    onPointerDown,
}: {
    position: TablePosition
    accent: string
    dragging: boolean
    onPointerDown: (pointerX: number, pointerY: number) => void
}) {
    const { table, x, y, height } = position

    return (
        <g
            transform={`translate(${x} ${y})`}
            filter="url(#card-shadow)"
            className={dragging ? 'cursor-grabbing' : 'cursor-grab'}
            onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId)
                onPointerDown(event.clientX, event.clientY)
            }}
        >
            <rect width={CARD_WIDTH} height={height} rx="8" fill="#fff" stroke="#cbd5e1" />
            <path
                d={`M 8 0 H ${CARD_WIDTH - 8} Q ${CARD_WIDTH} 0 ${CARD_WIDTH} 8 V ${HEADER_HEIGHT} H 0 V 8 Q 0 0 8 0`}
                fill={accent}
            />
            <text x="14" y="26" fill="#fff" fontSize="14" fontWeight="600">
                {truncate(table.table_name, 28)}
            </text>

            {table.columns.map((column, index) => {
                const baseline = HEADER_HEIGHT + index * ROW_HEIGHT + 19

                return (
                    <g key={column.column_name}>
                        {index > 0 && (
                            <line
                                x1="0"
                                y1={HEADER_HEIGHT + index * ROW_HEIGHT}
                                x2={CARD_WIDTH}
                                y2={HEADER_HEIGHT + index * ROW_HEIGHT}
                                stroke="#e2e8f0"
                            />
                        )}
                        <text
                            x="12"
                            y={baseline}
                            fill={column.is_primary_key ? '#a16207' : '#334155'}
                            fontSize="12"
                            fontWeight={column.is_primary_key ? '600' : '400'}
                        >
                            {column.is_primary_key ? '◆ ' : ''}
                            {truncate(column.column_name, 20)}
                        </text>
                        <text
                            x={CARD_WIDTH - 12}
                            y={baseline}
                            fill="#94a3b8"
                            fontSize="10"
                            textAnchor="end"
                        >
                            {truncate(column.data_type, 15)}
                        </text>
                    </g>
                )
            })}
        </g>
    )
}

function createLayout(tables: DatabaseDiagramTable[]) {
    const columnCount = Math.max(1, Math.ceil(Math.sqrt(tables.length)))
    const positions: TablePosition[] = []
    let y = CANVAS_PADDING

    for (let rowStart = 0; rowStart < tables.length; rowStart += columnCount) {
        const row = tables.slice(rowStart, rowStart + columnCount)
        const heights = row.map(tableHeight)
        const rowHeight = Math.max(...heights)

        row.forEach((table, columnIndex) => {
            positions.push({
                table,
                x: CANVAS_PADDING + columnIndex * (CARD_WIDTH + COLUMN_GAP),
                y,
                height: heights[columnIndex],
            })
        })

        y += rowHeight + ROW_GAP
    }

    const visibleColumns = Math.min(columnCount, tables.length)
    return {
        tables: positions,
        width:
            CANVAS_PADDING * 2 +
            visibleColumns * CARD_WIDTH +
            Math.max(0, visibleColumns - 1) * COLUMN_GAP,
        height: y - ROW_GAP + CANVAS_PADDING,
    }
}

function tableHeight(table: DatabaseDiagramTable) {
    return HEADER_HEIGHT + Math.max(1, table.columns.length) * ROW_HEIGHT
}

function createRelationshipPath(
    source: TablePosition,
    target: TablePosition,
    relationship: DatabaseRelationship,
) {
    const sourceIndex = Math.max(
        0,
        source.table.columns.findIndex(
            (column) => column.column_name === relationship.source_column,
        ),
    )
    const targetIndex = Math.max(
        0,
        target.table.columns.findIndex(
            (column) => column.column_name === relationship.target_column,
        ),
    )
    const startY = source.y + HEADER_HEIGHT + (sourceIndex + 0.5) * ROW_HEIGHT
    const endY = target.y + HEADER_HEIGHT + (targetIndex + 0.5) * ROW_HEIGHT

    if (source === target || source.x === target.x) {
        const startX = source.x + CARD_WIDTH
        const endX = target.x + CARD_WIDTH
        return {
            startX,
            startY,
            endX,
            endY,
            d: `M ${startX} ${startY} C ${startX + 70} ${startY}, ${endX + 70} ${endY}, ${endX} ${endY}`,
        }
    }

    const direction = target.x > source.x ? 1 : -1
    const startX = source.x + (direction > 0 ? CARD_WIDTH : 0)
    const endX = target.x + (direction > 0 ? 0 : CARD_WIDTH)
    const curve = Math.max(60, Math.abs(endX - startX) * 0.45)

    return {
        startX,
        startY,
        endX,
        endY,
        d: `M ${startX} ${startY} C ${startX + direction * curve} ${startY}, ${endX - direction * curve} ${endY}, ${endX} ${endY}`,
    }
}

function truncate(value: string, length: number) {
    return value.length > length ? `${value.slice(0, length - 1)}…` : value
}

function clampZoom(zoom: number) {
    return Math.round(clamp(zoom, 0.4, 2.5) * 10) / 10
}

function clamp(value: number, minimum: number, maximum: number) {
    return Math.min(Math.max(value, minimum), maximum)
}
