import snowflake from "snowflake-sdk";

type SnowflakeStatus = {
  status: "disabled" | "connected" | "error";
  message?: string;
};

type SnowflakeTable = {
  schema: string;
  name: string;
  comment: string;
};

const REQUIRED_ENV_VARS = [
  "SNOWFLAKE_ACCOUNT",
  "SNOWFLAKE_USERNAME",
  "SNOWFLAKE_PASSWORD",
  "SNOWFLAKE_DATABASE",
  "SNOWFLAKE_SCHEMA",
  "SNOWFLAKE_WAREHOUSE",
];

let connection: snowflake.Connection | null = null;
let initialization: Promise<snowflake.Connection | null> | null = null;
let lastStatus: SnowflakeStatus = { status: "disabled" };

function hasRequiredEnvironmentVariables(): boolean {
  return REQUIRED_ENV_VARS.every((key) => Boolean(process.env[key]));
}

export async function ensureSnowflakeConnection(): Promise<
  snowflake.Connection | null
> {
  if (connection) {
    return connection;
  }

  if (!hasRequiredEnvironmentVariables()) {
    lastStatus = {
      status: "disabled",
      message: "Snowflake environment variables are not fully configured.",
    };
    return null;
  }

  if (initialization) {
    return initialization;
  }

  initialization = new Promise((resolve) => {
    const snowflakeConnection = snowflake.createConnection({
      account: process.env.SNOWFLAKE_ACCOUNT,
      username: process.env.SNOWFLAKE_USERNAME,
      password: process.env.SNOWFLAKE_PASSWORD,
      database: process.env.SNOWFLAKE_DATABASE,
      schema: process.env.SNOWFLAKE_SCHEMA,
      warehouse: process.env.SNOWFLAKE_WAREHOUSE,
      role: process.env.SNOWFLAKE_ROLE,
    });

    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      try {
        snowflakeConnection.destroy((destroyError) => {
          if (destroyError) {
            console.warn("Snowflake connection destroy failed", destroyError);
          }
        });
      } catch (destroyError) {
        console.warn("Snowflake connection timed out and destroy threw", destroyError);
      }

      lastStatus = {
        status: "error",
        message: "Snowflake connection attempt timed out.",
      };
      connection = null;
      resolve(null);
    }, 2000);

    snowflakeConnection.connect((err) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);

      if (err) {
        lastStatus = {
          status: "error",
          message: err.message,
        };
        connection = null;
        resolve(null);
        return;
      }

      connection = snowflakeConnection;
      lastStatus = { status: "connected" };
      resolve(connection);
    });
  }).finally(() => {
    initialization = null;
  });

  return initialization;
}

export function getSnowflakeStatus(): SnowflakeStatus {
  return lastStatus;
}

export async function executeSnowflakeQuery(
  sqlText: string,
  binds: unknown[] = [],
  options: { rowLimit?: number } = {}
): Promise<Array<Record<string, unknown>>> {
  const activeConnection = await ensureSnowflakeConnection();

  if (!activeConnection) {
    throw new Error("Snowflake connection is not configured or failed to initialize.");
  }

  const trimmedSql = sqlText.trim();
  if (!trimmedSql) {
    throw new Error("SQL statement cannot be empty.");
  }

  const rowLimit = options.rowLimit ?? 50;

  return await new Promise((resolve, reject) => {
    activeConnection.execute({
      sqlText: trimmedSql,
      binds,
      complete: (err, _stmt, rows) => {
        if (err) {
          reject(err);
          return;
        }

        if (!rows) {
          resolve([]);
          return;
        }

        resolve(rows.slice(0, rowLimit));
      },
    });
  });
}

export async function fetchSnowflakeTables(
  keywords: string[],
  limit = 5
): Promise<SnowflakeTable[]> {
  const activeConnection = await ensureSnowflakeConnection();

  if (!activeConnection) {
    return [];
  }

  const sanitizedKeywords = keywords
    .map((keyword) => keyword.toLowerCase().replace(/[^a-z0-9 _-]/g, "").trim())
    .filter(Boolean);

  const clauses = sanitizedKeywords.map(
    () => "(LOWER(table_name) LIKE ? OR LOWER(coalesce(comment, '')) LIKE ?)"
  );

  const sql = `
    SELECT table_schema, table_name, coalesce(comment, '') AS comment
    FROM information_schema.tables
    WHERE table_type = 'BASE TABLE'
      ${clauses.length > 0 ? `AND (${clauses.join(" OR ")})` : ""}
    ORDER BY table_schema, table_name
    LIMIT ${Math.max(1, Math.min(limit, 20))}
  `;

  const binds = sanitizedKeywords.flatMap((keyword) => {
    const pattern = `%${keyword}%`;
    return [pattern, pattern];
  });

  try {
    const rows = await executeSnowflakeQuery(sql, binds, { rowLimit: limit });

    return rows.map((row) => ({
      schema: String(row.TABLE_SCHEMA ?? row.table_schema ?? ""),
      name: String(row.TABLE_NAME ?? row.table_name ?? ""),
      comment: String(row.COMMENT ?? row.comment ?? ""),
    }));
  } catch (error) {
    lastStatus = {
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    };

    return [];
  }
}

export type { SnowflakeTable };
