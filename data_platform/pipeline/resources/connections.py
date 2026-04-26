import os
import duckdb
import psycopg2
from dagster import ConfigurableResource, InitResourceContext


class PostgresResource(ConfigurableResource):
    """Wraps a Postgres connection using DATABASE_URL from the environment."""
    connection_string: str = ""

    def get_connection(self):
        url = self.connection_string or os.environ["DATABASE_URL"]
        return psycopg2.connect(url)


class DuckDBResource(ConfigurableResource):
    """Wraps a DuckDB connection to the local warehouse file."""
    db_path: str = "budjet.duckdb"

    def get_connection(self, read_only: bool = False) -> duckdb.DuckDBPyConnection:
        return duckdb.connect(self.db_path, read_only=read_only)
