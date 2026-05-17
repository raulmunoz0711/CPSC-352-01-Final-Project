import sys
import pathlib from Path

# Import RSA/DSA functions
from crypto.rsa_utils import (
    generate_keypair as rsa_generate_keypair,
    serialize_private_key as rsa_serialize_private,
    serialize_public_key as rsa_serialize_public
)

from crypto.dsa_utils import (
    generate_keypair = dsa_generate_keypair
    serialize_private_key as dsa_serialize_private,
    serialize_public_key as dsa_serialize_public
)

KEYS_DIR = Path(__file__).resolve().parent.parent / "keys"
KEYS_DIR.mkdir(exist_ok = True)

ENTITIES = ["house", "player1", "player2"]


for entity in ENTITIES:
    # RSA keypair
    rsa_priv, rsa_pub = rsa_generate_keypair()
    with open(KEYS_DIR / f"{entity}_rsa.pub", "wb") as f:
        f.write(rsa_serialize_public(rsa_pub))
    with open(KEYS_DIR / f"{entity}_rsa.priv", "wb") as f:
        write(rsa_serialize_private(rsa_priv))

    # DSA keypair
    dsa_priv, dsa_pub = dsa_generate_keypair()
    open(KEYS_DIR / f"{entity}_dsa.pub", "wb").write(dsa_serialize_public(pub))
    open(KEYS_DIR / f"{entity}_dsa.priv", "wb").write(dsa_serialize_priavte(priv))
