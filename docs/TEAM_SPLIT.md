
## Suggested Team Split

### Backend (4 people)

| Person | Files | Notes |
|--------|-------|-------|
| A | `crypto/rsa_utils.py`, `crypto/dsa_utils.py` | Coordinates with Frontend Person E on sign/verify formats |
| B | `crypto/aes_utils.py`, envelope format | Coordinates with Frontend Person F on the wire format |
| C | `routes/auth.py`, `keygen.py` | Owns the session handshake |
| D | `routes/game.py`, `game_logic.py` | Owns the game state machine |

### Frontend (4 people)

| Person | Files | Notes |
|--------|-------|-------|
| E | `crypto.js` | Coordinates with Backend Persons A and B |
| F | `api.js` | Coordinates with Backend Person B |
| G | `Lobby.jsx`, `App.jsx` | Owns entry flow |
| H | `GameBoard.jsx`, `Result.jsx` | Owns gameplay UI |

The riskiest coordination point is between Person E (frontend crypto) and Persons A + B (backend crypto). Lock down on day 1: AES-GCM nonce length (96 bits is standard), encoding for transport (base64), and the exact bytes that get signed (recommended: `iv || ciphertext || sequence_number`).
