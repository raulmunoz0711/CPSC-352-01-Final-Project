# Crypto Handoff — Per-Person Guide

This doc contains info on how to use my crypto modules (`rsa_utils.py`, `dsa_utils.py`) and Kush's (`aes_utils.py`) in `\backend\crypto\` to plug into their files. Read your own section.

---

## Person C — `routes/auth.py`

**Application of logic:**

- Player encrypts AES session key with house's RSA public key.
- House decrypts it with private key, then verifies player's signature.
- Session key gets stored in memory for the rest of the game.

**How to incorporate it into your file:**

- File: `backend/routes/auth.py`
- Functions you call:
  - `rsa_utils.load_private_key(pem_bytes)` — load house's private key from disk
  - `rsa_utils.load_public_key(pem_bytes)` — load player's public key from disk
  - `rsa_utils.decrypt(priv, ciphertext)` — unwrap the session key
  - `rsa_utils.verify(pub, message, signature)` — if player chose RSA
  - `dsa_utils.load_public_key(pem_bytes)` — if player chose DSA
  - `dsa_utils.verify(pub, message, signature)` — if player chose DSA

**Goal:** Confidentiality (session key wrapped in RSA-OAEP) + Integrity & Authenticity (signature proves it's really the player, not Darth).

---

## Person C — `keygen.py`

**Application of logic:**

- Generates RSA + DSA keypairs for house, player1, player2.
- Writes public keys to `keys/*.pub`, private keys to `keys/*.priv`.
- Run once before first game; output is gitignored except for `.pub` files.

**How to incorporate it into your file:**

- File: `backend/keygen.py`
- Functions you call:
  - `rsa_utils.generate_keypair()` → `(priv, pub)` for each of 3 principals
  - `rsa_utils.serialize_private_key(priv)` → PEM bytes, write to `keys/{name}_rsa.priv`
  - `rsa_utils.serialize_public_key(pub)` → PEM bytes, write to `keys/{name}_rsa.pub`
  - `dsa_utils.generate_keypair()` → same pattern
  - `dsa_utils.serialize_private_key(priv)` → write to `keys/{name}_dsa.priv`
  - `dsa_utils.serialize_public_key(pub)` → write to `keys/{name}_dsa.pub`
- Write each file with `open(path, "wb").write(pem_bytes)` — binary mode, PEM bytes go in directly.
- Run as: `python backend/keygen.py`. Idempotent is nice (skip if file exists) but not required.

**Goal:** Bootstrap. Establishes the long-term identity keys that everything else depends on.

---

## Person D — `game_logic.py` + `routes/game.py`

**Application of logic:**

- Every game message goes through `aes_utils.send_message` / `receive_message`.
- These functions encrypt, sign, and bundle into one envelope.
- You track a sequence counter per player to block replay attacks.

**How to incorporate it into your file:**

- Files: `backend/game_logic.py`, `backend/routes/game.py`
- Functions you call:
  - `aes_utils.send_message(plaintext, session_key, house_priv, "house", algo, seq)` — wrap outgoing
  - `aes_utils.receive_message(envelope, session_key, player_pub, expected_seq)` — unwrap incoming
- State you maintain per session:
  - `next_send_seq` — start at 0, increment after every send
  - `next_recv_seq` — start at 0, increment after every successful receive
- Use `secrets.randbelow(15) + 1` to generate the 1–15 numbers, NOT `random.randint`.
- You own house-side game state only. Player behavior is the frontend team's problem (Persons E/F/G/H).

**Goal:** Confidentiality (AES-GCM on every message) + Integrity (GCM auth tag + signature) + Anti-replay (sequence numbers).

---

## Person E — `frontend/src/crypto.js`

**Application of logic:**

- Mirror my Python crypto in JavaScript using WebCrypto.
- Algorithm parameters must match exactly or nothing verifies.
- Use `jsrsasign` library for DSA since WebCrypto can't do it.

**How to incorporate it into your file:**

- File: `frontend/src/crypto.js`
- Add to `package.json`: `"jsrsasign": "^11.x"`
- Functions you implement (mirror my API):
  - `generateSessionKey()` → 32 random bytes for AES-256
  - `wrapSessionKey(housePubKey, sessionKey)` → RSA-OAEP-SHA256
  - `signRSA(privKey, message)` → RSA-PSS-SHA256, salt length 222
  - `verifyRSA(pubKey, message, signature)` → returns bool
  - `signDSA(privKey, message)` → use `jsrsasign` with `"SHA256withDSA"`
  - `verifyDSA(pubKey, message, signature)` → use `jsrsasign`
  - `aesEncrypt(key, plaintext)` → AES-GCM with 12-byte random IV
  - `aesDecrypt(key, iv, ciphertext)` → AES-GCM
- DSA signatures must be DER-encoded, not raw `r||s`. `jsrsasign` does this by default.
- See full parameter spec at the bottom of this doc.

**Goal:** Confidentiality + Integrity & Authenticity on the client side. You're the bookend that makes my backend crypto meaningful.

---

## Person F — `frontend/src/api.js`

**Application of logic:**

- Every outgoing request gets wrapped in a signed + encrypted envelope.
- Every incoming response gets verified + decrypted before reaching components.
- Envelope shape must match `aes_utils.send_message` exactly.

**How to incorporate it into your file:**

- File: `frontend/src/api.js`
- Functions you call (from Person E's `crypto.js`): `signRSA`/`signDSA`, `aesEncrypt`, `aesDecrypt`, `verifyRSA`/`verifyDSA`
- Envelope JSON shape (must match backend):
  ```json
  {
    "ciphertext": "<base64>",
    "iv": "<base64, 12 bytes>",
    "seq": 0,
    "signature": "<base64>",
    "signature_algo": "RSA" | "DSA",
    "sender": "player1"
  }
  ```
- Bytes that get signed: `iv || ciphertext || seq_as_4_byte_big_endian` (exact same as backend).
- Maintain `nextSendSeq` and `nextRecvSeq` in client state — must mirror what Person D tracks server-side.

**Goal:** Confidentiality + Integrity on the wire. You're the transport layer that carries my envelopes across the network without breaking them.

---

## Person G — `Lobby.jsx` + `App.jsx`

**Application of logic:**

- User picks RSA or DSA before the game starts.
- That choice gets passed to `crypto.js` and `api.js` for every signature.
- Generate the session key on lobby submit, then call `/auth/session`.

**How to incorporate it into your file:**

- Files: `frontend/src/components/Lobby.jsx`, `frontend/src/App.jsx`
- Functions you call:
  - `crypto.generateSessionKey()` — on lobby submit
  - `crypto.wrapSessionKey(housePub, sessionKey)` — encrypt it for the house
  - `crypto.signRSA(...)` or `crypto.signDSA(...)` — based on user's radio button choice
  - `api.postAuthSession(...)` — send wrapped key + signature to backend
- Store the user's chosen `signatureAlgo` ("RSA" or "DSA") in app state and pass it to every subsequent API call.
- **Private key file picker:** browser needs access to the player's private key (RSA or DSA depending on choice). Add an `<input type="file">` to the lobby. On change, use `FileReader.readAsText()` to read the PEM contents into a string, then hold it in component state. Pass the PEM string to `crypto.signRSA` or `crypto.signDSA` for the auth-session signature. Key lives in memory only — never persist it to localStorage.
- Common bug: don't pass the `File` object directly to `KEYUTIL.getKey()` (jsrsasign) — read it as text first, then pass the resulting string.

**Goal:** Authentication setup. You initiate the handshake that gives every later message its confidentiality and integrity properties.

---

## Person H — `GameBoard.jsx` + `Result.jsx`

**Application of logic:**

- Display the three numbers received from the house.
- Player's number choice gets signed before sending.
- Final winner announcement must be signature-verified before display.

**How to incorporate it into your file:**

- Files: `frontend/src/components/GameBoard.jsx`, `frontend/src/components/Result.jsx`
- Functions you call (via Person F's `api.js`, not crypto.js directly):
  - `api.getDealtNumbers()` — receives the 3 numbers (api.js handles decrypt + verify)
  - `api.submitChoice(roundNum, chosenNumber)` — api.js wraps it into a signed envelope
  - `api.getResult()` — receives winner announcement (api.js verifies house signature)
- You don't touch crypto directly. If api.js throws "signature verification failed," show an error UI — never silently render unverified data.

**Goal:** Integrity at the UI layer. Refusing to display unverified results is what closes the loop on the whole signature scheme being meaningful.

---

## Full parameter reference (for Person E)

### Hash
SHA-256 everywhere. WebCrypto identifier: `"SHA-256"`.

### RSA
- Key size: 2048 bits
- Public exponent: 65537 (`0x010001`)
- PEM format: `SubjectPublicKeyInfo` (pub), PKCS#8 (priv)

**OAEP (encryption):**
- Padding: OAEP
- Hash: SHA-256
- MGF: MGF1 with SHA-256
- Label: none

```js
crypto.subtle.encrypt({ name: "RSA-OAEP" }, housePubKey, sessionKeyBytes)
```

**PSS (signing):**
- Padding: PSS
- Hash: SHA-256
- MGF: MGF1 with SHA-256
- Salt length: 222 bytes (maximum)

```js
crypto.subtle.sign({ name: "RSA-PSS", saltLength: 222 }, privKey, messageBytes)
```

Signature length: 256 bytes (fixed).

### DSA
- Key size: 2048 bits (L=2048, N=256)
- Hash: SHA-256
- Signature encoding: DER-encoded `SEQUENCE { r INTEGER, s INTEGER }` — NOT raw `r || s`
- WebCrypto doesn't support DSA. Use `jsrsasign`:

```js
import { KEYUTIL, KJUR } from "jsrsasign";

const privKey = KEYUTIL.getKey(privatePemString);
const sig = new KJUR.crypto.Signature({ alg: "SHA256withDSA" });
sig.init(privKey);
sig.updateString(message);
const sigHex = sig.sign();
```

Signature length: variable, typically 70–72 bytes.

### AES-GCM
- Key size: 256 bits (32 bytes)
- IV: 12 bytes, random per message
- No AAD
- Auth tag: appended to ciphertext by WebCrypto/cryptography library (don't separate it manually)

```js
const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext)
```

### Sequence numbers
- Start at 0 per direction per session
- Encode as 4-byte big-endian when signing: `seq.to_bytes(4, "big")` (Python) or a DataView (JS)
- Signed bytes: `iv || ciphertext || seq_bytes`
- Receiver rejects any seq that isn't exactly `expected_seq`

### Encoding
- Base64 for all binary fields on the wire
- UTF-8 for string-to-bytes conversion before signing
- DSA signatures are non-deterministic : do not write tests asserting byte equality

---

## Backend function reference

```python
# crypto/rsa_utils.py
generate_keypair() -> (priv, pub)
serialize_private_key(priv, password=None) -> bytes
serialize_public_key(pub) -> bytes
load_private_key(pem_bytes, password=None) -> priv
load_public_key(pem_bytes) -> pub
encrypt(pub, plaintext: bytes) -> bytes
decrypt(priv, ciphertext: bytes) -> bytes
sign(priv, message: bytes) -> bytes
verify(pub, message: bytes, signature: bytes) -> bool

# crypto/dsa_utils.py
generate_keypair() -> (priv, pub)
serialize_private_key(priv, password=None) -> bytes
serialize_public_key(pub) -> bytes
load_private_key(pem_bytes, password=None) -> priv
load_public_key(pem_bytes) -> pub
sign(priv, message: bytes) -> bytes
verify(pub, message: bytes, signature: bytes) -> bool

# aes_utils.py
encrypt(plaintext: bytes, session_key: bytes) -> (ciphertext, iv)
decrypt(ciphertext: bytes, iv: bytes, session_key: bytes) -> bytes
send_message(plaintext, session_key, private_key, sender, signature_algo, seq) -> dict
receive_message(envelope: dict, session_key, sender_public_key, expected_seq) -> bytes
```

Both `verify()` functions return `bool` and never raise. `receive_message` raises `ValueError` on signature failure, replay, or unknown algo.
