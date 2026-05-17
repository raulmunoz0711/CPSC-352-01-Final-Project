"""
Game endpoints.

Flows:
  POST /game/start          — both players registered, deal numbers
  POST /game/deal           — player fetches their 3 numbers (encrypted)
  POST /game/submit         — player submits this round's choice
  POST /game/round-result   — player polls for round outcome
  POST /game/winner         — player fetches final winner (after round 3)
  POST /game/leave          — player leaves, session destroyed (spec step 5)
"""

from pathlib import Path
import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from game_logic import get_game, destroy_game
from crypto import rsa_utils
from aes_utils import send_message, receive_message

router = APIRouter(prefix="/game")

# House's RSA private key
HOUSE_KEYS_DIR = Path(__file__).resolve().parents[2] / "keys"
with open(HOUSE_KEYS_DIR / "house_rsa.priv", "rb") as f:
    HOUSE_PRIV = rsa_utils.load_private_key(f.read())

HOUSE_SIG_ALGO = "RSA"


# request models

class StartRequest(BaseModel):
    session_id: str


class EnvelopeRequest(BaseModel):
    session_id: str
    player_id: str  # "P1" or "P2"
    envelope: dict


class PollRequest(BaseModel):
    session_id: str
    player_id: str
    round: int | None = None  # required for /round-result; ignored elsewhere


# helpers

def _get_or_404(session_id):
    try:
        return get_game(session_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="session not found")


def _validate_player(game, player_id):
    if player_id not in ("P1", "P2"):
        raise HTTPException(status_code=400, detail="invalid player_id")
    if game.session_keys[player_id] is None:
        raise HTTPException(status_code=401, detail="player not registered")


def _decrypt_player_envelope(game, player_id, envelope):
    _validate_player(game, player_id)
    expected_seq = game.next_recv_seq[player_id]
    try:
        plaintext = receive_message(
            envelope,
            game.session_keys[player_id],
            game.player_pub_keys[player_id],
            expected_seq,
        )
    except ValueError as e:
        # Don't advance seq on failure — keeps client/server in sync for retry
        raise HTTPException(status_code=401, detail=f"envelope verification failed: {e}")
    game.consume_recv_seq(player_id)  # only advance on success
    return plaintext


def _build_player_envelope(game, player_id, plaintext: bytes):
    seq = game.consume_send_seq(player_id)
    return send_message(
        plaintext,
        game.session_keys[player_id],
        HOUSE_PRIV,
        sender="house",
        signature_algo=HOUSE_SIG_ALGO,
        seq=seq,
    )


# endpoints

@router.post("/start")
def start_game(req: StartRequest):
    game = _get_or_404(req.session_id)
    if not game.both_players_registered():
        raise HTTPException(status_code=409, detail="both players must be registered first")
    if game.started:
        raise HTTPException(status_code=409, detail="game already started")
    game.start_game()
    return {"status": "started"}


@router.post("/deal")
def deal_numbers(req: PollRequest):
    game = _get_or_404(req.session_id)
    _validate_player(game, req.player_id)
    if not game.started:
        raise HTTPException(status_code=409, detail="game not started")

    numbers = game.get_player_num(req.player_id)
    plaintext = json.dumps(numbers).encode("utf-8")  # e.g. "[3, 7, 12]"
    envelope = _build_player_envelope(game, req.player_id, plaintext)
    return {"envelope": envelope}


@router.post("/submit")
def submit_choice(req: EnvelopeRequest):
    game = _get_or_404(req.session_id)
    plaintext = _decrypt_player_envelope(game, req.player_id, req.envelope)

    try:
        choice = int(plaintext.decode("utf-8").strip())
    except (ValueError, UnicodeDecodeError):
        raise HTTPException(status_code=400, detail="choice must be an integer")

    try:
        both_in = game.submit_choice(req.player_id, choice)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=409, detail=str(e))

    # Auto-resolve when both submitted so polling can return results immediately
    if both_in:
        game.resolve_round()

    return {"status": "ok", "round_ready": both_in}


@router.post("/round-result")
def round_result(req: PollRequest):
    game = _get_or_404(req.session_id)
    _validate_player(game, req.player_id)
    if req.round is None or req.round < 1:
        raise HTTPException(status_code=400, detail="round number required")

    if req.round > len(game.round_history):
        raise HTTPException(status_code=202, detail="round not yet resolved")

    result = game.round_history[req.round - 1]
    opponent = "P2" if req.player_id == "P1" else "P1"
    payload = {
        "round": result["round"],
        "opponent_choice": result[f"{opponent}_choice"],
        "winner": result["winner"],  # "P1" | "P2" | "Tie"
    }
    plaintext = json.dumps(payload).encode("utf-8")
    envelope = _build_player_envelope(game, req.player_id, plaintext)
    return {"envelope": envelope}


@router.post("/winner")
def get_winner(req: PollRequest):
    game = _get_or_404(req.session_id)
    _validate_player(game, req.player_id)
    if not game.ended:
        raise HTTPException(status_code=202, detail="game not yet ended")
    payload = {
        "winner": game.get_winner(),  # "P1" | "P2" | "Tie"
        "scores": dict(game.scores),
    }
    plaintext = json.dumps(payload).encode("utf-8")
    envelope = _build_player_envelope(game, req.player_id, plaintext)
    return {"envelope": envelope}


@router.post("/leave")
def leave_session(req: PollRequest):
    _get_or_404(req.session_id)
    destroy_game(req.session_id)
    return {"status": "session destroyed"}
