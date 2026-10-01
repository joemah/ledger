"""Centralized application configuration from environment variables."""
import os


class Settings:
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/proinvoice")
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    # Auth
    SECRET_KEY: str = os.getenv("SECRET_KEY", "change-this-secret-key-in-production")
    ALGORITHM: str = "HS256"

    # CORS
    CORS_ORIGINS: list = os.getenv("CORS_ORIGINS", "*").split(",")

    # File uploads
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "./uploads")

    # SMTP
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASS: str = os.getenv("SMTP_PASS", "")

    # Payment link providers
    WISE_API_TOKEN: str = os.getenv("WISE_API_TOKEN", "")
    WISE_PROFILE_ID: str = os.getenv("WISE_PROFILE_ID", "")
    WISE_API_BASE: str = os.getenv("WISE_API_BASE", "https://api.wise.com")

    REVOLUT_API_TOKEN: str = os.getenv("REVOLUT_API_TOKEN", "")
    REVOLUT_ACCOUNT_ID: str = os.getenv("REVOLUT_ACCOUNT_ID", "")
    REVOLUT_API_BASE: str = os.getenv("REVOLUT_API_BASE", "https://business.revolut.com/api/1.0")

    # LLM providers (multi-provider, MCP-style tool calling)
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "openai")  # openai | anthropic | google
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    OPENAI_BASE_URL: str = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    ANTHROPIC_MODEL: str = os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-20241022")
    GOOGLE_API_KEY: str = os.getenv("GOOGLE_API_KEY", "")
    GOOGLE_MODEL: str = os.getenv("GOOGLE_MODEL", "gemini-1.5-flash")


settings = Settings()