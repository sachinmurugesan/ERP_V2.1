"""drop_dead_tables_fix_is_split_nullable

Revision ID: fb606be1a020
Revises: 39d330b9efa7
Create Date: 2026-03-27 08:32:16.796600

Cleanup migration:
1. Backfill NULL is_split values, then enforce NOT NULL
2. Drop dead tables: production_milestones, delivery_records
   (model classes removed in Prompt 8 Category E — zero usage)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fb606be1a020'
down_revision: Union[str, None] = '39d330b9efa7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Step 1: Backfill NULL is_split values before making column NOT NULL
    op.execute(
        "UPDATE packing_list_items SET is_split = FALSE "
        "WHERE is_split IS NULL"
    )

    # Step 2: Now safe to enforce NOT NULL
    # Note: SQLite does not support ALTER COLUMN, so we use batch mode
    with op.batch_alter_table('packing_list_items') as batch_op:
        batch_op.alter_column(
            'is_split',
            existing_type=sa.Boolean(),
            nullable=False,
        )

    # Step 3: Drop dead tables (no active usage, no foreign keys,
    # model classes removed in Prompt 8 Category E)
    op.drop_index(
        'ix_production_milestones_order_id',
        table_name='production_milestones',
    )
    op.drop_table('production_milestones')
    op.drop_table('delivery_records')


def downgrade() -> None:
    # Recreate delivery_records (minimal schema for rollback)
    op.create_table(
        'delivery_records',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('order_id', sa.String(36), nullable=False),
        sa.Column('delivery_date', sa.Date(), nullable=False),
        sa.Column('delivered_by', sa.String(100), nullable=True),
        sa.Column('delivery_notes', sa.Text(), nullable=True),
        sa.Column('condition', sa.String(50), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('order_id'),
    )

    # Recreate production_milestones
    op.create_table(
        'production_milestones',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('order_id', sa.String(36), nullable=False),
        sa.Column('milestone_percent', sa.Integer(), nullable=False),
        sa.Column('milestone_date', sa.Date(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('photos', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'ix_production_milestones_order_id',
        'production_milestones',
        ['order_id'],
        unique=False,
    )

    # Revert is_split to nullable
    with op.batch_alter_table('packing_list_items') as batch_op:
        batch_op.alter_column(
            'is_split',
            existing_type=sa.Boolean(),
            nullable=True,
        )
