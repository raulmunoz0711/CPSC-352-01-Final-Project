"""
FastAPI app entrypoint.

Run from inside backend/ with:
  uvicorn main:app --reload

Default port 8000.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import auth, game

app = FastAPI(title="Secure Internet Poker")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(game.router)


@app.get("/")
def root():
    return {"status": "ok", "service": "secure-internet-poker"}
