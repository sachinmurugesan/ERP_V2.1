"""add_created_by_to_processing_jobs

G-015: Excel job endpoints lacked per-job ownership check.
Adds created_by (user ID) to processing_jobs so GET/DELETE endpoints
can enforce that only the creating user (or ADMIN/SUPER_ADMIN) can
access a specific job.

Existing rows receive NULL (no backfill — historical jobs have no
known creator; NULL is treated as "system job" and allows ADMIN access only).

Revision ID: a3f8d2e1c9b0
Revises: ff1c4c67e25f
Create Date: 2026-04-22 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3f8d2e1c9b0'
down_revision: Union[str, None] = 'ff1c4c67e25f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('processing_jobs', sa.Column('created_by', sa.String(length=36), nullable=True))
    op.create_index('ix_processing_jobs_created_by', 'processing_jobs', ['created_by'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_processing_jobs_created_by', table_name='processing_jobs')
    op.drop_column('processing_jobs', 'created_by')
