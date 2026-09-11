from fastapi import APIRouter
from .payments import router as payments_router
from .guardian import router as guardian_router
from .users import router as users_router
from .dashboard import router as dashboard_router

api_router = APIRouter()
api_router.include_router(payments_router, prefix="/payments", tags=["Payments"])
api_router.include_router(guardian_router, prefix="/guardian", tags=["Guardian"])
api_router.include_router(users_router, prefix="/users", tags=["Users"])
api_router.include_router(dashboard_router, prefix="/dashboard", tags=["Dashboard"])
