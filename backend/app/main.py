from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.db.migrate import apply_migrations
from app.api import api_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Agentic Guardian for Real-Time Payment Scam Interception (Kurukshetra PS09)",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware for Person 1's frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=list({settings.FRONTEND_URL, "http://127.0.0.1:5173"}),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routes under /api
@app.on_event("startup")
def ensure_schema_migrations():
    apply_migrations()


app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "online",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "mode": "agentic_interception"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
