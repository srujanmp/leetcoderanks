const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

mongoose.connect('mongodb://localhost:27017/leetcode_stats', { 
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

const userSchema = new mongoose.Schema({
  username: String,
  ranking: Number,
  stats: Object
});

const User = mongoose.model('User', userSchema);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Function to validate and extract username
function extractUsername(url) {
    const match = url.match(/^https:\/\/leetcode\.com\/u\/([^\/]+)/);
    return match ? match[1] : null;
}

// Store usernames, fetch stats, and save them in DB
app.post('/getStats', async (req, res) => {
  let { username } = req.body;

  if (!username) {
    return res.json({ status: "error", message: "Username is required" });
  }

  try {
    let user = await User.findOne({ username });

    if (!user) {
      const response = await axios.get(`https://leetcode-stats-api.herokuapp.com/${username}`);
      const data = response.data;

      if (data.status === 'success') {
        const { ranking, ...stats } = data;
        user = await User.create({ username, ranking, stats });
      } else {
        return res.json(data);
      }
    }

    res.json({ status: "success", message: "retrieved", ...user.stats, ranking: user.ranking });
  } catch (error) {
    console.error("Error fetching LeetCode stats:", error);
    res.status(500).json({ status: 'error', message: 'An error occurred' });
  }
});

// Refresh stats for all users
app.get('/refreshStats', async (req, res) => {
  const adminUsername = req.query.admin;

  if (adminUsername !== 'srujanmpadmashali') {
    return res.status(403).json({ status: 'error', message: 'Access denied' });
  }

  try {
    const users = await User.find();
    const updatedUsers = [];

    for (const user of users) {
      try {
        const response = await axios.get(`https://leetcode-stats-api.herokuapp.com/${user.username}`);
        const data = response.data;

        if (data.status === 'success') {
          const { ranking, ...stats } = data;
          await User.findOneAndUpdate({ username: user.username }, { ranking, stats });
          updatedUsers.push({ username: user.username, ranking });
        }
      } catch (error) {
        console.error(`Error updating stats for ${user.username}:`, error);
      }
    }

    res.json({ status: "success", message: "Stats refreshed", users: updatedUsers });
  } catch (error) {
    console.error("Error refreshing stats:", error);
    res.status(500).json({ status: 'error', message: 'An error occurred' });
  }
});

app.get('/getRankings', async (req, res) => {
  try {
    const users = await User.find().sort({ ranking: 1 });
    res.json({ status: "success", users });
  } catch (error) {
    console.error("Error fetching rankings:", error);
    res.status(500).json({ status: 'error', message: 'An error occurred' });
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
