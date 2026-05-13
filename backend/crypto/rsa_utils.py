"""
RSA utilities for Secure Internet Poker.
By Jacob Rodas
"""

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding

RSA_KEY_SIZE = 2048
PUBLIC_EXPONENT = 65537
HASH_ALGO = hashes.SHA256()


# Key gen

def generate_keypair():
    private_key = rsa.generate_private_key(
        public_exponent=PUBLIC_EXPONENT,
        key_size=RSA_KEY_SIZE,
    )
    return private_key, private_key.public_key()


# PEM serialization

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
        format=serialization.PublicFormat.SubjectPublicKeyInfo, # Serialize public key to PEM bytes
    )


def load_private_key(pem_bytes: bytes, password: bytes | None = None):
    return serialization.load_pem_private_key(pem_bytes, password=password)


def load_public_key(pem_bytes: bytes):
    return serialization.load_pem_public_key(pem_bytes)


# RSA-OAEP encryption/decryption

def encrypt(public_key, plaintext: bytes) -> bytes:
    # RSA-OAEP encryption with SHA-256
    return public_key.encrypt(
        plaintext,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=HASH_ALGO),
            algorithm=HASH_ALGO,
            label=None,
        ),
    )


def decrypt(private_key, ciphertext: bytes) -> bytes:
    return private_key.decrypt(
        ciphertext,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=HASH_ALGO),
            algorithm=HASH_ALGO,
            label=None,
        ),
    )


# RSA-PSS Digital signature

def sign(private_key, message: bytes) -> bytes:
    return private_key.sign(
        message,
        padding.PSS(
            mgf=padding.MGF1(HASH_ALGO),
            salt_length=padding.PSS.MAX_LENGTH,
        ),
        HASH_ALGO,
    )


def verify(public_key, message: bytes, signature: bytes) -> bool:
    from cryptography.exceptions import InvalidSignature
    try:
        public_key.verify(
            signature,
            message,
            padding.PSS(
                mgf=padding.MGF1(HASH_ALGO),
                salt_length=padding.PSS.MAX_LENGTH,
            ),
            HASH_ALGO,
        )
        return True
    except InvalidSignature:
        return False
