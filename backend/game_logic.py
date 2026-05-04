import random

#Temp Players
P1 = "Player 1"
P2 = "Player 2"

class House:
    def __init__(self):
        #Tracking player scored
        self.scores = {"P1": 0, 
                       "P2": 0
                       }
        #Each player keeps there numbers across rounds
        self.player_num = {"P1": [], 
                           "P2": []
                           }

        #Tracking the round
        self.round = 1

    #Generates 3 random numbers between 1 and 15
    def gen_num(self):
        return random.sample(range(1, 16), 3)
    
    def start_game(self):
        #Gives each player their 3 numbers
        self.player_num["P1"] = self.gen_num()
        self.player_num["P2"] = self.gen_num()

    def get_player_num(self, player_name):
        #Stops the users from seeing each others numbers
        return self.player_num[player_name]
    
    def num_choice(self, player_name, choice):
        #Ensure the user picks a number they have
        if choice not in self.player_num[player_name]:
            raise ValueError(f"{player_name} Invlaid Choice Made!")
        
        #remove chosen number for player list
        self.player_num[player_name].remove(choice)

        return choice
    
    #Compare the choices between player 1 and 2
    def compare_choice(self, c1, c2):
        if c1 > c2:
            self.scores["P1"] += 1
            return "P1"
        elif c2 > c1:
            self.scores["P2"] += 1
            return "P2"
        else:
            return "Tie"
        
    def play_round(self):
        #Player 1
        print("Player 1 Turn")
        print("Player 1 Numbers:", self.get_player_num("P1"))

        c1 = int(input("Choose a number: "))
        c1 = self.num_choice("P1", c1)

        #Player 2
        print("\nPlayer 2 Turn")
        print("Player 2 Numbers:", self.get_player_num("P2"))

        c2 = int(input("Choose a number: "))
        c2 = self.num_choice("P2", c2)

        #Define a winner
        winner = self.compare_choice(c1, c2)

        #Check if round is tied
        if winner == "Tie":
            print("\nRound was a tie")
        else:
            print(f"\n{winner} wins the round.")

    def get_winner(self):
        #Checking who wins the game
        if self.scores["P1"] > self.scores["P2"]:
            return "P1"
        elif self.scores["P2"] > self.scores["P1"]:
            return "P2"
        else:
            return "Game Ended in a Draw"
        
    def play_game(self):
        #Start the game
        self.start_game()

        #Ensure the game last 3 rounds
        for _ in range(3):
            self.play_round()

        print("Total Scores:")
        print("\nP1: ", self.scores["P1"])
        print("P2: ", self.scores["P2"])

        print("Winner:", self.get_winner())