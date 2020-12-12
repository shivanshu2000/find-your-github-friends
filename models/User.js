const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },

  email: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  passwordConfirm: {
    type: String,
    required: true,
  },
  verified: {
    type: Boolean,
    default: false,
  },

  verificationToken: {
    type: String,
  },
  tokenExpiry: {
    type: Date,
  },
  avatar: {
    type: String,
    default:
      "https://st2.depositphotos.com/4111759/12123/v/950/depositphotos_121233262-stock-illustration-male-default-placeholder-avatar-profile.jpg",
  },

  about: {
    type: String,
    default: "",
  },
  link: {
    type: String,
    default: "",
  },
  year: {
    type: String,
    default: "",
  },

  tokens: [
    {
      token: {
        type: String,
      },
    },
  ],
});

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    next();
  }
  this.password = await bcrypt.hash(this.password, 8);
  this.passwordConfirm = undefined;

  next();
});

userSchema.methods.generateAuthToken = async function () {
  const user = this;
  const token = jwt.sign({ _id: user._id.toString() }, process.env.JWT_SECRET);

  user.tokens = user.tokens.concat({ token });
  await user.save({ validateBeforeSave: false });

  return token;
};

const User = mongoose.model("User", userSchema);

module.exports = User;
