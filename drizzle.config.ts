import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

config({ path: ['.env.local', '.env'] })

export default defineConfig({
    out: './drizzle',
    schema: './src/db/schema.ts',
    dialect: 'postgresql',
    dbCredentials: {
        host: requiredEnv('DB_HOST'),
        port: databasePort(),
        user: requiredEnv('DB_USER'),
        password: requiredEnv('DB_PASSWORD'),
        database: requiredEnv('DB_NAME'),
    },
})

function requiredEnv(name: string) {
    const value = process.env[name]
    if (!value) throw new Error(`Missing required environment variable: ${name}`)
    return value
}

function databasePort() {
    const port = Number(requiredEnv('DB_PORT'))
    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
        throw new Error('DB_PORT must be a valid TCP port')
    }
    return port
}
