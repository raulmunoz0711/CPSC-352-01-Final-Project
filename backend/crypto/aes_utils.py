import os
import base64

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from crypto.rsa_utils import sign as rsa_sign, verify as rsa_verify
from crypto.dsa_utils import sign as dsa_sign, verify as dsa_verify

IV_LEN = 12
VALID_KEY_LENS = (16, 24, 32)  # AES-128, AES-192, AES-256


def _bytes_to_sign(iv: bytes, ciphertext: bytes, seq: int) -> bytes:
    return iv + ciphertext + seq.to_bytes(4, "big")


def encrypt(plaintext: bytes, session_key: bytes) -> tuple[bytes, bytes]:
    assert len(session_key) in VALID_KEY_LENS,
    iv = os.urandom(IV_LEN)
    aesgcm = AESGCM(session_key)
    ciphertext = aesgcm.encrypt(iv, plaintext, None)
    return ciphertext, iv


def decrypt(ciphertext: bytes, iv: bytes, session_key: bytes) -> bytes:
    assert len(session_key) in VALID_KEY_LENS,
    aesgcm = AESGCM(session_key)
    return aesgcm.decrypt(iv, ciphertext, None)


def send_message(plaintext: bytes, session_key: bytes, private_key,
                 sender: str, signature_algo: str, seq: int) -> dict:
    if isinstance(plaintext, str):
        plaintext = plaintext.encode("utf-8")

    ciphertext, iv = encrypt(plaintext, session_key)
    to_sign = _bytes_to_sign(iv, ciphertext, seq)

    if signature_algo == "RSA":
        signature = rsa_sign(private_key, to_sign)
    elif signature_algo == "DSA":
        signature = dsa_sign(private_key, to_sign)
    else:
        raise ValueError("signature_algo must be 'RSA' or 'DSA'")

    envelope = {
        "ciphertext": base64.b64encode(ciphertext).decode(),
        "iv": base64.b64encode(iv).decode(),
        "seq": seq,
        "signature": base64.b64encode(signature).decode(),
        "signature_algo": signature_algo,
        "sender": sender,
    }
    return envelope


def receive_message(envelope: dict, session_key: bytes, sender_public_key,
                    expected_seq: int) -> bytes:
    ciphertext = base64.b64decode(envelope["ciphertext"])
    iv = base64.b64decode(envelope["iv"])
    signature = base64.b64decode(envelope["signature"])
    signature_algo = envelope["signature_algo"]
    seq = envelope["seq"]

    if seq != expected_seq:
        raise ValueError(f"replay or out-of-order: got seq={seq}, expected {expected_seq}")

    to_verify = _bytes_to_sign(iv, ciphertext, seq)

    if signature_algo == "RSA":
        valid = rsa_verify(sender_public_key, to_verify, signature)
    elif signature_algo == "DSA":
        valid = dsa_verify(sender_public_key, to_verify, signature)
    else:
        raise ValueError("Unknown signature algorithm: " + signature_algo)

    if not valid:
        raise ValueError("signature verification failed")

    return decrypt(ciphertext, iv, session_key)