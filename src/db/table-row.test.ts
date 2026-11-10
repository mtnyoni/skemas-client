import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Effect } from 'effect'
import { validateTableRows } from './table-row'
import type { TableColumnMetadata } from './table-metadata'

function column(
    column_name: string,
    udt_name: string,
    overrides: Partial<TableColumnMetadata> = {},
): TableColumnMetadata {
    return {
        column_name,
        udt_name,
        data_type: udt_name,
        is_nullable: false,
        column_default: null,
        is_identity: false,
        is_generated: false,
        is_primary_key: false,
        ordinal_position: 1,
        enum_values: [],
        is_application_generated: false,
        is_auto_generated: false,
        ...overrides,
    }
}

test('validates default driver values without losing precision or converting types', async () => {
    const columns = [
        column('id', 'int8'),
        column('count', 'int4'),
        column('active', 'bool'),
        column('price', 'numeric'),
        column('date', 'date'),
        column('created_at', 'timestamptz'),
        column('time', 'time'),
        column('zoned_time', 'timetz'),
        column('bytes', 'bytea'),
        column('duration', 'interval'),
        column('payload', 'jsonb'),
    ]
    const row = {
        id: 9007199254740993n,
        count: 4,
        active: true,
        price: '12345678901234567890.123456789',
        date: '2026-11-10',
        created_at: new Date('2026-11-10T00:00:00Z'),
        time: 45000000000n,
        zoned_time: '12:30:00+02',
        bytes: new Uint8Array([0, 255]),
        duration: { months: 1, days: 2, microseconds: 3n },
        payload: { nested: [true, null, 3, 'value'] },
    }
    assert.deepEqual(await Effect.runPromise(validateTableRows([row], columns)), [row])
})

test('enforces nullability, enum labels and array elements, including multiple dimensions', async () => {
    const columns = [
        column('name', 'text', { is_nullable: true }),
        column('status', 'status', { data_type: 'USER-DEFINED', enum_values: ['open', 'closed'] }),
        column('grid', '_int4', { data_type: 'ARRAY' }),
    ]
    const row = {
        name: null,
        status: 'open',
        grid: [
            [1, null],
            [2, 3],
        ],
    }
    assert.deepEqual(await Effect.runPromise(validateTableRows([row], columns)), [row])
    for (const invalid of [
        { ...row, status: 'invalid' },
        { ...row, grid: [[1, '2']] },
        { ...row, grid: null },
    ]) {
        await assert.rejects(Effect.runPromise(validateTableRows([invalid], columns)))
    }
})

test('rejects wrong scalar types, missing columns and unexpected columns', async () => {
    const columns = [column('count', 'int4')]
    for (const row of [
        { count: '1' },
        { count: 1.5 },
        { count: null },
        {},
        { count: 1, extra: 2 },
    ]) {
        await assert.rejects(Effect.runPromise(validateTableRows([row], columns)))
    }
    assert.deepEqual(await Effect.runPromise(validateTableRows([], columns)), [])
})

test('supports JSON null, date infinity, float specials and custom type text fallback', async () => {
    const columns = [
        column('json', 'jsonb'),
        column('date', 'date'),
        column('timestamp', 'timestamp'),
        column('float', 'float8'),
        column('custom', 'constructor', { data_type: 'USER-DEFINED' }),
        column('custom_array', '_status', { data_type: 'ARRAY' }),
    ]
    const row = {
        json: null,
        date: 'infinity',
        timestamp: new Date(Number.NaN),
        float: Number.POSITIVE_INFINITY,
        custom: 'custom text',
        custom_array: ['open', null, 'closed'],
    }
    assert.deepEqual(await Effect.runPromise(validateTableRows([row], columns)), [row])
})
