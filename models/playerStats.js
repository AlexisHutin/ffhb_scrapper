// Import mongoose
const mongoose = require("mongoose");

// Define the playerStats schema
const playerStatsSchema = new mongoose.Schema({
  player: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player',
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Create the User model
const PlayerStats = mongoose.model("PlayerStats", playerStatsSchema);

// Export the User model
module.exports = PlayerStats;
