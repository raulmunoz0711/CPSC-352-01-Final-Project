"""
Generate RSA + DSA keypairs for house, player1, player2.
Run once before first game from inside backend/: `python keygen.py`

Layout:
  keys/
    house/    house_rsa.{pub,priv}    house_dsa.{pub,priv}
    player1/  player1_rsa.{pub,priv}  player1_dsa.{pub,priv}
    player2/  player2_rsa.{pub,priv}  player2_dsa.{pub,priv}
"""

from pathlib import Path

from crypto.rsa_utils import (
    generate_keypair as rsa_generate_keypair,
    serialize_private_key as rsa_serialize_private,
    serialize_public_key as rsa_serialize_public,
)
from crypto.dsa_utils import (
    generate_keypair as dsa_generate_keypair,
    serialize_private_key as dsa_serialize_private,
    serialize_public_key as dsa_serialize_public,
)

KEYS_DIR = Path(__file__).resolve().parent.parent / "keys"
ENTITIES = ["house", "player1", "player2"]

for entity in ENTITIES:
    entity_dir = KEYS_DIR / entity
    entity_dir.mkdir(parents=True, exist_ok=True)

    # RSA
    rsa_priv, rsa_pub = rsa_generate_keypair()
    (entity_dir / f"{entity}_rsa.pub").write_bytes(rsa_serialize_public(rsa_pub))
    (entity_dir / f"{entity}_rsa.priv").write_bytes(rsa_serialize_private(rsa_priv))

    # DSA
    dsa_priv, dsa_pub = dsa_generate_keypair()
    (entity_dir / f"{entity}_dsa.pub").write_bytes(dsa_serialize_public(dsa_pub))
    (entity_dir / f"{entity}_dsa.priv").write_bytes(dsa_serialize_private(dsa_priv))

    print(f"  {entity}/: rsa + dsa keys written")

print(f"\nGenerated keys in {KEYS_DIR}")
