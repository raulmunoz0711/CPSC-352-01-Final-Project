import sys
import pathlib import Path

KEYS_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))

from crypto.rsa.utils import (
    generate_keypair as rsa_generate_keypair,
    serialize_private_key as rsa_serialize_private,
    serialize_public_key as rsa_serialize_public
)

from crypto.dsa_utils import (
    generate_keypair = dsa_generate_keypair
    serialize_private_key as dsa_serialize_private,
    serialize_public_key as dsa_serialize_public
)

KEYS_DIR.mkdir(exist_ok = True)

ENTITIES = ["house", "player1", "player2"]


for entity in ENTITIES:
    priv, pub = rsa_generate_keypair()
    (KEYS_DIR / f"{entity}_rsa.pub").write_bytes(rsa_serialize_public(pub))
    (KEYS_DIR / f"{entity}_rsa.priv").write_bytes(rsa_serialize_public(priv))

    priv, pub = dsa_generate_keypair()
    (KEYS_DIR / f"{entity}_dsa.pub").write_bytes(dsa_serialize_public(pub))
    (KEYS_DIR / f"{entity}_dsa.priv").write_bytes(dsa_serialize_public(priv))
