const express = require("express");
const User = require("../models/User");
const router = express.Router();
const nodemailer = require("nodemailer");
const sendgridTransport = require("nodemailer-sendgrid-transport");
const multer = require("multer");
const sharp = require("sharp");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const auth = require("../middleware/auth");
const path = require("path");

const transporter = nodemailer.createTransport(
  sendgridTransport({
    auth: {
      api_key: process.env.SENDGRID_KEY,
    },
  })
);

router.get("/", auth.auth, async (req, res) => {
  try {
    const contentType = req.headers["content-type"];
    console.log(contentType);
    // res.setHeader("accept", "image/jpeg");

    const isAuthenticated = req.token ? true : false;
    const profiles = await User.find();
    res.render("index", {
      isAuthenticated: isAuthenticated,
      profiles: profiles,
    });
  } catch (err) {
    console.log(err);
  }
});

router.post("/signup", auth.forLoginPage, async (req, res) => {
  const { email, password, name, passwordConfirm } = req.body;

  // const user = await User.findOne({ email: eamil });

  // if (user) {
  //   req.flash("error", "E-mail already exists! Try again with another one.");
  //   return res.redirect("/signup");
  // }
  if (!email || !name) {
    req.flash("error", "Please enter all the fields");
    return res.redirect("/signup");
  }

  if ((email && name && !password) || !passwordConfirm) {
    req.flash("error", "Enter the password");
    return res.redirect("/signup");
  }

  if (password !== passwordConfirm) {
    req.flash("error", "Password does not match");
    return res.redirect("/signup");
  }

  if (password.length < 7) {
    req.flash("error", "Password length should be atleast 7 characters long");
    return res.redirect("/signup");
  }

  const user = await User.findOne({ email });

  if (user && user.verified) {
    req.flash(
      "error",
      "Email already exists! Please try again with another email"
    );
    return res.redirect("/signup");
  }

  if (user && !user.verified) {
    await user.remove();
  }
  crypto.randomBytes(32, async (err, buffer) => {
    if (err) {
      console.log(err);
      return res.redirect("/reset");
    }
    const token = await buffer.toString("hex");
    const user = await User.create({
      email,
      password,
      name,
      passwordConfirm,
      verificationToken: token,
      tokenExpiry: Date.now() + 3600000,
    });

    await transporter.sendMail({
      to: email,
      from: "shivanshusr82@gmail.com",
      subject: "Signup succeeded!",
      html: `<h1>You successfully signed up!</h1>
        <h4>Please verify your email clicking below:</h4>
         <a href="https://create-github-profiles.herokuapp.com/verify-token/${token}">Click here</a>
        
        `,
    });
  });

  req.flash(
    "error",
    "Signup succeded!Please check your email to verify your account"
  );

  res.redirect("/signup");
});

router.get("/verify-token/:token", async (req, res) => {
  const token = req.params.token;

  const user = await User.findOne({
    verificationToken: token,
    tokenExpiry: { $gt: Date.now() },
  });

  if (!user) {
    req.flash("error", "Email is not verified!Please try again");
    return res.redirect("signup");
  }

  user.verified = true;
  user.verificationToken = undefined;
  user.tokenExpiry = undefined;
  await user.save({ validateBeforeSave: false });
  req.flash("success_msg", "Email verified. Please login");
  res.redirect("/login");
});

router.get("/signup", auth.forLoginPage, (req, res) => {
  const isAuthenticated = !req.token ? false : true;
  res.render("signup", {
    isAuthenticated,
  });
});

router.get("/login", auth.forLoginPage, (req, res) => {
  const isAuthenticated = !req.token ? false : true;
  res.render("login", {
    isAuthenticated,
  });
});

router.post("/login", auth.forLoginPage, async (req, res) => {
  let token;
  const { email, password } = req.body;
  const user = await User.findOne({ email: email });
  if (!user) {
    req.flash("error", "Invalid email or password");
    return res.redirect("/login");
  }

  if (user) {
    if (!user.verified) {
      req.flash("error", "Invalid email or password");
      return res.redirect("/login");
    }
  }

  if (user && user.verified) {
    try {
      const ismatch = await bcrypt.compare(password, user.password);
      if (!ismatch) {
        req.flash("error", "Invalid email or password.");
        return res.redirect("/login");
      }
      token = await user.generateAuthToken();
      res.cookie("jwt", token, {
        expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3),
        httpOnly: true,
        // secure: true,
      });

      res.redirect("/");
    } catch (err) {
      console.log(err);
    }
  }
});

router.get("/logout", auth.auth, async (req, res) => {
  try {
    req.user.tokens = req.user.tokens.filter(
      (token) => token.token !== req.token
    );

    res.clearCookie("jwt");
    req.user.save({ validateBeforeSave: false });
    // await req.user.save({ validateBeforeSave: false });

    res.redirect("/login");
  } catch (err) {
    console.log(err);
  }
});

