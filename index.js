const dotenv = require("dotenv");
dotenv.config({ path: "./config.env" });
const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const flash = require("connect-flash");
const session = require("express-session");
const cookieParser = require("cookie-parser");

const DB = process.env.MONGO_URL;

const app = express();

app.set("view engine", "ejs");
app.set("views", "views");

app.use(express.json());
app.use(cookieParser());
// app.use("/images", express.static("images"));

app.use("/images", express.static(path.join(__dirname, "images")));
app.use(express.static(path.join(__dirname, "css")));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: true,
    saveUninitialized: true,
  })
);

app.use(flash());

app.use(function (req, res, next) {
  res.locals.success_msg = req.flash("success_msg");
  res.locals.error_msg = req.flash("error_msg");
  res.locals.error = req.flash("error");
  next();
});

const routes = require("./routes/app");

app.use("/", routes);

mongoose
  .connect(DB, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
    useUnifiedTopology: true,
  })
  .then(() => console.log("DB connection successful!"));

// const PORT = process.env.PORT || 3005;

app.listen(process.env.PORT, (err) => console.log(err));
