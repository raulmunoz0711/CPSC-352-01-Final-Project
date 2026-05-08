import os
import json
import base64

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from crypto.rsa_utils import rsa_sign
from crypto.dsa_utils import dsa_sign
from crypto.rsa_utils import rsa_verify
from crypto.dsa_utils import dsa_verify

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

# Encrypts plaintext and sends over the network with a dig sig
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

# Decrypts plaintext (opposite of encryption)
def recieve_message(send_message, session_key, sender_public_key):
    ciphertext = base64.b64decode(send_message["ciphertext"])
    iv = base64.b64decode(send_message["iv"])
    signature = base64.b64decode(send_message["signature"])
    signature_algo = send_message["signature_algo"]

    if signature_algo == "RSA":
        valid = rsa_verify(ciphertext, signature, sender_public_key)
    elif signature_algo == "DSA":
        valid = dsa_verify(ciphertext, signature, sender_public_key)
    else:
        raise ValueError("Unknown signature algorithm: " + signature_algo)
    if not valid:
        raise ValueError("Signature Verification Failed.")

    plaintext = decrypt(ciphertext, iv, session_key)
    
    return plaintext