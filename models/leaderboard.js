// Import mongoose
const mongoose = require("mongoose");

// Define the leaderboard schema
const leaderboardSchema = new mongoose.Schema({
  team_name: {
    type: String,
    required: true,
  },
  leaderboard: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Create the User model
const Leaderboard = mongoose.model("Leaderboard", leaderboardSchema);

// Export the User model
module.exports = Leaderboard;
