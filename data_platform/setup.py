from setuptools import find_packages, setup

setup(
    name="budjet_pipeline",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "dagster",
        "dagster-webserver",
        "dagster-dbt",
        "dbt-core",
        "dbt-duckdb",
        "duckdb",
        "pandas",
        "pyarrow",
        "psycopg2-binary",
        "python-dotenv",
    ],
)
