import '@tanstack/react-start/server-only'
import { PgClient } from '@effect/sql-pg'
import { Config } from 'effect'
import { SqlClient } from 'effect/sql'

export const Sql = SqlClient.SqlClient
export const SqlLive = PgClient.layerConfig({
    host: Config.NonEmptyString('DB_HOST'),
    port: Config.Port('DB_PORT'),
    username: Config.NonEmptyString('DB_USER'),
    password: Config.Redacted('DB_PASSWORD'),
    database: Config.NonEmptyString('DB_NAME'),
})
