import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatPostgresArray, formatTableValue } from './table-value'

test('renders bigint arrays and intervals without JSON serialization errors or precision loss', () => {
    assert.equal(formatTableValue([9007199254740993n, null]), '["9007199254740993",null]')
    assert.equal(
        formatTableValue({ months: 1, days: 2, microseconds: 9007199254740993n }),
        '{"months":1,"days":2,"microseconds":"9007199254740993"}',
    )
    assert.equal(formatTableValue(new Uint8Array([0, 15, 255])), '\\x000fff')
})

test('formats arrays for the existing PostgreSQL update endpoint, preserving NULL and escaping', () => {
    assert.equal(
        formatPostgresArray([
            ['NULL', null],
            ['a"b', 'a\\b'],
        ]),
        '{{"NULL",NULL},{"a\\"b","a\\\\b"}}',
    )
    assert.equal(formatPostgresArray([9007199254740993n]), '{"9007199254740993"}')
})
