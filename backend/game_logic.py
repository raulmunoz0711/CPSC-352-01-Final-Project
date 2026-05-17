"""
House-side game state for Secure Internet Poker.
One GameLogic instance per active game session. 
"""

import secrets

TOTAL_ROUNDS = 3
NUMBERS_PER_PLAYER = 3
NUMBER_RANGE = 15  


class Game_Logic:
    def __init__(self):
        # Per-player state, keyed by player_id ("P1" or "P2")
        self.scores = {"P1": 0, "P2": 0}
        self.player_num = {"P1": [], "P2": []}
        self.round_choice = {"P1": None, "P2": None}

        # Session bookkeeping
        self.session_keys = {"P1": None, "P2": None}
        self.player_pub_keys = {"P1": None, "P2": None}
        self.sig_algo = {"P1": None, "P2": None}

        # Anti-replay sequence counters
        self.next_send_seq = {"P1": 0, "P2": 0}
        self.next_recv_seq = {"P1": 0, "P2": 0}

        self.round = 1
        self.started = False
        self.ended = False
        self.round_history = []

    # session setup (called by routes/auth.py)
    def register_player(self, player_id, session_key, public_key, sig_algo):
        if player_id not in ("P1", "P2"):
            raise ValueError(f"Invalid player_id: {player_id}")
        self.session_keys[player_id] = session_key
        self.player_pub_keys[player_id] = public_key
        self.sig_algo[player_id] = sig_algo

    def both_players_registered(self):
        return all(self.session_keys[p] is not None for p in ("P1", "P2"))

    # number generation 
    def gen_num(self):
        nums = set()
        while len(nums) < NUMBERS_PER_PLAYER:
            nums.add(secrets.randbelow(NUMBER_RANGE) + 1)
        return sorted(nums)

    def start_game(self):
        if not self.both_players_registered():
            raise RuntimeError("Cannot start: both players must be registered")
        self.player_num["P1"] = self.gen_num()
        self.player_num["P2"] = self.gen_num()
        self.started = True

    def get_player_num(self, player_id):
        return list(self.player_num[player_id])

    # per-round play (called by routes/game.py)
    def submit_choice(self, player_id, choice):
        if self.ended:
            raise RuntimeError("Game already ended")
        if choice not in self.player_num[player_id]:
            raise ValueError(f"{player_id} made an invalid choice: {choice}")
        if self.round_choice[player_id] is not None:
            raise ValueError(f"{player_id} already submitted this round")

        self.round_choice[player_id] = choice
        self.player_num[player_id].remove(choice)
        return self.round_choice["P1"] is not None and self.round_choice["P2"] is not None


    def resolve_round(self):
        # Returns dict: {"round": int, "P1_choice": int, "P2_choice": int, "winner": "P1"|"P2"|"Tie"}
        c1, c2 = self.round_choice["P1"], self.round_choice["P2"]
        if c1 is None or c2 is None:
            raise RuntimeError("Cannot resolve: both players have not submitted")

        if c1 > c2:
            winner = "P1"
            self.scores["P1"] += 1
        elif c2 > c1:
            winner = "P2"
            self.scores["P2"] += 1
        else:
            winner = "Tie"

        result = {
            "round": self.round,
            "P1_choice": c1,
            "P2_choice": c2,
            "winner": winner,
        }
        self.round_history.append(result)

        # Reset for next round
        self.round_choice = {"P1": None, "P2": None}
        self.round += 1
        if self.round > TOTAL_ROUNDS:
            self.ended = True

        return result

    # end of game
    def get_winner(self):
        if not self.ended:
            raise RuntimeError("Cannot announce winner: game not finished")
        if self.scores["P1"] > self.scores["P2"]:
            return "P1"
        if self.scores["P2"] > self.scores["P1"]:
            return "P2"
        return "Tie"

    # sequence counters
    def consume_send_seq(self, player_id):
        seq = self.next_send_seq[player_id]
        self.next_send_seq[player_id] += 1
        return seq

    def consume_recv_seq(self, player_id):
        seq = self.next_recv_seq[player_id]
        self.next_recv_seq[player_id] += 1
        return seq

    # session destruction
    def end_session(self):
        for p in ("P1", "P2"):
            self.session_keys[p] = None
            self.player_pub_keys[p] = None
            self.round_choice[p] = None
            self.player_num[p] = []
        self.ended = True


# module-level session registry
games = {}  # session_id

def create_game(session_id):
    if session_id in games:
        raise ValueError(f"Session {session_id} already exists")
    games[session_id] = Game_Logic()
    return games[session_id]


def get_game(session_id):
    if session_id not in games:
        raise KeyError(f"Session {session_id} not found")
    return games[session_id]


def destroy_game(session_id):
    if session_id in games:
        games[session_id].end_session()
        del games[session_id]