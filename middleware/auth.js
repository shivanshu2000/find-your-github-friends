const jwt = require("jsonwebtoken");
const User = require("../models/User");

exports.auth = async (req, res, next) => {
  const cookie = req.cookies.jwt;
  if (!cookie) {
    req.flash("error", "You are not authenticated! Please login first.");
    return res.redirect("/login");
  }
  const token = await jwt.verify(cookie, process.env.JWT_SECRET);
  const user = await User.findOne({ _id: token._id, "tokens.token": cookie });
  //   console.log(cookie === user.token);
  if (!user) {
    req.flash("error", "You are not authenticated! Please login first.");
    return res.redirect("/login");
  }

  req.token = cookie;
  req.user = user;
  res.locals.isAuthenticated = true;
  // console.log(req.user);
  next();
};

exports.forLoginPage = async (req, res, next) => {
  try {
    const cookie = req.cookies.jwt;

    if (cookie) {
      const token = await jwt.verify(cookie, process.env.JWT_SECRET);
      const user = await User.findOne({ _id: token._id, token: cookie });
      if (user) {
        return res.redirect("/");
      } else {
        req.token = false;
      }
    }

    next();
  } catch (err) {
    console.log(err);
  }
};
