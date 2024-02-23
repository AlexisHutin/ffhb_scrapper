// Import mongoose
const mongoose = require("mongoose");

// Define the player schema
const playerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  isGoalkeeper: {
    type: Boolean,
    required: false,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Create the User model
const Player = mongoose.model("Player", playerSchema);

// Export the User model
module.exports = Player;
