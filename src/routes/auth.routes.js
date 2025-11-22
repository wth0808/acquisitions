import { signup } from "#src/controllers/auth.controller.js";
import express from "express";
//import { signup, signIn, signOut } from "#controllers/auth.controller.js";

const router = express.Router();

router.post("/sign-up", signup);
router.post("/sign-in", (req, res) => {
  res.status(201).json({ message: "User signed in successfully!" });
});
router.post("/sign-out", (req, res) => {
  res.status(201).json({ message: "User signed out successfully!" });
});

export default router;
