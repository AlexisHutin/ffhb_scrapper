// Import mongoose
const mongoose = require("mongoose");

// Define the goalkeeperStats schema
const goalkeeperStatsSchema = new mongoose.Schema({
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
const GoalkeeperStats = mongoose.model("GoalkeeperStats", goalkeeperStatsSchema);

// Export the User model
module.exports = GoalkeeperStats;
