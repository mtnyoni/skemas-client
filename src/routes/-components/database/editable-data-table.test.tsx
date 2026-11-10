import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { EditableDataTable } from './editable-data-table'
import { TableSaveBar } from './table-save-bar'
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
const id = { ...name, column_name: 'id', is_primary_key: true }

test('renders editable inputs immediately, with no Edit or Set NULL buttons', () => {
    const html = renderToStaticMarkup(
        createElement(EditableDataTable, {
            columns: [
                { name: 'id', metadata: id },
                { name: 'name', metadata: name },
            ],
            rows: [{ id: 1, name: 'Current value' }],
            drafts: new Map(),
            keyColumns: [id],
            disabled: false,
            onChange: () => {},
        }),
    )
    assert.match(html, /<table/)
    assert.match(html, /<input[^>]*value="Current value"/)
    assert.match(html, /h-full w-full/)
    assert.doesNotMatch(html, /Set NULL|Enter value|>Edit</)
    assert.equal((html.match(/<input/g) ?? []).length, 1)
})

test('keeps rows without a primary key read-only', () => {
    const html = renderToStaticMarkup(
        createElement(EditableDataTable, {
            columns: [{ name: 'name', metadata: name }],
            rows: [{ name: 'Current value' }],
            drafts: new Map(),
            keyColumns: [],
            disabled: false,
            onChange: () => {},
        }),
    )
    assert.doesNotMatch(html, /<input/)
    assert.match(html, /Current value/)
})

test('renders a floating Save changes bar and disables actions while saving', () => {
    const html = renderToStaticMarkup(
        createElement(TableSaveBar, {
            count: 2,
            saving: true,
            error: null,
            disabled: false,
            onSave: () => {},
            onCancel: () => {},
        }),
    )
    assert.match(html, /fixed bottom-5/)
    assert.match(html, /Save changes/)
    assert.match(html, /Saving…/)
    assert.equal((html.match(/\sdisabled=""/g) ?? []).length, 2)
})
