"""
Supabase client initializer for backend services.

Uses SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_KEY / SUPABASE_PUBLISHABLE_KEY fallback)
from environment variables via python-dotenv.
"""

from __future__ import annotations

import os
from functools import lru_cache
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv(override=True)


def get_supabase_url() -> str:
    url = (os.getenv("SUPABASE_URL") or "").strip()
    if not url or "YOUR_PROJECT_REF" in url or "your-project-ref" in url:
        raise RuntimeError(
            "SUPABASE_URL is not set or contains placeholder value. "
            "Please configure your real SUPABASE_URL in backend/.env"
        )
    return url


def get_supabase_key() -> str:
    # Prefer SUPABASE_SECRET_KEY for backend trusted operations, fall back to SUPABASE_KEY or PUBLISHABLE
    raw_key = (
        os.getenv("SUPABASE_SECRET_KEY")
        or os.getenv("SUPABASE_KEY")
        or os.getenv("SUPABASE_PUBLISHABLE_KEY")
        or ""
    )
    key = raw_key.strip()
    if not key or "YOUR_" in key or "sb_secret_..." in key or "sb_publishable_..." in key:
        raise RuntimeError(
            "Supabase API key is missing or set to a placeholder. "
            "Set SUPABASE_SECRET_KEY or SUPABASE_PUBLISHABLE_KEY in backend/.env"
        )
    return key


@lru_cache
def get_supabase_client() -> Client:
    """Return a cached single instance of the Supabase Client."""
    url = get_supabase_url()
    key = get_supabase_key()
    
    # Debug print: URL and first 15 characters of key (never print full secret key)
    key_prefix = key[:15] if len(key) >= 15 else key
    print(f"[DEBUG Supabase] Connecting to URL: {url} | Key Prefix: {key_prefix}...")

    try:
        return create_client(url, key)
    except Exception as exc:
        raise RuntimeError(
            f"Failed to initialize Supabase client. Check credentials in .env: {exc}"
        ) from exc


# Lazy proxy/getter for direct imports if needed
supabase_client = None

def get_client() -> Client:
    return get_supabase_client()
