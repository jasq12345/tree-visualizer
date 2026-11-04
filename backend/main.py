from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api.routers import algorithms, tree
from core.config import CORS_ORIGINS

app = FastAPI(title="Tree Visualizer")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tree.router)
app.include_router(algorithms.router)


@app.exception_handler(NotImplementedError)
async def not_implemented(request: Request, exc: NotImplementedError):
    # A bare 500 has no CORS headers, so the browser would report it as a CORS error
    return JSONResponse(status_code=501, content={"detail": "Not implemented yet"})
