"""
Migration script: Remove consumer role from the system.
- Deletes all users with role='consumer'
- Updates the CheckConstraint to exclude 'consumer'
"""
import asyncio
from core.database import async_session
from sqlalchemy import text


async def remove_consumers():
    async with async_session() as db:
        # Delete consumer users
        result = await db.execute(
            text("DELETE FROM users WHERE role = 'consumer' RETURNING name, email")
        )
        deleted = result.fetchall()
        print(f"Deleted {len(deleted)} consumer user(s):")
        for row in deleted:
            print(f"  - {row[0]} ({row[1]})")

        # Drop old constraint
        await db.execute(
            text("ALTER TABLE users DROP CONSTRAINT IF EXISTS ck_users_role")
        )

        # Add new constraint without consumer
        await db.execute(
            text(
                "ALTER TABLE users ADD CONSTRAINT ck_users_role "
                "CHECK (role IN ('farmer', 'distributor', 'admin'))"
            )
        )
        print("Updated CheckConstraint: 'consumer' removed from allowed roles.")

        await db.commit()
        print("Done!")


if __name__ == "__main__":
    asyncio.run(remove_consumers())
