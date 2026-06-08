import asyncio
import sys
import os

# Add parent directory to path so we can import core modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from core.database import engine

async def main():
    async with engine.begin() as conn:
        try:
            # Check if column already exists
            result = await conn.execute(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name='users' AND column_name='is_verified';"
            ))
            exists = result.scalar_one_or_none()
            
            if not exists:
                print("Adding is_verified column to users table...")
                await conn.execute(text("ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT TRUE;"))
                # Update existing records to TRUE
                await conn.execute(text("UPDATE users SET is_verified = TRUE WHERE is_verified IS NULL;"))
                print("Successfully added is_verified column.")
            else:
                print("is_verified column already exists.")
        except Exception as e:
            print("Error executing SQL:", e)

if __name__ == "__main__":
    asyncio.run(main())
