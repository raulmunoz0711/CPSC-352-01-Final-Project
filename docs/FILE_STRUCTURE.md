# Secure Internet Poker — File Structure (Simplified)

This document describes the directory layout for the Secure Internet Poker project.

## Tech Stack

- **Frontend:** React (built with Vite)
- **Backend:** FastAPI (Python)
- **Transport:** HTTP between locally-hosted frontend and backend
- **Cryptography:**
  - Asymmetric: RSA (key wrapping) + RSA-PSS or DSA (signatures, user-selectable per spec)
  - Symmetric: AES-GCM (session-encrypted messages, provides confidentiality + integrity)
  - RNG: Python `secrets` module for the 1–15 number generation

---

## Top-Level Layout

```
poker/
├── backend/
├── frontend/
├── keys/
├── README.md
├── .gitignore
└── .env.example
```

---

## Full Tree

```
poker/
├── backend/
│   ├── crypto/
│   │   ├── __init__.py
│   │   ├── rsa_utils.py          # RSA keygen, encrypt, sign, verify
│   │   ├── dsa_utils.py          # DSA sign, verify
│   │   └── aes_utils.py          # AES-GCM encrypt/decrypt for session messages
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── auth.py               # session key exchange endpoint
│   │   └── game.py               # deal numbers, submit choice, get winner
│   ├── game_logic.py             # round tracking, winner determination, in-memory state
│   ├── keygen.py                 # CLI script to generate house + player keypairs
│   ├── main.py                   # FastAPI app, CORS, includes routers
│   └── requirements.txt
│
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── components/
│   │   │   ├── Lobby.jsx         # pick player, pick RSA or DSA
│   │   │   ├── GameBoard.jsx     # show 3 numbers, current round, controls
│   │   │   └── Result.jsx        # winner announcement
│   │   ├── crypto.js             # all WebCrypto: AES-GCM, RSA, DSA, sign, verify
│   │   ├── api.js                # fetch wrapper that signs + encrypts envelopes
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
│
├── keys/
│   ├── house_rsa.pub
│   ├── house_dsa.pub
│   ├── player1_rsa.pub
│   ├── player1_dsa.pub
│   ├── player2_rsa.pub
│   └── player2_dsa.pub
│
├── README.md
├── .gitignore
└── .env.example
```

---

## Backend (`backend/`)

### `crypto/`
All cryptographic primitives. Game logic imports from here, never directly from the `cryptography` library.

- **`rsa_utils.py`** — RSA-2048 keypair generation, RSA-OAEP encryption (used to wrap the AES session key during handshake), RSA-PSS signing and verification.
- **`dsa_utils.py`** — DSA signing and verification (per spec: user must be able to choose between RSA and DSA for digital signatures).
- **`aes_utils.py`** — AES-GCM encrypt/decrypt for session-protected messages. Also exposes the envelope build/parse helpers (ciphertext, IV, sequence number).

### `routes/`
HTTP endpoints. Thin — parse request, call into `crypto/` and `game_logic.py`, return response.

- **`auth.py`** — Session key exchange (spec step 1). Player sends an AES key encrypted under the house's RSA public key, signed with their chosen scheme. House decrypts, verifies signature, stores session.
- **`game.py`** — Game endpoints: deal three numbers (steps 2–3), accept per-round choice (step 4), announce winner.

### `game_logic.py`
Round tracking, in-memory game state, winner determination. Holds session keys in memory only — they are zeroed when a player leaves (spec step 5).

### `keygen.py`
CLI utility. Run once before the game to populate `keys/` with RSA and DSA keypairs for the house and both players.

### `main.py`
FastAPI app. Sets up CORS for the local Vite dev server, registers the `auth` and `game` routers.

### `requirements.txt`
Python dependencies. At minimum: `fastapi`, `uvicorn`, `cryptography`, `pydantic`.

---

## Frontend (`frontend/`)

### `src/components/`
- **`Lobby.jsx`** — Player identity selection (player1 or player2), signature scheme choice (RSA-PSS or DSA). On submit, generates a session AES key and posts it (encrypted + signed) to `/auth`.
- **`GameBoard.jsx`** — Displays the three numbers received from the house, current round indicator (1, 2, or 3), per-round number selection input.
- **`Result.jsx`** — Winner announcement. Verifies the house's signature on the result before displaying.

### `src/crypto.js`
All client-side cryptography in one file. Uses the WebCrypto API for AES-GCM and RSA (OAEP + PSS), and `jsrsasign` for DSA. Exports functions for: generating an AES-GCM session key, encrypting/decrypting payloads, RSA-OAEP wrapping the session key, RSA-PSS signing, DSA signing, and signature verification.

### `src/api.js`
The fetch wrapper. Every outbound request is wrapped in the signed/encrypted envelope before being sent, and every inbound response is verified and decrypted before being returned to the components. Also polls `/game/round-result` and `/game/winner` (which return HTTP 202 until ready) on a short interval until they return 200.

### `src/App.jsx` and `src/main.jsx`
Standard React entry point and root component. Renders the lobby, then the game board, then the result based on game state.

---

## Long-Term Keys (`keys/`)

Flat layout, matching the original project skeleton.

- `*_rsa.pub` — RSA public keys (committed)
- `*_dsa.pub` — DSA public keys (committed)
- `*_rsa.priv` and `*_dsa.priv` — private keys (**gitignored**, generated locally per machine via `keygen.py`)

The `.gitignore` rule `keys/*.priv` protects these. Verify with `git status` after running `keygen.py` that no `.priv` file is staged.

**Session AES keys are never written to disk.** They live in memory in `game_logic.py` and are destroyed on session exit per spec step 5.

---

## Important Notes

### WebCrypto and DSA
The browser WebCrypto API does not natively support DSA signing. We use the `jsrsasign` library on the frontend to handle DSA sign and verify. The player's DSA private key is loaded into the browser via a file picker in `Lobby.jsx` (using `FileReader.readAsText()`) and held in component memory only — never persisted to localStorage and never sent to the backend.