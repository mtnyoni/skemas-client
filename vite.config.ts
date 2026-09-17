import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const config = defineConfig({
    resolve: { tsconfigPaths: true },
    build: {
        rolldownOptions: {
            checks: {
                moduleLevelDirective: false,
            },
        },
    },
    plugins: [
        devtools(),
        nitro({
            minify: true,
            rollupConfig: { external: [/^@sentry\//] },
        }),
        tailwindcss(),
        tanstackStart(),
        viteReact(),
        babel({ presets: [reactCompilerPreset()] }),
    ],
})

export default config
