"""Add payment verification fields

Revision ID: b2c3d4e5f6g7
Revises: a1b2c3d4e5f6
Create Date: 2026-04-02
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b2c3d4e5f6g7"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("payments") as batch_op:
        batch_op.add_column(sa.Column("proof_file_path", sa.String(500), nullable=True))
        batch_op.add_column(
            sa.Column(
                "verification_status",
                sa.String(30),
                nullable=False,
                server_default="VERIFIED",
            )
        )
        batch_op.add_column(sa.Column("rejection_reason", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("submitted_by", sa.String(36), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("payments") as batch_op:
        batch_op.drop_column("submitted_by")
        batch_op.drop_column("rejection_reason")
        batch_op.drop_column("verification_status")
        batch_op.drop_column("proof_file_path")
