import os
import json
import base64

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from crypto.rsa_utils import rsa_sign
from crypto.dsa_utils import dsa_sign

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

def send_message(plaintext, session_key, private_key, sender, signature_algo):
    ciphertext, iv = encrypt(plaintext, session_key)
    
    ct_b64 = base64.b64encode(ciphertext).decode()
    iv_b64 = base64.b64encode(iv).decode()

    if signature_algo == "RSA":
        signature = rsa_sign(ciphertext, private_key)
    elif signature_algo == "DSA":
        signature = dsa_sign(ciphertext, private_key)
    else:
        raise ValueError("sig_algo must be RSA or DSA")

    sig_b64 = base64.b64encode(signature).decode()

    send_message = {
        "ciphertext": ct_b64,
        "iv": iv_b64,
        "signature": sig_b64,
        "signature_algo": signature_algo,
        "sender": sender
    }
    
    return send_message