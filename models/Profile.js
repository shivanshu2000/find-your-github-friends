const mongoose = require("mongoose");

const profileSchema = new mongoose.Schema({
  image: {
    type: String,
    required: true,
  },

  name: {
    type: String,
    required: true,
  },

  githubLink: {
    type: String,
    required: true,
  },
  about: {
    type: String,
    required: true,
  },
});

const Profile = mongoose.model("Profile", profileSchema);
