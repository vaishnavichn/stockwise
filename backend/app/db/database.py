"""
Supabase query helper wrapper with auto-pagination, retry logic, and clean exception handling.
"""

from __future__ import annotations

import time
import logging
from typing import Any
from app.db.supabase_client import get_supabase_client

log = logging.getLogger(__name__)


def fetch_all(table_name: str, query_builder_func=None, max_retries: int = 3) -> list[dict[str, Any]]:
    """
    Fetch all rows matching a query from Supabase with auto-pagination (>1000 rows)
    and exponential backoff retry for transient network / connection drops.
    """
    client = get_supabase_client()
    page_size = 1000

    for attempt in range(1, max_retries + 1):
        all_rows: list[dict[str, Any]] = []
        start = 0
        try:
            while True:
                q = client.table(table_name).select("*")
                if query_builder_func:
                    q = query_builder_func(q)

                res = q.range(start, start + page_size - 1).execute()
                rows = res.data or []
                all_rows.extend(rows)

                if len(rows) < page_size:
                    break
                start += page_size

            return all_rows

        except Exception as exc:
            err_msg = str(exc)

            # Non-transient errors: fail immediately without retry
            if "relation" in err_msg or "does not exist" in err_msg or "PGRST204" in err_msg or "PGRST205" in err_msg:
                raise RuntimeError(
                    f"Database table '{table_name}' does not exist in Supabase. "
                    "Did you run schema.sql in the Supabase SQL Editor?"
                ) from exc
            elif "JWT" in err_msg or "apikey" in err_msg or "Invalid key" in err_msg or "401" in err_msg:
                raise RuntimeError(
                    "Supabase connection failed. Check your SUPABASE_URL and SUPABASE_SECRET_KEY in backend/.env."
                ) from exc

            # Transient connection / network errors: retry with exponential backoff
            if attempt < max_retries:
                backoff = 0.5 * (2 ** (attempt - 1))  # 0.5s, 1.0s, 2.0s
                log.warning(
                    "Transient Supabase error on table '%s' (Attempt %d/%d): %s. Retrying in %.1fs...",
                    table_name,
                    attempt,
                    max_retries,
                    err_msg,
                    backoff,
                )
                time.sleep(backoff)
            else:
                raise RuntimeError(
                    f"Supabase query error on table '{table_name}' (after {max_retries} attempts): {exc}"
                ) from exc
