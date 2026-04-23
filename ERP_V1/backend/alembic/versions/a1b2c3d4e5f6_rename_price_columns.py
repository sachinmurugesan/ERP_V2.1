"""Rename price columns: factory_price_cny -> factory_price, selling_price_cny -> selling_price

Revision ID: a1b2c3d4e5f6
Revises: ff1c4c67e25f
Create Date: 2026-04-02
"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "ff1c4c67e25f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # OrderItem table: rename factory_price_cny -> factory_price, selling_price_cny -> selling_price
    with op.batch_alter_table("order_items") as batch_op:
        batch_op.alter_column("factory_price_cny", new_column_name="factory_price")
        batch_op.alter_column("selling_price_cny", new_column_name="selling_price")

    # UnloadedItem table: rename factory_price_cny -> factory_price
    with op.batch_alter_table("unloaded_items") as batch_op:
        batch_op.alter_column("factory_price_cny", new_column_name="factory_price")


def downgrade() -> None:
    with op.batch_alter_table("order_items") as batch_op:
        batch_op.alter_column("factory_price", new_column_name="factory_price_cny")
        batch_op.alter_column("selling_price", new_column_name="selling_price_cny")

    with op.batch_alter_table("unloaded_items") as batch_op:
        batch_op.alter_column("factory_price", new_column_name="factory_price_cny")
