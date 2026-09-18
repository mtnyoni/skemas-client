'use client'

import { createColumnHelper } from '@tanstack/react-table'

import type { DataTableFeatures } from '#/routes/-components/database/data-table-features'

type QueryValue = string | number | boolean | null | Date
const columnHelper = createColumnHelper<DataTableFeatures, Record<string, QueryValue>>()

export const columns = columnHelper.columns([
    columnHelper.accessor('status', {
        header: 'Status',
    }),
    columnHelper.accessor('email', {
        header: 'Email',
    }),
    columnHelper.accessor('amount', {
        header: 'Amount',
    }),
])
