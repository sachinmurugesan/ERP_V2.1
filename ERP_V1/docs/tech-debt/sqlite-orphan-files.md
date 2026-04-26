# Tech debt: orphan SQLite files in backend directory

## Problem

`backend/` contains leftover SQLite write-ahead log files:

- `harvesterpdata.db-shm`
- `harvesterpdata.db-wal`

These are residue from an earlier dev session when someone ran the backend with `DATABASE_URL=sqlite:///harvesterpdata.db`.

Current backend rejects SQLite URLs (`config.py` raises explicitly). These files are inert — nothing reads or writes them.

## Impact

- Confusing for new developers ("is this database active?")
- Slight repo clutter
- No security or correctness risk

## Fix

1. Delete the orphan files:

   ```
   rm backend/harvesterpdata.db-shm backend/harvesterpdata.db-wal
   ```

   (Plus any `backend/harvesterpdata.db` file if present)

2. Add to `.gitignore` (if not already):

   ```
   backend/harvesterpdata.db
   backend/*.db-shm
   backend/*.db-wal
   ```

3. Verify git tracking — these files should not be tracked.

## Priority

LOW. Cleanup task, no functional impact.

## Discovered during

`feat/migrate-clients-list` pre-merge investigation.
