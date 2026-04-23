"""
HarvestERP — Automatic Cleanup Service

Storage management:
- Temp files: FIFO queue — keep max MAX_TEMP_FILES, delete oldest when limit exceeded
- Stale jobs: Delete ProcessingJob records older than JOB_MAX_AGE_DAYS

Safe to run multiple times — idempotent.
"""
import logging
from datetime import datetime, timedelta
from pathlib import Path

from sqlalchemy.orm import Session

from config import UPLOAD_DIR

logger = logging.getLogger("harvestERP.cleanup")

# Max temp files to keep (FIFO — oldest deleted first)
MAX_TEMP_FILES = 10

# Processing jobs older than this are cleaned up
JOB_MAX_AGE_DAYS = 7


def enforce_temp_file_limit() -> dict:
    """Keep only the newest MAX_TEMP_FILES in temp/. Delete oldest first (FIFO).

    Called after every new upload to enforce the cap.
    Also called on startup to clean any excess from previous sessions.
    """
    temp_dir = UPLOAD_DIR / "temp"
    if not temp_dir.exists():
        return {"deleted": 0, "freed_mb": 0}

    # Get all files sorted by modification time (newest first)
    files = sorted(
        [f for f in temp_dir.iterdir() if f.is_file()],
        key=lambda f: f.stat().st_mtime,
        reverse=True,
    )

    if len(files) <= MAX_TEMP_FILES:
        return {"deleted": 0, "freed_mb": 0}

    # Delete everything beyond the limit (oldest files)
    to_delete = files[MAX_TEMP_FILES:]
    deleted = 0
    freed = 0

    for f in to_delete:
        try:
            size = f.stat().st_size
            f.unlink()
            deleted += 1
            freed += size
        except Exception as e:
            logger.warning(f"Failed to delete temp file {f}: {e}")

    if deleted:
        logger.info(
            f"Temp cleanup: kept {MAX_TEMP_FILES} newest, "
            f"deleted {deleted} oldest, freed {freed / 1024 / 1024:.1f} MB"
        )

    return {"deleted": deleted, "freed_mb": round(freed / 1024 / 1024, 1)}


def cleanup_stale_jobs(db: Session) -> dict:
    """Delete ProcessingJob records older than JOB_MAX_AGE_DAYS that were never applied.

    Also deletes the associated temp file if it still exists.
    """
    from models import ProcessingJob

    cutoff = datetime.utcnow() - timedelta(days=JOB_MAX_AGE_DAYS)
    stale_jobs = db.query(ProcessingJob).filter(
        ProcessingJob.created_at < cutoff,
    ).all()

    deleted = 0
    for job in stale_jobs:
        # Delete the temp file if it exists
        if job.file_path:
            fpath = UPLOAD_DIR / job.file_path if not Path(job.file_path).is_absolute() else Path(job.file_path)
            if fpath.exists():
                try:
                    fpath.unlink()
                except Exception:
                    pass

        db.delete(job)
        deleted += 1

    if deleted:
        db.commit()
        logger.info(f"Cleanup: deleted {deleted} stale processing jobs (older than {JOB_MAX_AGE_DAYS} days)")

    return {"deleted": deleted}


def run_cleanup(db: Session) -> dict:
    """Run all cleanup tasks. Safe to call on every startup."""
    results = {
        "temp_files": enforce_temp_file_limit(),
        "stale_jobs": cleanup_stale_jobs(db),
    }
    return results
