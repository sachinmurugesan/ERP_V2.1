"""
HarvestERP - Shared File Upload Utilities

Single source of truth for:
- Filename sanitization
- Chunked streaming to disk with size validation
"""
from fastapi import HTTPException, UploadFile
from pathlib import Path
import re as _re


CHUNK_SIZE = 1_048_576  # 1 MB — single definition for all upload handlers


ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"}
ALLOWED_DOCUMENT_EXTENSIONS = {".pdf", ".doc", ".docx", ".xlsx", ".xls", ".csv", ".txt"}
ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov", ".avi", ".mkv"}
ALLOWED_ALL_EXTENSIONS = ALLOWED_IMAGE_EXTENSIONS | ALLOWED_DOCUMENT_EXTENSIONS | ALLOWED_VIDEO_EXTENSIONS

DANGEROUS_EXTENSIONS = {".html", ".htm", ".js", ".jsx", ".ts", ".tsx", ".php", ".py", ".sh", ".bat", ".exe", ".cmd", ".ps1", ".svg"}


def validate_file_type(filename: str, allowed: set = None) -> str:
    """Validate file extension against allowlist. Returns the extension.
    Raises HTTPException 400 if file type is not allowed or is dangerous."""
    if not filename:
        raise HTTPException(status_code=400, detail="Filename is required")
    ext = Path(filename).suffix.lower()
    if ext in DANGEROUS_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type '{ext}' is not allowed for security reasons")
    if allowed and ext not in allowed:
        raise HTTPException(status_code=400, detail=f"File type '{ext}' is not allowed. Accepted: {', '.join(sorted(allowed))}")
    return ext


def sanitize_filename(raw_name: str) -> str:
    """Sanitize uploaded filename — remove unsafe characters."""
    name = Path(raw_name).name if raw_name else "upload"
    return _re.sub(r'[^\w\-.]', '_', name).lstrip('.')


async def stream_upload_to_disk(
    file: UploadFile,
    dest_path: Path,
    max_size: int,
) -> int:
    """Stream upload to disk in 1MB chunks.

    Returns file size in bytes.
    Raises HTTPException 413 if max_size exceeded.
    Cleans up partial file on any failure.
    """
    file_size = 0
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with open(dest_path, "wb") as f:
            while True:
                chunk = await file.read(CHUNK_SIZE)
                if not chunk:
                    break
                file_size += len(chunk)
                if file_size > max_size:
                    raise HTTPException(
                        status_code=413,
                        detail=f"File too large (max {max_size // 1_048_576}MB)",
                    )
                f.write(chunk)
    except HTTPException:
        dest_path.unlink(missing_ok=True)
        raise
    except Exception:
        dest_path.unlink(missing_ok=True)
        raise
    return file_size