router.get("/me", auth.auth, (req, res) => {
  // console.log(req.user);

  const user = req.user;
  const isAuthenticated = req.token ? true : false;
  // res.set("Content-Type", "image/png");
  // console.log(avatar);
  res.render("profile", {
    user: user,
    isAuthenticated,
  });
});
const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "images");
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === "image/png" ||
    file.mimetype === "image/jpg" ||
    file.mimetype === "image/jpeg"
  ) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

router.use(
  multer({ storage: fileStorage, fileFilter: fileFilter }).single("avatar")
);

// router.use("/images", express.static(path.join(__dirname, "images")));

router.post("/upload-profile", auth.auth, async (req, res) => {
  const image = req.file;

  if (!image) {
    req.flash("error", "Please provie an image.");
    return res.redirect("/me");
  }
  const avatar = image.path;

  console.log(image);
  // console.log(avatar);

  req.user.avatar = avatar;
  await req.user.save({ validateBeforeSave: false });
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Content-Type", "image/jpeg");
  res.redirect("/me");
});

router.post("/update-info", auth.auth, async (req, res) => {
  const { name, about, githublink, year } = req.body;
  // console.log(req.body);
  if (!name || !about || !githublink || !year) {
    req.flash("error", "Please enter all the fields.All fields are required");
    return res.redirect("/me");
  }

  req.user.name = name;
  req.user.about = about;
  req.user.link = githublink;
  req.user.year = year;
  await req.user.save({ validateBeforeSave: false });
  res.redirect("/me");
  // console.log(req.body);
});

router.get("/forgot", auth.forLoginPage, (req, res) => {
  const isAuthenticated = !req.token ? false : true;
  res.render("forgot-mail", {
    isAuthenticated,
  });
});

router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    console.log(email);
    if (!email) {
      req.flash("error", "Please provide an email.");
      return res.redirect("/forgot");
    }

    const user = await User.findOne({ email: email, verified: true });

    if (!user) {
      req.flash("error", "This email is not registered.");
      return res.redirect("/forgot");
    }

    crypto.randomBytes(32, async (err, buffer) => {
      if (err) {
        console.log(err);
        return res.redirect("/forgot");
      }
      const token = await buffer.toString("hex");

      user.verificationToken = token;
      user.tokenExpiry = Date.now() + 3600000;

      await user.save({ validateBeforeSave: false });

      await transporter.sendMail({
        to: email,
        from: "shivanshusr82@gmail.com",
        subject: "Password reset mail!",
        html: `<h1>This mail is to reset your password</h1>
          <h4>Please click below to reset your password:</h4>
           <a href=https://create-github-profiles.herokuapp.com/reset-password/${token}>Click here</a>
          
          `,
      });

      req.flash(
        "success_msg",
        "Password reset mail has been sent. please check your mailbox"
      );
      res.redirect("/forgot");
    });
  } catch (err) {
    console.log(err);
  }
});

router.get("/reset-password/:token", auth.forLoginPage, async (req, res) => {
  const token = req.params.token;
  // console.log(token);
  const user = await User.findOne({
    verificationToken: token,
    tokenExpiry: { $gt: Date.now() },
  });

  if (!user) {
    req.flash("error", "token expired please try again");
    return res.redirect("/forgot");
  }
  const isAuthenticated = !req.token ? false : true;

  user.verificationToken = undefined;
  user.tokenExpiry = undefined;
  await user.save({ validateBeforeSave: false });
  res.locals.success_msg = req.flash("success_msg");
  res.render("reset-password", {
    id: user._id,
    isAuthenticated,
    success_msg: "Please enter your new password",
  });
});

router.post("/reset-password/:id", async (req, res) => {
  const id = req.params.id;
  console.log(id);
  const { password, passwordConfirm } = req.body;
  if (!password || !passwordConfirm) {
    res.locals.error = req.flash("error");
    req.flash("error", "Enter all the fields");
    return res.render("reset-password", {
      id: id,
    });
  }
  if (password.length < 7) {
    res.locals.error = req.flash("error");
    req.flash("error", "Password length must be at least 7 characters long");
    return res.render("reset-password", {
      id: id,
    });
  }

  if (password !== passwordConfirm) {
    res.locals.error = req.flash("error");
    req.flash("error", "Password does not match");
    return res.render("reset-password", {
      id: id,
    });
  }

  const user = await User.findOne({ _id: id });
  user.password = password;
  res.clearCookie("jwt");
  user.tokens = [];
  await user.save({ validateBeforeSave: false });
  req.flash("success_msg", "Password reset successfully! Please login.");
  res.redirect("/login");
});
module.exports = router;
