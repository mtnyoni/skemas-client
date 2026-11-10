import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getRowIdentity, updateCellDraft } from './table-edits'
import type { DatabaseColumnMetadata } from '#/internal'

const name: DatabaseColumnMetadata = {
    column_name: 'name',
    data_type: 'text',
    udt_name: 'text',
    is_nullable: true,
    column_default: null,
    is_identity: false,
    is_generated: false,
    is_primary_key: false,
    is_application_generated: false,
    is_auto_generated: false,
    ordinal_position: 2,
    enum_values: [],
}
const keys = [{ ...name, column_name: 'id', is_primary_key: true }]

test('keeps edits for multiple rows and removes changes when the original value is restored', () => {
    const first = { id: 1, name: 'First' }
    const second = { id: 2, name: 'Second' }
    const firstDraft = updateCellDraft(new Map(), first, name, keys, 'Updated first')
    const bothDrafts = updateCellDraft(firstDraft, second, name, keys, 'Updated second')
    assert.equal(firstDraft.size, 1)
    assert.equal(bothDrafts.size, 2)
    const remaining = updateCellDraft(bothDrafts, first, name, keys, 'First')
    assert.equal(remaining.size, 1)
    assert.equal(remaining.get(getRowIdentity(second, keys)!.id)?.values.name, 'Updated second')
})

test('keeps original snapshots across a refetch, and distinguishes NULL from an empty string', () => {
    const original = { id: 1, name: null }
    const changed = updateCellDraft(new Map(), original, name, keys, '')
    const identity = getRowIdentity(original, keys)!
    assert.equal(changed.get(identity.id)?.values.name, '')
    const refetched = { id: 1, name: 'Changed on server' }
    const updated = updateCellDraft(changed, refetched, name, keys, 'New value')
    assert.equal(updated.get(identity.id)?.row, original)
})

test('uses stable composite keys and preserves bigint precision', () => {
    const composite = [...keys, { ...keys[0], column_name: 'tenant' }]
    const row = { id: 9007199254740993n, tenant: 'a', name: 'Value' }
    assert.deepEqual(getRowIdentity(row, composite)?.key, { id: '9007199254740993', tenant: 'a' })
    assert.equal(getRowIdentity(row, composite)?.id, getRowIdentity({ ...row }, composite)?.id)
    assert.equal(getRowIdentity(row, []), null)
    assert.equal(getRowIdentity({ id: null }, keys), null)
})
