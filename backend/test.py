from sqlalchemy import text
from database import engine

try:
    with engine.connect() as connection:
        result = connection.execute(
            text("SELECT current_database()")
        )

        print("PostgreSQL Connected Successfully!")
        print("Database:", result.scalar())

except Exception as error:
    print("Connection Failed!")
    print(error)