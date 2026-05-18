# CPSC-352-01-Final-Project
This is the GitHub, allowing all team members to collaborate on the CPSC 352-01 Final. Below are displayed each member, their corresponding roles, and how to run the program.

# Group Members
- Raul Munoz   | CWID: 3554 | Email: raulmunoz@csu.fullerton.edu
- Jacob Rodas  | CWID: 7002 | Email: jacobrodas@csu.fullerton.edu
- Chris Jose   | CWID: 0329 | Email: cjose@csu.fullerton.edu
- Kush Bajaria | CWID: 5460 | Email: bajariakush@csu.fullerton.edu
- Christopher Contreras | CWID: 0168 | Email: cdc17507@csu.fullerton.edu
- Jg Guerrero | CWID: 2197 | Email: jonathanguerrero@csu.fullerton.edu
- Harsh Chuncha | CWID: 6607 | Email: harshkc03@csu.fullerton.edu
- Eduardo Tostado | CWID: 9977 | Email: eduardotostado@csu.fullerton.edu

# Member Roles
### Backend (4 people)

| Person | Files | Notes |
|--------|-------|-------|
| Jacob Rodas | `crypto/rsa_utils.py`, `crypto/dsa_utils.py` | Coordinates with Frontend Person Chris Jose on sign/verify formats |
| Kush Bajaria | `crypto/aes_utils.py`, envelope format | Coordinates with Frontend Person Harsh Chuncha on the wire format |
| Eduardo Tostado | `routes/auth.py`, `keygen.py` | Owns the session handshake |
| Raul Munoz | `routes/game.py`, `game_logic.py` | Owns the game state machine |

### Frontend (4 people)

| Person | Files | Notes |
|--------|-------|-------|
| Chris Jose | `crypto.js` | Coordinates with Backend Persons Jacob Rodas and Kush Bajaria |
| Harsh Chuncha | `api.js` | Coordinates with Backend Person Kush Bajaria |
| Christopher Contreras | `Lobby.jsx`, `App.jsx` | Owns entry flow |
| Jg Guerrero | `GameBoard.jsx`, `Result.jsx` | Owns gameplay UI |

# How to Run

## Requirements

- **Python 3.10+** (3.12 or 3.13 recommended)
- **Node.js 18+** with `npm`
- **Google Chrome**

## First-time setup

```bash
# Backend
cd backend
pip install -r requirements.txt
python keygen.py # generates the rsa and dsa keys for upload
```


```bash
# Frontend
cd ../frontend
npm install
```

## Running the app

Two terminals.

**Terminal 1 (backend):**
```bash
cd backend
uvicorn main:app --reload
```
Serves on `http://localhost:8000`.

**Terminal 2 (frontend):**
```bash
cd frontend
npm run dev
```
Serves on `http://localhost:5173`.

## Playing a game

Open two Chrome windows so the sessions stay isolated:

1. **Player 1:** regular Chrome window → `http://localhost:5173`
2. **Player 2:** **incognito** Chrome window → `http://localhost:5173`

In each window:

1. Pick the player slot (Player 1 or Player 2)
2. Pick a signature scheme (RSA-PSS or DSA)
3. Upload that player's private key file from `keys/<player>/<player>_<scheme>.priv`
   - e.g. Player 1 with RSA → `keys/player1/player1_rsa.priv`
   - e.g. Player 2 with DSA → `keys/player2/player2_dsa.priv`
4. Click **Enter the Table**

The first player to enter will see "Waiting for second player…" until the second player joins. Then both clients jump to the game board.

Play three rounds.

## Replaying

- **In order to replay the game:** 
1. Ctrl+C your backend running uvicorn
2. Ctrl+C your frontend running dev
3. Close both existing tabs (regular window and incognito window) running localhost
4. Open up new tabs
5. run the commands again for backend and frontend

**Terminal 1 (/backend):**
```bash
uvicorn main:app --reload
```

**Terminal 2 (/frontend):**
```bash
npm run dev
```
6. put in the URL for both open tabs `http://localhost:5173`