import os
import json
import base64

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

# Encryption Function
def encrypt(plaintext, session_key):
    iv = os.urandom(12)
    aesgcm = AESGCM(session_key)
    ciphertext = aesgcm.encrypt(iv, plaintext.encode(), None)
    return ciphertext, iv

# Decryption Function
def decrypt(ciphertext, iv, session_key):
    aesgcm = AESGCM(session_key)
    plaintext = aesgcm.decrypt(iv, ciphertext, None)
    return plaintext.decode()
