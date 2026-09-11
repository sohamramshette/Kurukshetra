import os

# Helper to load .env file into os.environ if python-dotenv/pydantic-settings is not installed
def _load_dotenv_file():
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    env_path = os.path.join(backend_dir, ".env")
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    k, v = k.strip(), v.strip().strip("'\"")
                    if k not in os.environ:
                        os.environ[k] = v

_load_dotenv_file()

try:
    from pydantic_settings import BaseSettings, SettingsConfigDict

    class Settings(BaseSettings):
        PROJECT_NAME: str = "Payment Guardian"
        VERSION: str = "1.0.0"
        API_V1_STR: str = "/api"

        FRONTEND_URL: str = "http://localhost:5173"
        BACKEND_URL: str = "http://localhost:8000"
        DATABASE_URL: str = "sqlite:///./guardian.db"

        # Supabase project settings (brain.md Section 23)
        SUPABASE_PROJECT_ID: str = ""
        SUPABASE_URL: str = ""
        SUPABASE_ANON_KEY: str = ""
        SUPABASE_SERVICE_ROLE_KEY: str = ""

        # Auth / session signing
        JWT_SECRET: str = "change_me_in_production"
        JWT_ALGORITHM: str = "HS256"

        # LLM Settings (brain.md Section 18 & 37)
        LLM_API_KEY: str = ""
        LLM_MODEL: str = "gemini-flash-lite-latest"
        LLM_TEMPERATURE: float = 0.1
        LLM_TIMEOUT_SECONDS: float = 4.0
        GEMINI_API_BASE: str = "https://generativelanguage.googleapis.com/v1beta/models"

        # Normalized Risk Thresholds (brain.md Section 9 & 39)
        THRESHOLD_LOW: int = 25
        THRESHOLD_MEDIUM: int = 50
        THRESHOLD_HIGH: int = 75
        THRESHOLD_CRITICAL: int = 80

        model_config = SettingsConfigDict(
            env_file=".env",
            env_file_encoding="utf-8",
            extra="ignore"
        )

    settings = Settings()

except ImportError:
    class FallbackSettings:
        PROJECT_NAME: str = os.getenv("PROJECT_NAME", "Payment Guardian")
        VERSION: str = "1.0.0"
        API_V1_STR: str = "/api"

        FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")
        BACKEND_URL: str = os.getenv("BACKEND_URL", "http://localhost:8000")
        DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./guardian.db")

        SUPABASE_PROJECT_ID: str = os.getenv("SUPABASE_PROJECT_ID", "")
        SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
        SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "")
        SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

        JWT_SECRET: str = os.getenv("JWT_SECRET", "change_me_in_production")
        JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")

        LLM_API_KEY: str = os.getenv("LLM_API_KEY", "")
        LLM_MODEL: str = os.getenv("LLM_MODEL", "gemini-2.5-flash-lite")
        LLM_TEMPERATURE: float = float(os.getenv("LLM_TEMPERATURE", "0.1"))
        LLM_TIMEOUT_SECONDS: float = float(os.getenv("LLM_TIMEOUT_SECONDS", "4.0"))
        GEMINI_API_BASE: str = "https://generativelanguage.googleapis.com/v1beta/models"

        THRESHOLD_LOW: int = 25
        THRESHOLD_MEDIUM: int = 50
        THRESHOLD_HIGH: int = 75
        THRESHOLD_CRITICAL: int = 80

    settings = FallbackSettings()
