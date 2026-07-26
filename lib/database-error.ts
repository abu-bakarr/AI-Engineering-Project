export function databaseErrorResponse(error: unknown) {
  const status =
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
      ? error.status
      : null;
  if (status) {
    return {
      status,
      body: {
        error: error instanceof Error ? error.message : "Request rejected.",
      },
    };
  }

  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : undefined;

  if (code === "P1001") {
    return {
      status: 503,
      body: {
        error: "Database is not reachable.",
        details:
          "Set DATABASE_URL to your Supabase Session pooler connection string, then run npm run db:check.",
      },
    };
  }

  return {
    status: 500,
    body: {
      error: error instanceof Error ? error.message : "Unexpected server error.",
    },
  };
}
