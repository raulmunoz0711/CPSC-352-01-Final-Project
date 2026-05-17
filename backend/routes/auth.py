from pathlib import Path
import base64
import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from game_logic import create_game, get_game, games
from crypto import rsa_utils, dsa_utils

router = APIRouter()

KEYS_DIR = Path(__file__).resolve().parents[2] / "keys"

with open(KEYS_DIR / "house" / "house_rsa.priv", "rb") as f:
    HOUSE_PRIV = rsa_utils.load_private_key(f.read())


@router.get("/auth/house-pubkey/{algo}")
def get_house_pubkey(algo: str):
    """Public endpoint — returns the house's public key in PEM format."""
    algo = algo.lower()
    if algo not in ("rsa", "dsa"):
        raise HTTPException(status_code=400, detail="algo must be 'rsa' or 'dsa'")
    pem_bytes = (KEYS_DIR / "house" / f"house_{algo}.pub").read_bytes()
    return {"pem": pem_bytes.decode("utf-8")}


@router.get("/auth/status/{session_id}")
def session_status(session_id: str):
    """Returns whether both players have registered in this session."""
    try:
        game = get_game(session_id)
    except KeyError:
        return {"both_ready": False}
    return {"both_ready": game.both_players_registered()}


def _find_open_session():
    """
    Return the session ID of a game still waiting for a second player,
    or None if no such session exists.
    """
    for session_id, game in games.items():
        if not game.both_players_registered() and not game.ended:
            return session_id
    return None


class AuthRequest(BaseModel):
    player: str
    scheme: str
    wrapped_session_key: str = ""
    signature: str = ""


@router.post("/auth/session")
def auth(req: AuthRequest):
    if req.player in ("player1", "P1"):
        player_id = "P1"
        player_name = "player1"
    elif req.player in ("player2", "P2"):
        player_id = "P2"
        player_name = "player2"
    else:
        raise HTTPException(status_code=400, detail="Player must be player1 or player2")

    if req.scheme == "RSA":
        signature_algo = "RSA"
    elif req.scheme == "DSA":
        signature_algo = "DSA"
    else:
        raise HTTPException(status_code=400, detail="Scheme must be RSA or DSA")

    pub_path = KEYS_DIR / player_name / f"{player_name}_{signature_algo.lower()}.pub"
    with open(pub_path, "rb") as f:
        pub_bytes = f.read()

    if signature_algo == "RSA":
        public_key = rsa_utils.load_public_key(pub_bytes)
    else:
        public_key = dsa_utils.load_public_key(pub_bytes)

    wrapped_key_bytes = base64.b64decode(req.wrapped_session_key)
    signature_bytes = base64.b64decode(req.signature)

    session_key = rsa_utils.decrypt(HOUSE_PRIV, wrapped_key_bytes)

    if signature_algo == "RSA":
        valid = rsa_utils.verify(public_key, wrapped_key_bytes, signature_bytes)
    else:
        valid = dsa_utils.verify(public_key, wrapped_key_bytes, signature_bytes)
    if not valid:
        raise HTTPException(status_code=401, detail="Signature verification failed")

    # Find an open session waiting for a second player; otherwise start a new one.
    session_id = _find_open_session()
    if session_id is None:
        session_id = f"game-{uuid.uuid4().hex[:8]}"
        game = create_game(session_id)
    else:
        game = get_game(session_id)
        # If our slot is already taken in the open session, start a fresh one.
        if game.session_keys[player_id] is not None:
            session_id = f"game-{uuid.uuid4().hex[:8]}"
            game = create_game(session_id)

    game.register_player(
        player_id=player_id,
        session_key=session_key,
        public_key=public_key,
        sig_algo=signature_algo,
    )

    return {
        "status": "registered",
        "player_id": player_id,
        "session_id": session_id,
    }
