"""
DSA utilities for Secure Internet Poker
By Jacob Rodas
"""

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import dsa
from cryptography.exceptions import InvalidSignature

DSA_KEY_SIZE = 2048
HASH_ALGO = hashes.SHA256()


# ---------- Key generation ----------

def generate_keypair():
    # Return (private_key, public_key) as cryptography key objects.
    private_key = dsa.generate_private_key(key_size=DSA_KEY_SIZE)
    return private_key, private_key.public_key()


# ---------- PEM serialization ----------

def serialize_private_key(private_key, password: bytes | None = None) -> bytes:
    encryption = (
        serialization.BestAvailableEncryption(password)
        if password else serialization.NoEncryption()
    )
    return private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=encryption,
    )


def serialize_public_key(public_key) -> bytes:
    return public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )


def load_private_key(pem_bytes: bytes, password: bytes | None = None):
    return serialization.load_pem_private_key(pem_bytes, password=password)


def load_public_key(pem_bytes: bytes):
    return serialization.load_pem_public_key(pem_bytes)


# ---------- Digital signature ----------

def sign(private_key, message: bytes) -> bytes:
    # Sign raw message bytes then returns DER-encoded (r, s) signature.
    return private_key.sign(message, HASH_ALGO)


def verify(public_key, message: bytes, signature: bytes) -> bool:
    # Return True if signature is valid, False otherwise.
    try:
        public_key.verify(signature, message, HASH_ALGO)
        return True
    except InvalidSignature:
        return False
